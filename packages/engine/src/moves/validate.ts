/**
 * Move validation rules.
 *
 * Validates a move before it is applied, checking business constraints
 * like positive quantity, stock availability, and required fields.
 */

import type { Move, Quant, ValidationResult } from '../types.js';
import { isVirtualLocation } from '../locations/virtual.js';

export type ValidationConfig = {
  allowNegativeStock?: boolean;
  requireUnitCostForReceipts?: boolean;
};

/**
 * Validate a move before applying.
 *
 * Returns `{ valid: true }` or `{ valid: false, errors: [...] }`.
 */
export function validateMove(
  move: Move,
  quants: Quant[],
  config?: ValidationConfig,
): ValidationResult {
  const errors: string[] = [];
  const allowNegativeStock = config?.allowNegativeStock ?? false;
  const requireUnitCostForReceipts = config?.requireUnitCostForReceipts ?? true;

  // 1. quantity must be > 0
  if (move.quantity <= 0) {
    errors.push('Quantity must be greater than 0');
  }

  // 2. from and to must be different
  if (move.fromLocationId === move.toLocationId) {
    errors.push('Source and destination locations must be different');
  }

  // 3. materialId must not be empty
  if (!move.materialId || move.materialId.trim() === '') {
    errors.push('Material ID is required');
  }

  // 4. Receipt: unitCost required
  const isReceipt = isVirtualLocation(move.fromLocationId) && !isVirtualLocation(move.toLocationId);
  if (isReceipt && requireUnitCostForReceipts) {
    if (move.unitCost === null || move.unitCost === undefined || move.unitCost <= 0) {
      errors.push('Unit cost is required and must be greater than 0 for receipts');
    }
  }

  // 5. Issue: check stock availability
  const isIssue = !isVirtualLocation(move.fromLocationId);
  if (isIssue && !allowNegativeStock) {
    const available = quants
      .filter(
        (q) =>
          q.materialId === move.materialId &&
          q.locationId === move.fromLocationId &&
          (move.batchId === null || q.batchId === move.batchId),
      )
      .reduce((sum, q) => sum + (q.quantity - q.reservedQuantity), 0);

    if (available < move.quantity) {
      errors.push(
        `Insufficient stock: available ${available}, requested ${move.quantity}`,
      );
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true };
}
