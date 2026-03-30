/**
 * Physical Inventory document lifecycle.
 *
 * Create → Count → Finalize → Post differences as adjustment moves (701/702).
 */

import type { PIDocument, PIItem, Move, ValuationLayer } from '../types.js';
import { generateId, createMove } from '../moves/move.js';
import { VIRTUAL_LOCATIONS } from '../locations/virtual.js';
import { calculateAdjustmentValue } from './adjustment.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a unique PI document ID. */
export function generatePIDocId(): string {
  return generateId('pi');
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Create a PI document from a list of materials/locations to count.
 * Returns a document in 'open' state with items populated.
 */
export function createPIDocument(
  items: Array<{
    materialId: string;
    locationId: string;
    bookQuantity: number;
    batchId?: string | null;
  }>,
): PIDocument {
  const now = new Date();
  const piItems: PIItem[] = items.map((item) => ({
    materialId: item.materialId,
    locationId: item.locationId,
    bookQuantity: item.bookQuantity,
    countedQuantity: null,
    difference: null,
    batchId: item.batchId ?? null,
  }));

  return {
    id: generatePIDocId(),
    state: 'open',
    items: piItems,
    createdAt: now,
    countedAt: null,
    postedAt: null,
  };
}

// ---------------------------------------------------------------------------
// Count
// ---------------------------------------------------------------------------

/**
 * Enter a count result for one item in the document.
 * Transitions document to 'counting' state on first count entry.
 */
export function enterCount(
  doc: PIDocument,
  materialId: string,
  locationId: string,
  countedQuantity: number,
): PIDocument {
  if (doc.state !== 'open' && doc.state !== 'counting') {
    throw new Error(`Cannot enter count in state '${doc.state}'`);
  }

  const updatedItems = doc.items.map((item) => {
    if (item.materialId === materialId && item.locationId === locationId) {
      return {
        ...item,
        countedQuantity,
        difference: countedQuantity - item.bookQuantity,
      };
    }
    return item;
  });

  return {
    ...doc,
    state: 'counting',
    items: updatedItems,
  };
}

// ---------------------------------------------------------------------------
// Finalize
// ---------------------------------------------------------------------------

/** Check if all items have been counted. */
export function isFullyCounted(doc: PIDocument): boolean {
  return doc.items.every((item) => item.countedQuantity !== null);
}

/**
 * Finalize counting — transitions to 'counted' state.
 * Throws if not all items are counted.
 */
export function finalizeCounting(doc: PIDocument): PIDocument {
  if (!isFullyCounted(doc)) {
    throw new Error('Cannot finalize counting: not all items have been counted');
  }

  return {
    ...doc,
    state: 'counted',
    countedAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Post differences
// ---------------------------------------------------------------------------

/**
 * Post differences — generates adjustment moves (701/702) for each difference.
 * Transitions to 'posted' state.
 */
export function postDifferences(
  doc: PIDocument,
  valuationLayers: ValuationLayer[],
): {
  postedDoc: PIDocument;
  adjustmentMoves: Move[];
  totalPositiveValue: number;
  totalNegativeValue: number;
} {
  if (doc.state !== 'counted') {
    throw new Error(`Cannot post differences in state '${doc.state}'`);
  }

  const adjustmentMoves: Move[] = [];
  let totalPositiveValue = 0;
  let totalNegativeValue = 0;

  for (const item of doc.items) {
    const diff = item.difference ?? 0;
    if (diff === 0) continue;

    if (diff > 0) {
      // Counted > book: gain — move from virtual/inventory-loss to physical location (701)
      const unitCost = calculateAdjustmentValue(item.materialId, 1, valuationLayers);
      const move = createMove({
        materialId: item.materialId,
        fromLocationId: VIRTUAL_LOCATIONS.INVENTORY_LOSS,
        toLocationId: item.locationId,
        quantity: diff,
        unitCost,
        reference: doc.id,
        batchId: item.batchId,
        presetCode: '701',
      });
      adjustmentMoves.push(move);
      totalPositiveValue += calculateAdjustmentValue(item.materialId, diff, valuationLayers);
    } else {
      // Counted < book: loss — move from physical location to virtual/inventory-loss (702)
      const absQty = Math.abs(diff);
      const move = createMove({
        materialId: item.materialId,
        fromLocationId: item.locationId,
        toLocationId: VIRTUAL_LOCATIONS.INVENTORY_LOSS,
        quantity: absQty,
        reference: doc.id,
        batchId: item.batchId,
        presetCode: '702',
      });
      adjustmentMoves.push(move);
      totalNegativeValue += Math.abs(calculateAdjustmentValue(item.materialId, -absQty, valuationLayers));
    }
  }

  const postedDoc: PIDocument = {
    ...doc,
    state: 'posted',
    postedAt: new Date(),
  };

  return { postedDoc, adjustmentMoves, totalPositiveValue, totalNegativeValue };
}
