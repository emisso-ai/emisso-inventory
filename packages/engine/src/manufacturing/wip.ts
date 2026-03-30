/**
 * WIP (Work in Process) calculation — pure functions.
 *
 * SAP-grade WIP: costs incurred on an open production order
 * that have not yet been delivered as finished goods.
 */

import { type ProductionOrder, type WIPResult } from '../types.js';
import { round, multiply, sum } from '../money.js';

// ---------------------------------------------------------------------------
// WIP calculation
// ---------------------------------------------------------------------------

/**
 * Calculate WIP for a production order.
 *
 * @param order - The production order with components and operations
 * @param materialPrices - Map of materialId → unit cost (integer cents)
 * @param activityRates - Map of workCenterId → cost per minute (integer cents)
 * @param overheadRate - Overhead as percentage of material cost (e.g., 10 = 10%)
 * @returns WIPResult with full cost breakdown
 */
export function calculateWIP(
  order: ProductionOrder,
  materialPrices: Map<string, number>,
  activityRates?: Map<string, number>,
  overheadRate?: number,
): WIPResult {
  // 1. Material cost = sum(issuedQuantity × price) for each component
  const materialCost = order.components.reduce((acc, component) => {
    const price = materialPrices.get(component.materialId) ?? 0;
    return acc + multiply(component.issuedQuantity, price);
  }, 0);

  // 2. Activity cost = sum(confirmedTime × rate) for each operation
  const activityCost = order.operations.reduce((acc, operation) => {
    const rate = activityRates?.get(operation.workCenterId ?? '') ?? 0;
    return acc + multiply(operation.confirmedTime, rate);
  }, 0);

  // 3. Overhead cost = materialCost × (overheadRate / 100)
  const effectiveOverheadRate = overheadRate ?? 0;
  const overheadCost = round(materialCost * effectiveOverheadRate / 100);

  // 4. Total WIP = material + activity + overhead
  const totalWIP = sum(materialCost, activityCost, overheadCost);

  // 5. Delivered value = proportional share of costs based on received/planned
  const deliveredValue = order.plannedQuantity > 0
    ? round(totalWIP * (order.receivedQuantity / order.plannedQuantity))
    : 0;

  // 6. Balance = totalWIP - deliveredValue
  const balance = totalWIP - deliveredValue;

  return {
    orderId: order.id,
    materialCost,
    activityCost,
    overheadCost,
    totalWIP,
    deliveredValue,
    balance,
  };
}
