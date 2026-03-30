/**
 * Quant operations — pure functions for managing materialized stock on hand.
 *
 * A Quant is a materialized record of stock: how many units of a material
 * exist at a specific location (optionally in a specific batch).
 * Quants are projected from completed moves.
 */

import { type Quant, type Move } from '../types.js';
import { isPhysicalLocation } from '../locations/virtual.js';

function matchesQuant(
  q: Quant,
  materialId: string,
  locationId: string,
  batchId?: string | null,
): boolean {
  return (
    q.materialId === materialId &&
    q.locationId === locationId &&
    (q.batchId ?? null) === (batchId ?? null)
  );
}

function createQuant(
  materialId: string,
  locationId: string,
  batchId?: string | null,
): Quant {
  return {
    materialId,
    locationId,
    batchId: batchId ?? null,
    quantity: 0,
    reservedQuantity: 0,
  };
}

// ---------------------------------------------------------------------------
// Query functions
// ---------------------------------------------------------------------------

/**
 * Find a quant matching material + location + batch.
 */
export function findQuant(
  quants: Quant[],
  materialId: string,
  locationId: string,
  batchId?: string | null,
): Quant | undefined {
  return quants.find((q) => matchesQuant(q, materialId, locationId, batchId));
}

/**
 * Get total available stock (quantity - reservedQuantity) for a material at a location.
 * Sums across all batches at that location.
 */
export function getAvailableStock(
  quants: Quant[],
  materialId: string,
  locationId: string,
): number {
  return quants
    .filter((q) => q.materialId === materialId && q.locationId === locationId)
    .reduce((sum, q) => sum + (q.quantity - q.reservedQuantity), 0);
}

/**
 * Get total stock for a material across ALL locations.
 */
export function getTotalStock(
  quants: Quant[],
  materialId: string,
): number {
  return quants
    .filter((q) => q.materialId === materialId)
    .reduce((sum, q) => sum + q.quantity, 0);
}

/**
 * Get stock grouped by location for a material.
 */
export function getStockByLocation(
  quants: Quant[],
  materialId: string,
): Array<{ locationId: string; quantity: number; reservedQuantity: number; available: number }> {
  const byLocation = new Map<
    string,
    { quantity: number; reservedQuantity: number }
  >();

  for (const q of quants) {
    if (q.materialId !== materialId) continue;
    const existing = byLocation.get(q.locationId) ?? {
      quantity: 0,
      reservedQuantity: 0,
    };
    existing.quantity += q.quantity;
    existing.reservedQuantity += q.reservedQuantity;
    byLocation.set(q.locationId, existing);
  }

  return Array.from(byLocation.entries()).map(([locationId, data]) => ({
    locationId,
    quantity: data.quantity,
    reservedQuantity: data.reservedQuantity,
    available: data.quantity - data.reservedQuantity,
  }));
}

// ---------------------------------------------------------------------------
// Mutation functions (immutable — return new arrays)
// ---------------------------------------------------------------------------

/**
 * Apply a "done" move to quants.
 *
 * - Decrease quantity at fromLocation (if physical)
 * - Increase quantity at toLocation (if physical)
 * - Returns a new quants array (immutable)
 */
export function applyMoveToQuants(quants: Quant[], move: Move): Quant[] {
  if (move.state !== 'done') return quants;

  let result = [...quants];
  const fromPhysical = isPhysicalLocation(move.fromLocationId);
  const toPhysical = isPhysicalLocation(move.toLocationId);

  // Decrease source quant
  if (fromPhysical) {
    const idx = result.findIndex((q) =>
      matchesQuant(q, move.materialId, move.fromLocationId, move.batchId),
    );
    if (idx >= 0) {
      result[idx] = { ...result[idx]!, quantity: result[idx]!.quantity - move.quantity };
    } else {
      result.push({
        ...createQuant(move.materialId, move.fromLocationId, move.batchId),
        quantity: -move.quantity,
      });
    }
  }

  // Increase destination quant
  if (toPhysical) {
    const idx = result.findIndex((q) =>
      matchesQuant(q, move.materialId, move.toLocationId, move.batchId),
    );
    if (idx >= 0) {
      result[idx] = { ...result[idx]!, quantity: result[idx]!.quantity + move.quantity };
    } else {
      result.push({
        ...createQuant(move.materialId, move.toLocationId, move.batchId),
        quantity: move.quantity,
      });
    }
  }

  return result;
}

/**
 * Project quants from scratch by replaying a list of done moves.
 */
export function projectQuants(moves: Move[]): Quant[] {
  let quants: Quant[] = [];
  for (const move of moves) {
    quants = applyMoveToQuants(quants, move);
  }
  return quants;
}
