/**
 * Pre-built route templates for common warehouse configurations.
 *
 * Each function returns a Route with conventional location IDs.
 * Consumers can customise location IDs after creation if their
 * warehouse uses different naming.
 */

import type { Route } from '../types.js';
import { defineRoute } from './route.js';

// ---------------------------------------------------------------------------
// Receipt routes
// ---------------------------------------------------------------------------

/** One-step receipt: virtual/supplier -> warehouse/stock */
export function oneStepReceipt(): Route {
  return defineRoute({
    name: 'Receipt: 1-step',
    steps: [
      { fromLocationId: 'virtual/supplier', toLocationId: 'warehouse/stock', trigger: 'push' },
    ],
  });
}

/** Two-step receipt: virtual/supplier -> warehouse/input -> warehouse/stock */
export function twoStepReceipt(): Route {
  return defineRoute({
    name: 'Receipt: 2-step',
    steps: [
      { fromLocationId: 'virtual/supplier', toLocationId: 'warehouse/input', trigger: 'push' },
      { fromLocationId: 'warehouse/input', toLocationId: 'warehouse/stock', trigger: 'pull' },
    ],
  });
}

/** Three-step receipt: virtual/supplier -> warehouse/input -> warehouse/qc -> warehouse/stock */
export function threeStepReceipt(): Route {
  return defineRoute({
    name: 'Receipt: 3-step',
    steps: [
      { fromLocationId: 'virtual/supplier', toLocationId: 'warehouse/input', trigger: 'push' },
      { fromLocationId: 'warehouse/input', toLocationId: 'warehouse/qc', trigger: 'pull' },
      { fromLocationId: 'warehouse/qc', toLocationId: 'warehouse/stock', trigger: 'pull' },
    ],
  });
}

// ---------------------------------------------------------------------------
// Delivery routes
// ---------------------------------------------------------------------------

/** One-step delivery: warehouse/stock -> virtual/customer */
export function oneStepDelivery(): Route {
  return defineRoute({
    name: 'Delivery: 1-step',
    steps: [
      { fromLocationId: 'warehouse/stock', toLocationId: 'virtual/customer', trigger: 'pull' },
    ],
  });
}

/** Two-step delivery: warehouse/stock -> warehouse/output -> virtual/customer */
export function twoStepDelivery(): Route {
  return defineRoute({
    name: 'Delivery: 2-step',
    steps: [
      { fromLocationId: 'warehouse/stock', toLocationId: 'warehouse/output', trigger: 'push' },
      { fromLocationId: 'warehouse/output', toLocationId: 'virtual/customer', trigger: 'pull' },
    ],
  });
}

/** Three-step delivery: warehouse/stock -> warehouse/pick -> warehouse/pack -> virtual/customer */
export function threeStepDelivery(): Route {
  return defineRoute({
    name: 'Delivery: 3-step',
    steps: [
      { fromLocationId: 'warehouse/stock', toLocationId: 'warehouse/pick', trigger: 'push' },
      { fromLocationId: 'warehouse/pick', toLocationId: 'warehouse/pack', trigger: 'push' },
      { fromLocationId: 'warehouse/pack', toLocationId: 'virtual/customer', trigger: 'pull' },
    ],
  });
}
