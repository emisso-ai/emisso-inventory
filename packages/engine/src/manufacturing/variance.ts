/**
 * Production variance analysis — pure functions.
 *
 * SAP's 5 variance categories:
 * - Input Price Variance
 * - Usage Variance
 * - Scrap Variance
 * - Lot Size Variance
 * - Mix Variance (residual)
 */

import { type ProductionOrder, type VarianceBreakdown } from '../types.js';
import { round } from '../money.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PlannedCosts = {
  materialCost: number;       // Planned material cost (from BOM × planned prices)
  activityCost: number;       // Planned activity cost (from routing × planned rates)
  totalPlannedCost: number;
};

export type ActualCosts = {
  materialCost: number;       // Actual material cost (from issued × actual prices)
  activityCost: number;       // Actual activity cost (from confirmed × actual rates)
  totalActualCost: number;
};

// ---------------------------------------------------------------------------
// Variance calculation
// ---------------------------------------------------------------------------

/**
 * Calculate production variances for a completed (or partially completed) order.
 *
 * @param order - The production order
 * @param plannedCosts - Planned costs from BOM/routing at standard prices
 * @param actualCosts - Actual costs from issued materials and confirmed operations
 * @param plannedScrapRate - Expected scrap as percentage (e.g., 5 = 5%)
 * @returns VarianceBreakdown with all 5 SAP variance categories
 */
export function calculateVariances(
  order: ProductionOrder,
  plannedCosts: PlannedCosts,
  actualCosts: ActualCosts,
  plannedScrapRate?: number,
): VarianceBreakdown {
  const effectiveScrapRate = plannedScrapRate ?? 0;
  const received = order.receivedQuantity;
  const planned = order.plannedQuantity;

  // Planned unit cost
  const plannedUnitCost = planned > 0
    ? plannedCosts.totalPlannedCost / planned
    : 0;

  // Expected cost at actual volume
  const expectedCostAtActualVolume = round(plannedUnitCost * received);

  // Total variance
  const totalVariance = actualCosts.totalActualCost - expectedCostAtActualVolume;

  // 1. Input Price Variance — material price difference at actual volume
  const expectedMaterialCost = planned > 0
    ? round(plannedCosts.materialCost / planned * received)
    : 0;
  const inputPriceVariance = actualCosts.materialCost - expectedMaterialCost;

  // 2. Usage Variance — material quantity difference at planned prices
  //    sum of (issuedQty - (plannedQty / plannedOrderQty × receivedQty)) × planned price
  //    Approximated as: expected material cost at actual volume - planned material share of actual volume
  //    We use component-level data from the order
  let usageVariance = 0;
  if (planned > 0 && order.components.length > 0) {
    for (const component of order.components) {
      const expectedQty = (component.plannedQuantity / planned) * received;
      const qtyDifference = component.issuedQuantity - expectedQty;
      // Use planned material unit price: plannedCosts.materialCost spread proportionally
      const componentPlannedShare = component.plannedQuantity > 0
        ? plannedCosts.materialCost * (component.plannedQuantity / order.components.reduce((s, c) => s + c.plannedQuantity, 0))
        : 0;
      const plannedPrice = component.plannedQuantity > 0
        ? componentPlannedShare / component.plannedQuantity
        : 0;
      usageVariance += round(qtyDifference * plannedPrice);
    }
  }

  // 3. Scrap Variance — excess scrap beyond planned rate
  const totalProduced = received + order.scrapQuantity;
  const actualScrapRate = totalProduced > 0
    ? order.scrapQuantity / totalProduced
    : 0;
  const scrapRateDelta = actualScrapRate - (effectiveScrapRate / 100);
  const scrapVariance = round(scrapRateDelta * plannedUnitCost * totalProduced);

  // 4. Lot Size Variance — fixed costs spread over different quantity
  const lotSizeVariance = planned > 0
    ? round(actualCosts.activityCost * (1 - received / planned))
    : 0;

  // 5. Mix Variance — residual (catch-all)
  const mixVariance = totalVariance - (inputPriceVariance + usageVariance + scrapVariance + lotSizeVariance);

  return {
    orderId: order.id,
    inputPriceVariance,
    usageVariance,
    scrapVariance,
    lotSizeVariance,
    mixVariance,
    totalVariance,
  };
}
