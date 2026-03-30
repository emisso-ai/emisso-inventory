/**
 * Standard Price valuation.
 *
 * Goods are always valued at a fixed standard price.
 * The difference between standard and actual cost is tracked as a price variance.
 */

import type { ValuationLayer, ConsumedLayer } from '../types.js';
import { multiply } from '../money.js';
import { consumeFIFO } from './fifo.js';

/**
 * Consume at a fixed standard price.
 * The actual cost is determined by FIFO consumption from layers.
 * The difference between standard and actual goes to price difference.
 *
 * @param layers - All valuation layers
 * @param materialId - Which material to consume
 * @param quantity - How much to consume
 * @param standardPrice - Fixed standard price per unit (integer cents)
 * @returns Consumed records, updated layers, total cost at standard, and price difference
 */
export function consumeStandard(
  layers: ValuationLayer[],
  materialId: string,
  quantity: number,
  standardPrice: number,
): {
  consumed: ConsumedLayer[];
  updatedLayers: ValuationLayer[];
  totalCost: number;
  priceDifference: number;
} {
  const totalCost = multiply(quantity, standardPrice);

  if (quantity === 0) {
    return {
      consumed: [],
      updatedLayers: [...layers],
      totalCost: 0,
      priceDifference: 0,
    };
  }

  // Consume from layers using FIFO to determine actual cost
  const fifoResult = consumeFIFO(layers, materialId, quantity);

  // Override consumed records to report standard price
  const consumed: ConsumedLayer[] = fifoResult.consumed.map((c) => ({
    ...c,
    unitCost: standardPrice,
    totalValue: multiply(c.quantity, standardPrice),
  }));

  // Price difference: standard cost - actual cost from layers
  // Positive = favorable (standard > actual), negative = unfavorable
  const priceDifference = totalCost - fifoResult.totalCost;

  return {
    consumed,
    updatedLayers: fifoResult.updatedLayers,
    totalCost,
    priceDifference,
  };
}
