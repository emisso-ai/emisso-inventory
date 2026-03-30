import type { ValuationLayer } from '../types.js';
import { multiply } from '../money.js';
import { calculateAverageCost } from '../valuation/avco.js';

/**
 * Calculate the value of an inventory adjustment.
 *
 * Uses average cost from existing valuation layers for the material.
 * Returns 0 if no layers exist.
 */
export function calculateAdjustmentValue(
  materialId: string,
  quantity: number,
  valuationLayers: ValuationLayer[],
): number {
  const avgCost = calculateAverageCost(valuationLayers, materialId);
  if (avgCost === 0) return 0;
  return multiply(Math.abs(quantity), avgCost) * (quantity < 0 ? -1 : 1);
}
