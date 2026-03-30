/**
 * FIFO (First In, First Out) valuation.
 *
 * Consumes the oldest layers first, tracking actual cost of goods consumed.
 */

import type { ValuationLayer, ConsumedLayer } from '../types.js';
import { multiply } from '../money.js';

/**
 * Consume quantity using FIFO order (oldest first by timestamp).
 *
 * @param layers - All valuation layers
 * @param materialId - Which material to consume
 * @param quantity - How much to consume
 * @returns Consumed records, updated layers array, and total cost
 */
export function consumeFIFO(
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

  // Sort eligible layers by timestamp ascending (oldest first)
  const sortedIndices = layers
    .map((layer, idx) => ({ layer, idx }))
    .filter((e) => e.layer.materialId === materialId && e.layer.remainingQty > 0)
    .sort((a, b) => a.layer.timestamp.getTime() - b.layer.timestamp.getTime());

  const updatedLayers = layers.map((l) => ({ ...l }));
  const consumed: ConsumedLayer[] = [];
  let remaining = quantity;
  let totalCost = 0;

  for (const { idx } of sortedIndices) {
    if (remaining <= 0) break;

    const layer = updatedLayers[idx]!;
    const take = Math.min(remaining, layer.remainingQty);
    const cost = multiply(take, layer.unitCost);

    consumed.push({
      layerId: layer.id,
      quantity: take,
      unitCost: layer.unitCost,
      totalValue: cost,
    });

    layer.remainingQty -= take;
    layer.remainingValue -= cost;
    remaining -= take;
    totalCost += cost;
  }

  return { consumed, updatedLayers, totalCost };
}
