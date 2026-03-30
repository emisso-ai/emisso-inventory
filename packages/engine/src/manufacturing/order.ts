/**
 * Production order lifecycle — state machine and creation.
 */

import type { ProductionOrder, ProductionOrderStatus, BOM } from '../types.js';

// ---------------------------------------------------------------------------
// Valid transitions
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<ProductionOrderStatus, ProductionOrderStatus[]> = {
  'created': ['released', 'closed'],
  'released': ['partially-confirmed', 'confirmed', 'closed'],
  'partially-confirmed': ['confirmed', 'closed'],
  'confirmed': ['technically-complete', 'closed'],
  'technically-complete': ['closed'],
  'closed': [],
};

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Create a production order from a BOM.
 * Explodes the BOM to populate components scaled to the requested quantity.
 */
export function createProductionOrder(params: {
  materialId: string;
  quantity: number;
  unit: string;
  bom: BOM;
  plantLocationId: string;
  operations?: Array<{
    id: string;
    sequence: number;
    description: string;
    workCenterId?: string;
    plannedTime: number;
  }>;
}): ProductionOrder {
  const { materialId, quantity, unit, bom, plantLocationId, operations } = params;

  // Explode BOM: scale component quantities from base quantity to order quantity
  const scaleFactor = quantity / bom.baseQuantity;

  const components = bom.components.map((c) => ({
    materialId: c.materialId,
    plannedQuantity: Math.round(c.quantity * scaleFactor),
    issuedQuantity: 0,
    unit: c.unit,
    backflush: c.backflush,
  }));

  const orderOperations = (operations ?? []).map((op) => ({
    id: op.id,
    sequence: op.sequence,
    description: op.description,
    workCenterId: op.workCenterId ?? null,
    plannedTime: op.plannedTime,
    confirmedTime: 0,
    confirmedYield: 0,
    confirmedScrap: 0,
  }));

  return {
    id: crypto.randomUUID(),
    materialId,
    plantLocationId,
    plannedQuantity: quantity,
    unit,
    status: 'created',
    bomId: bom.id,
    components,
    operations: orderOperations,
    receivedQuantity: 0,
    scrapQuantity: 0,
    startDate: null,
    endDate: null,
    createdAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

/**
 * Transition order to next status.
 * Throws on invalid transitions.
 */
export function transitionOrder(
  order: ProductionOrder,
  toStatus: ProductionOrderStatus,
): ProductionOrder {
  const allowed = VALID_TRANSITIONS[order.status];
  if (!allowed.includes(toStatus)) {
    throw new Error(
      `Invalid transition: ${order.status} → ${toStatus}`,
    );
  }
  return { ...order, status: toStatus };
}

/**
 * Release an order (shorthand for transition to 'released').
 */
export function releaseOrder(order: ProductionOrder): ProductionOrder {
  return transitionOrder(order, 'released');
}

// ---------------------------------------------------------------------------
// Completion
// ---------------------------------------------------------------------------

/**
 * Get the completion percentage of an order.
 */
export function getOrderCompletion(order: ProductionOrder): {
  yieldPercentage: number;
  componentIssuePercentage: number;
  timePercentage: number;
} {
  // Yield: receivedQuantity / plannedQuantity
  const yieldPercentage =
    order.plannedQuantity > 0
      ? (order.receivedQuantity / order.plannedQuantity) * 100
      : 0;

  // Component issue: sum(issuedQty) / sum(plannedQty)
  const totalPlanned = order.components.reduce((s, c) => s + c.plannedQuantity, 0);
  const totalIssued = order.components.reduce((s, c) => s + c.issuedQuantity, 0);
  const componentIssuePercentage =
    totalPlanned > 0 ? (totalIssued / totalPlanned) * 100 : 0;

  // Time: sum(confirmedTime) / sum(plannedTime)
  const totalPlannedTime = order.operations.reduce((s, o) => s + o.plannedTime, 0);
  const totalConfirmedTime = order.operations.reduce((s, o) => s + o.confirmedTime, 0);
  const timePercentage =
    totalPlannedTime > 0 ? (totalConfirmedTime / totalPlannedTime) * 100 : 0;

  return { yieldPercentage, componentIssuePercentage, timePercentage };
}
