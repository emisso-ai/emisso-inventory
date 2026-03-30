/**
 * Core move creation and execution.
 *
 * A move transitions material between locations (physical or virtual).
 * The main `applyMove` function runs a move to completion and returns
 * all side-effects: updated quants, valuation layers, accounting entries,
 * and an event.
 */

import type {
  Move,
  MoveState,
  MoveEvent,
  Quant,
  ValuationLayer,
  Material,
  AccountingEntry,
} from '../types.js';
import { multiply } from '../money.js';
import { isVirtualLocation } from '../locations/virtual.js';
import { applyMoveToQuants } from '../quants/quant.js';
import { consumeFIFO } from '../valuation/fifo.js';
import { createValuationLayer } from '../valuation/layer.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a unique ID with optional prefix. */
export function generateId(prefix?: string): string {
  const rand = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return prefix ? `${prefix}-${rand}` : rand;
}

export { isVirtualLocation };

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<MoveState, MoveState[]> = {
  draft: ['confirmed', 'cancelled'],
  confirmed: ['assigned', 'cancelled'],
  assigned: ['done', 'cancelled'],
  done: [],
  cancelled: [],
};

/**
 * Transition a move to the next state.
 * Throws on invalid transitions.
 */
export function transitionMove(move: Move, toState: MoveState): Move {
  const allowed = VALID_TRANSITIONS[move.state];
  if (!allowed.includes(toState)) {
    throw new Error(
      `Invalid state transition: ${move.state} → ${toState}`,
    );
  }
  return { ...move, state: toState };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/** Create a move in 'draft' state. */
export function createMove(params: {
  materialId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  unit?: string;
  unitCost?: number | null;
  reference?: string | null;
  batchId?: string | null;
  presetCode?: string | null;
  timestamp?: Date;
}): Move {
  const now = new Date();
  return {
    id: generateId('mov'),
    materialId: params.materialId,
    fromLocationId: params.fromLocationId,
    toLocationId: params.toLocationId,
    quantity: params.quantity,
    unit: params.unit ?? 'EA',
    unitCost: params.unitCost ?? null,
    state: 'draft',
    reference: params.reference ?? null,
    batchId: params.batchId ?? null,
    presetCode: params.presetCode ?? null,
    reversalOfId: null,
    routeId: null,
    timestamp: params.timestamp ?? now,
    createdAt: now,
  };
}

// ---------------------------------------------------------------------------
// Detect move type from virtual locations
// ---------------------------------------------------------------------------

function extractVirtualType(locationId: string): string | null {
  if (!isVirtualLocation(locationId)) return null;
  return locationId.split('/')[1] ?? null;
}

// ---------------------------------------------------------------------------
// Apply move
// ---------------------------------------------------------------------------

/**
 * Apply a move to completion.
 *
 * Transitions the move to 'done', updates quants, handles valuation,
 * generates accounting entries, and emits a MoveEvent.
 */
export function applyMove(
  move: Move,
  quants: Quant[],
  valuationLayers: ValuationLayer[],
  material: Material,
): {
  move: Move;
  newQuants: Quant[];
  newLayers: ValuationLayer[];
  event: MoveEvent;
  accountingEntries: AccountingEntry[];
} {
  // 1. Transition to done
  let m = { ...move };
  if (m.state === 'draft') m = transitionMove(m, 'confirmed');
  if (m.state === 'confirmed') m = transitionMove(m, 'assigned');
  if (m.state === 'assigned') m = transitionMove(m, 'done');

  const fromVirtual = isVirtualLocation(m.fromLocationId);
  const toVirtual = isVirtualLocation(m.toLocationId);

  // 2. Update quants (delegate to canonical quants module)
  const newQuants = applyMoveToQuants(quants, m);

  // 3. Handle valuation
  let newLayers = valuationLayers.map((l) => ({ ...l }));
  let valuationLayerId: string | null = null;
  let totalCost = 0;
  const accountingEntries: AccountingEntry[] = [];

  if (fromVirtual && !toVirtual) {
    // Receipt (virtual → physical): create valuation layer
    const layer = createValuationLayer(m);
    valuationLayerId = layer.id;
    totalCost = layer.totalValue;
    newLayers.push(layer);

    // Accounting: inventory debit + GRN clearing
    accountingEntries.push(
      {
        type: 'inventory-debit',
        amount: totalCost,
        materialId: m.materialId,
        moveId: m.id,
        reference: m.reference,
      },
      {
        type: 'grn-clearing',
        amount: -totalCost,
        materialId: m.materialId,
        moveId: m.id,
        reference: m.reference,
      },
    );

    // Standard price variance
    if (material.valuationMethod === 'standard' && material.standardPrice !== null) {
      const standardTotal = multiply(m.quantity, material.standardPrice);
      const variance = totalCost - standardTotal;
      if (variance !== 0) {
        accountingEntries.push({
          type: 'price-difference',
          amount: variance,
          materialId: m.materialId,
          moveId: m.id,
          reference: m.reference,
        });
      }
    }
  } else if (!fromVirtual && toVirtual) {
    // Issue / Sale / Scrap (physical → virtual): consume layers via canonical FIFO
    const result = consumeFIFO(newLayers, m.materialId, m.quantity);
    newLayers = result.updatedLayers;
    totalCost = result.totalCost;
    valuationLayerId = result.consumed.length > 0 ? result.consumed[0]!.layerId : null;

    const virtualType = extractVirtualType(m.toLocationId);

    if (virtualType === 'customer') {
      accountingEntries.push(
        {
          type: 'cogs',
          amount: totalCost,
          materialId: m.materialId,
          moveId: m.id,
          reference: m.reference,
        },
        {
          type: 'inventory-credit',
          amount: -totalCost,
          materialId: m.materialId,
          moveId: m.id,
          reference: m.reference,
        },
      );
    } else if (virtualType === 'scrap') {
      accountingEntries.push(
        {
          type: 'scrap-expense',
          amount: totalCost,
          materialId: m.materialId,
          moveId: m.id,
          reference: m.reference,
        },
        {
          type: 'inventory-credit',
          amount: -totalCost,
          materialId: m.materialId,
          moveId: m.id,
          reference: m.reference,
        },
      );
    } else {
      accountingEntries.push({
        type: 'inventory-credit',
        amount: -totalCost,
        materialId: m.materialId,
        moveId: m.id,
        reference: m.reference,
      });
    }
  }
  // Transfer (physical → physical): no valuation change, no accounting

  // 5. Emit event
  const event: MoveEvent = {
    id: generateId('evt'),
    moveId: m.id,
    materialId: m.materialId,
    fromLocationId: m.fromLocationId,
    toLocationId: m.toLocationId,
    quantity: m.quantity,
    unitCost: m.unitCost,
    presetCode: m.presetCode,
    reference: m.reference,
    batchId: m.batchId,
    valuationLayerId,
    accountingEntries,
    timestamp: m.timestamp,
  };

  return {
    move: m,
    newQuants,
    newLayers,
    event,
    accountingEntries,
  };
}
