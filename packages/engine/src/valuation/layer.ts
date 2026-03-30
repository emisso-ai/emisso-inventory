/**
 * Valuation layer creation and consumption.
 *
 * A valuation layer represents a batch of goods received at a specific cost.
 * Layers are created on receipt and consumed on issue/delivery.
 */

import type { ValuationLayer, ConsumedLayer, Move } from '../types.js';
import { multiply } from '../money.js';

/**
 * Generate a unique layer ID.
 */
export function generateLayerId(): string {
  return `layer-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Create a valuation layer from a receipt move.
 * Called when goods are received (move from virtual to physical location).
 *
 * @param move - The receipt move (must have unitCost set)
 * @returns A new valuation layer
 * @throws Error if move.unitCost is null
 */
export function createValuationLayer(move: Move): ValuationLayer {
  if (move.unitCost == null) {
    throw new Error('Cannot create valuation layer: move.unitCost is required');
  }

  const totalValue = multiply(move.quantity, move.unitCost);

  return {
    id: generateLayerId(),
    moveId: move.id,
    materialId: move.materialId,
    quantity: move.quantity,
    remainingQty: move.quantity,
    unitCost: move.unitCost,
    totalValue,
    remainingValue: totalValue,
    timestamp: move.timestamp,
  };
}

/**
 * Consume from a specific valuation layer.
 * Reduces remainingQty and remainingValue by the consumed amount.
 *
 * @param layer - The layer to consume from
 * @param quantity - How much to consume
 * @returns The updated layer and a consumption record
 * @throws Error if quantity exceeds remainingQty
 */
export function consumeFromLayer(
  layer: ValuationLayer,
  quantity: number,
): { updatedLayer: ValuationLayer; consumed: ConsumedLayer } {
  if (quantity > layer.remainingQty) {
    throw new Error(
      `Cannot consume ${quantity} from layer ${layer.id}: only ${layer.remainingQty} remaining`,
    );
  }

  const consumedValue = multiply(quantity, layer.unitCost);

  const consumed: ConsumedLayer = {
    layerId: layer.id,
    quantity,
    unitCost: layer.unitCost,
    totalValue: consumedValue,
  };

  const updatedLayer: ValuationLayer = {
    ...layer,
    remainingQty: layer.remainingQty - quantity,
    remainingValue: layer.remainingValue - consumedValue,
  };

  return { updatedLayer, consumed };
}
