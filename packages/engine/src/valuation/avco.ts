/**
 * Average Cost (AVCO) valuation.
 *
 * Uses weighted average cost across all remaining layers for a material.
 * Consumption is distributed proportionally across layers.
 */

import type { ValuationLayer, ConsumedLayer } from '../types.js';
import { divide, multiply, round } from '../money.js';

/**
 * Calculate the current average cost for a material from its layers.
 *
 * @param layers - All valuation layers
 * @param materialId - Which material
 * @returns Weighted average unit cost (integer cents), or 0 if no stock
 */
export function calculateAverageCost(
  layers: ValuationLayer[],
  materialId: string,
): number {
  const matching = layers.filter(
    (l) => l.materialId === materialId && l.remainingQty > 0,
  );

  const totalQty = matching.reduce((sum, l) => sum + l.remainingQty, 0);
  if (totalQty === 0) return 0;

  const totalValue = matching.reduce((sum, l) => sum + l.remainingValue, 0);
  return divide(totalValue, totalQty);
}

/**
 * Consume quantity at average cost, distributing proportionally across layers.
 *
 * @param layers - All valuation layers
 * @param materialId - Which material to consume
 * @param quantity - How much to consume
 * @returns Consumed records, updated layers array, and total cost
 */
export function consumeAVCO(
  layers: ValuationLayer[],
  materialId: string,
  quantity: number,
): {
  consumed: ConsumedLayer[];
  updatedLayers: ValuationLayer[];
  totalCost: number;
} {
  if (quantity === 0) {
    return { consumed: [], updatedLayers: [...layers], totalCost: 0 };
  }

  const avgCost = calculateAverageCost(layers, materialId);
  if (avgCost === 0) {
    return { consumed: [], updatedLayers: [...layers], totalCost: 0 };
  }

  // Find matching layers with remaining stock
  const matchingIndices = layers
    .map((layer, idx) => ({ layer, idx }))
    .filter((e) => e.layer.materialId === materialId && e.layer.remainingQty > 0);

  const totalAvailable = matchingIndices.reduce(
    (sum, e) => sum + e.layer.remainingQty,
    0,
  );
  const actualQty = Math.min(quantity, totalAvailable);
  const totalCost = multiply(actualQty, avgCost);

  const updatedLayers = layers.map((l) => ({ ...l }));
  const consumed: ConsumedLayer[] = [];

  // Distribute consumption proportionally across layers
  let distributedQty = 0;
  for (let i = 0; i < matchingIndices.length; i++) {
    const { idx } = matchingIndices[i]!;
    const layer = updatedLayers[idx]!;

    let layerConsume: number;
    if (i === matchingIndices.length - 1) {
      // Last layer gets the remainder to avoid rounding gaps
      layerConsume = actualQty - distributedQty;
    } else {
      const share = layer.remainingQty / totalAvailable;
      layerConsume = round(actualQty * share);
    }

    if (layerConsume <= 0) continue;

    const layerCostValue = multiply(layerConsume, avgCost);

    consumed.push({
      layerId: layer.id,
      quantity: layerConsume,
      unitCost: avgCost,
      totalValue: layerCostValue,
    });

    layer.remainingQty -= layerConsume;
    layer.remainingValue -= layerCostValue;
    distributedQty += layerConsume;
  }

  return { consumed, updatedLayers, totalCost };
}
