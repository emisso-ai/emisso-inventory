/**
 * Operation confirmation — recording yield, scrap, and time.
 */

import type { ProductionOrder } from '../types.js';

// ---------------------------------------------------------------------------
// Operation confirmation
// ---------------------------------------------------------------------------

/**
 * Confirm an operation (record actual yield, scrap, time).
 * Updates the matching operation's confirmed values.
 */
export function confirmOperation(
  order: ProductionOrder,
  operationId: string,
  confirmation: {
    yield: number;
    scrap: number;
    time: number;
  },
): ProductionOrder {
  const opIndex = order.operations.findIndex((o) => o.id === operationId);
  if (opIndex === -1) {
    throw new Error(`Operation not found: ${operationId}`);
  }

  const updatedOperations = order.operations.map((op, i) => {
    if (i !== opIndex) return op;
    return {
      ...op,
      confirmedYield: op.confirmedYield + confirmation.yield,
      confirmedScrap: op.confirmedScrap + confirmation.scrap,
      confirmedTime: op.confirmedTime + confirmation.time,
    };
  });

  return { ...order, operations: updatedOperations };
}

// ---------------------------------------------------------------------------
// Component issue
// ---------------------------------------------------------------------------

/**
 * Record goods issue to production order (component consumption).
 * Increases issuedQuantity for the matching component.
 */
export function recordComponentIssue(
  order: ProductionOrder,
  materialId: string,
  quantity: number,
): ProductionOrder {
  const compIndex = order.components.findIndex((c) => c.materialId === materialId);
  if (compIndex === -1) {
    throw new Error(`Component not found: ${materialId}`);
  }

  const updatedComponents = order.components.map((c, i) => {
    if (i !== compIndex) return c;
    return { ...c, issuedQuantity: c.issuedQuantity + quantity };
  });

  return { ...order, components: updatedComponents };
}

// ---------------------------------------------------------------------------
// Goods receipt
// ---------------------------------------------------------------------------

/**
 * Record finished goods receipt from production.
 * Increases receivedQuantity and scrapQuantity on the order.
 */
export function recordGoodsReceipt(
  order: ProductionOrder,
  quantity: number,
  scrap?: number,
): ProductionOrder {
  return {
    ...order,
    receivedQuantity: order.receivedQuantity + quantity,
    scrapQuantity: order.scrapQuantity + (scrap ?? 0),
  };
}
