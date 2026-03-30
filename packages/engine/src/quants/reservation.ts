/**
 * Stock reservation — reserve and unreserve stock for confirmed moves.
 *
 * Reservations increase `reservedQuantity` on a quant to indicate
 * that the stock is spoken-for but not yet physically moved.
 */

import { type Quant } from '../types.js';
import { findQuant } from './quant.js';

/**
 * Reserve stock for a move (move state = confirmed -> assigned).
 * Increases reservedQuantity on the matching source quant.
 *
 * @returns `{ newQuants, fullyReserved }` — fullyReserved is true if enough stock was available.
 */
export function reserveStock(
  quants: Quant[],
  materialId: string,
  locationId: string,
  quantity: number,
  batchId?: string | null,
): { newQuants: Quant[]; fullyReserved: boolean } {
  const existing = findQuant(quants, materialId, locationId, batchId);

  if (!existing) {
    // No quant at this location — cannot reserve
    return { newQuants: quants, fullyReserved: false };
  }

  const available = existing.quantity - existing.reservedQuantity;
  const fullyReserved = available >= quantity;

  const newQuants = quants.map((q) =>
    q === existing
      ? { ...q, reservedQuantity: q.reservedQuantity + quantity }
      : q,
  );

  return { newQuants, fullyReserved };
}

/**
 * Unreserve stock (move cancelled or completed).
 * Decreases reservedQuantity on the matching source quant.
 * Never lets reservedQuantity go below 0.
 */
export function unreserveStock(
  quants: Quant[],
  materialId: string,
  locationId: string,
  quantity: number,
  batchId?: string | null,
): Quant[] {
  const existing = findQuant(quants, materialId, locationId, batchId);

  if (!existing) return quants;

  return quants.map((q) =>
    q === existing
      ? {
          ...q,
          reservedQuantity: Math.max(0, q.reservedQuantity - quantity),
        }
      : q,
  );
}

/**
 * Auto-reserve: find the best quant to reserve from.
 * Strategy: prefer quant with most available stock (simple for now).
 * If a preferredLocationId is given, prefer that location when it has enough stock.
 *
 * @returns The location + batch to reserve from, and how much was reserved, or null if no stock.
 */
export function autoReserve(
  quants: Quant[],
  materialId: string,
  quantity: number,
  preferredLocationId?: string,
): { locationId: string; batchId: string | null; reserved: number } | null {
  const candidates = quants
    .filter((q) => q.materialId === materialId)
    .map((q) => ({
      locationId: q.locationId,
      batchId: q.batchId,
      available: q.quantity - q.reservedQuantity,
    }))
    .filter((c) => c.available > 0);

  if (candidates.length === 0) return null;

  // Sort: preferred location first, then by most available stock
  candidates.sort((a, b) => {
    if (preferredLocationId) {
      const aPreferred = a.locationId === preferredLocationId ? 1 : 0;
      const bPreferred = b.locationId === preferredLocationId ? 1 : 0;
      if (aPreferred !== bPreferred) return bPreferred - aPreferred;
    }
    return b.available - a.available;
  });

  const best = candidates[0]!;
  return {
    locationId: best.locationId,
    batchId: best.batchId,
    reserved: Math.min(best.available, quantity),
  };
}
