/**
 * Composable multi-step routes.
 *
 * A route defines a chain of intermediate locations that material must pass
 * through between a source and a destination. When applied, a single logical
 * move is expanded into one draft move per step.
 */

import type { Route, RouteStep, Move } from '../types.js';
import { generateId } from '../moves/move.js';

// ---------------------------------------------------------------------------
// Define
// ---------------------------------------------------------------------------

/** Create a route definition with a unique ID. */
export function defineRoute(params: {
  name: string;
  steps: Array<{
    fromLocationId: string;
    toLocationId: string;
    trigger: 'push' | 'pull';
  }>;
}): Route {
  return {
    id: generateId('route'),
    name: params.name,
    steps: params.steps.map((s) => ({
      fromLocationId: s.fromLocationId,
      toLocationId: s.toLocationId,
      trigger: s.trigger,
    })),
    active: true,
  };
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

/**
 * Expand a single move into multiple moves based on a route.
 *
 * The initial move defines the material, quantity, and reference.
 * The route defines the intermediate steps.
 * Returns an array of moves in 'draft' state, one per step.
 */
export function applyRoute(route: Route, initialMove: Move): Move[] {
  const now = new Date();

  return route.steps.map((step) => ({
    id: generateId('mov'),
    materialId: initialMove.materialId,
    fromLocationId: step.fromLocationId,
    toLocationId: step.toLocationId,
    quantity: initialMove.quantity,
    unit: initialMove.unit,
    unitCost: initialMove.unitCost,
    state: 'draft' as const,
    reference: initialMove.reference,
    batchId: initialMove.batchId,
    presetCode: null,
    reversalOfId: null,
    routeId: route.id,
    timestamp: initialMove.timestamp,
    createdAt: now,
  }));
}

// ---------------------------------------------------------------------------
// Match
// ---------------------------------------------------------------------------

/**
 * Find which route applies to a move based on from/to locations.
 *
 * A route matches when its first step's fromLocationId equals the given
 * fromLocationId and its last step's toLocationId equals the given
 * toLocationId.
 *
 * Returns the first matching active route, or undefined.
 */
export function findMatchingRoute(
  routes: Route[],
  fromLocationId: string,
  toLocationId: string,
): Route | undefined {
  return routes.find((route) => {
    if (!route.active) return false;
    const first = route.steps[0];
    const last = route.steps[route.steps.length - 1];
    return (
      first !== undefined &&
      last !== undefined &&
      first.fromLocationId === fromLocationId &&
      last.toLocationId === toLocationId
    );
  });
}
