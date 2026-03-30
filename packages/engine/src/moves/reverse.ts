/**
 * Move reversal.
 *
 * Creates a new move that undoes the effect of an original move
 * by swapping the from/to locations.
 */

import type { Move } from '../types.js';
import { generateId } from './move.js';

/**
 * Create a reversal move that undoes the original.
 *
 * - Swaps fromLocationId and toLocationId
 * - Copies materialId, quantity, unit, unitCost, batchId
 * - Sets reversalOfId to the original move's ID
 * - Returns a new move in 'draft' state
 */
export function createReversalMove(originalMove: Move): Move {
  const now = new Date();
  return {
    id: generateId('mov'),
    materialId: originalMove.materialId,
    fromLocationId: originalMove.toLocationId,
    toLocationId: originalMove.fromLocationId,
    quantity: originalMove.quantity,
    unit: originalMove.unit,
    unitCost: originalMove.unitCost,
    state: 'draft',
    reference: originalMove.reference,
    batchId: originalMove.batchId,
    presetCode: null,
    reversalOfId: originalMove.id,
    routeId: null,
    timestamp: now,
    createdAt: now,
  };
}
