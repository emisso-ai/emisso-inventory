/**
 * Automatic component consumption based on BOM ratios and confirmed yield.
 *
 * Backflushing calculates what components should have been consumed
 * based on the actual output (yield + scrap), using BOM ratios.
 */

import type { ProductionOrder, ComponentConsumption, Move } from '../types.js';
import { VIRTUAL_LOCATIONS } from '../locations/virtual.js';

// ---------------------------------------------------------------------------
// Calculate backflush
// ---------------------------------------------------------------------------

/**
 * Calculate what components should be consumed based on confirmed yield.
 * Only includes components with backflush = true.
 */
export function calculateBackflush(
  order: ProductionOrder,
  confirmedYield: number,
  confirmedScrap: number,
): ComponentConsumption[] {
  const totalOutput = confirmedYield + confirmedScrap;
  const consumptions: ComponentConsumption[] = [];

  for (const component of order.components) {
    if (!component.backflush) continue;

    const ratio = component.plannedQuantity / order.plannedQuantity;
    const consumeQuantity = Math.round(totalOutput * ratio);
    const alreadyIssued = component.issuedQuantity;
    const netConsumption = Math.max(0, consumeQuantity - alreadyIssued);

    if (netConsumption > 0) {
      consumptions.push({
        materialId: component.materialId,
        quantity: netConsumption,
        unit: component.unit,
        locationId: order.plantLocationId,
      });
    }
  }

  return consumptions;
}

// ---------------------------------------------------------------------------
// Generate backflush moves
// ---------------------------------------------------------------------------

/**
 * Generate moves for backflush consumption (261 preset equivalent).
 * Creates a move from plantLocationId to virtual/production for each consumption.
 */
export function generateBackflushMoves(
  order: ProductionOrder,
  consumptions: ComponentConsumption[],
): Move[] {
  const now = new Date();

  return consumptions.map((c) => ({
    id: crypto.randomUUID(),
    materialId: c.materialId,
    fromLocationId: order.plantLocationId,
    toLocationId: VIRTUAL_LOCATIONS.PRODUCTION,
    quantity: c.quantity,
    unit: c.unit,
    unitCost: null,
    state: 'draft' as const,
    reference: order.id,
    batchId: null,
    presetCode: '261',
    reversalOfId: null,
    routeId: null,
    timestamp: now,
    createdAt: now,
  }));
}
