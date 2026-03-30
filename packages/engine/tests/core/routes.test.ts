import { describe, it, expect } from 'vitest';
import type { Move } from '../../src/types.js';
import { createMove } from '../../src/moves/move.js';
import { defineRoute, applyRoute, findMatchingRoute } from '../../src/routes/route.js';
import {
  oneStepReceipt,
  twoStepReceipt,
  threeStepReceipt,
  oneStepDelivery,
  twoStepDelivery,
  threeStepDelivery,
} from '../../src/routes/rules.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeMove(overrides?: Partial<Move>): Move {
  return createMove({
    materialId: 'mat-001',
    fromLocationId: 'virtual/supplier',
    toLocationId: 'warehouse/stock',
    quantity: 10,
    unit: 'EA',
    unitCost: 500,
    reference: 'PO-001',
    batchId: 'batch-A',
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// defineRoute
// ---------------------------------------------------------------------------

describe('defineRoute', () => {
  it('creates a valid Route object', () => {
    const route = defineRoute({
      name: 'Test Route',
      steps: [
        { fromLocationId: 'A', toLocationId: 'B', trigger: 'push' },
      ],
    });

    expect(route.name).toBe('Test Route');
    expect(route.steps).toHaveLength(1);
    expect(route.steps[0]!.fromLocationId).toBe('A');
    expect(route.steps[0]!.toLocationId).toBe('B');
    expect(route.steps[0]!.trigger).toBe('push');
    expect(route.active).toBe(true);
  });

  it('generates a unique ID', () => {
    const r1 = defineRoute({ name: 'R1', steps: [{ fromLocationId: 'A', toLocationId: 'B', trigger: 'push' }] });
    const r2 = defineRoute({ name: 'R2', steps: [{ fromLocationId: 'A', toLocationId: 'B', trigger: 'push' }] });
    expect(r1.id).not.toBe(r2.id);
  });
});

// ---------------------------------------------------------------------------
// applyRoute
// ---------------------------------------------------------------------------

describe('applyRoute', () => {
  it('expands a 2-step route into 2 moves', () => {
    const route = twoStepReceipt();
    const move = makeMove();
    const moves = applyRoute(route, move);
    expect(moves).toHaveLength(2);
  });

  it('expands a 3-step route into 3 moves', () => {
    const route = threeStepReceipt();
    const move = makeMove();
    const moves = applyRoute(route, move);
    expect(moves).toHaveLength(3);
  });

  it('preserves materialId, quantity, unitCost, reference across all moves', () => {
    const route = threeStepReceipt();
    const move = makeMove();
    const moves = applyRoute(route, move);

    for (const m of moves) {
      expect(m.materialId).toBe('mat-001');
      expect(m.quantity).toBe(10);
      expect(m.unitCost).toBe(500);
      expect(m.reference).toBe('PO-001');
      expect(m.batchId).toBe('batch-A');
      expect(m.unit).toBe('EA');
    }
  });

  it('gives each move a unique ID', () => {
    const route = threeStepReceipt();
    const move = makeMove();
    const moves = applyRoute(route, move);
    const ids = moves.map((m) => m.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('sets all moves to draft state', () => {
    const route = twoStepReceipt();
    const move = makeMove();
    const moves = applyRoute(route, move);
    for (const m of moves) {
      expect(m.state).toBe('draft');
    }
  });

  it('returns 1 move for a 1-step route', () => {
    const route = oneStepReceipt();
    const move = makeMove();
    const moves = applyRoute(route, move);
    expect(moves).toHaveLength(1);
  });

  it('assigns the route ID to each generated move', () => {
    const route = twoStepReceipt();
    const move = makeMove();
    const moves = applyRoute(route, move);
    for (const m of moves) {
      expect(m.routeId).toBe(route.id);
    }
  });

  it('maps step locations to move locations in order', () => {
    const route = threeStepReceipt();
    const move = makeMove();
    const moves = applyRoute(route, move);

    expect(moves[0]!.fromLocationId).toBe('virtual/supplier');
    expect(moves[0]!.toLocationId).toBe('warehouse/input');
    expect(moves[1]!.fromLocationId).toBe('warehouse/input');
    expect(moves[1]!.toLocationId).toBe('warehouse/qc');
    expect(moves[2]!.fromLocationId).toBe('warehouse/qc');
    expect(moves[2]!.toLocationId).toBe('warehouse/stock');
  });
});

// ---------------------------------------------------------------------------
// findMatchingRoute
// ---------------------------------------------------------------------------

describe('findMatchingRoute', () => {
  it('finds the correct route', () => {
    const receipt = oneStepReceipt();
    const delivery = oneStepDelivery();
    const routes = [receipt, delivery];

    const found = findMatchingRoute(routes, 'virtual/supplier', 'warehouse/stock');
    expect(found).toBeDefined();
    expect(found!.id).toBe(receipt.id);
  });

  it('returns undefined when no match', () => {
    const routes = [oneStepReceipt()];
    const found = findMatchingRoute(routes, 'warehouse/stock', 'virtual/customer');
    expect(found).toBeUndefined();
  });

  it('skips inactive routes', () => {
    const route = oneStepReceipt();
    route.active = false;
    const found = findMatchingRoute([route], 'virtual/supplier', 'warehouse/stock');
    expect(found).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Route templates (rules)
// ---------------------------------------------------------------------------

describe('oneStepReceipt', () => {
  it('creates a 1-step receipt route', () => {
    const route = oneStepReceipt();
    expect(route.steps).toHaveLength(1);
    expect(route.steps[0]!.fromLocationId).toBe('virtual/supplier');
    expect(route.steps[0]!.toLocationId).toBe('warehouse/stock');
  });
});

describe('twoStepReceipt', () => {
  it('creates a 2-step receipt route', () => {
    const route = twoStepReceipt();
    expect(route.steps).toHaveLength(2);
    expect(route.steps[0]!.fromLocationId).toBe('virtual/supplier');
    expect(route.steps[0]!.toLocationId).toBe('warehouse/input');
    expect(route.steps[1]!.fromLocationId).toBe('warehouse/input');
    expect(route.steps[1]!.toLocationId).toBe('warehouse/stock');
  });
});

describe('threeStepReceipt', () => {
  it('creates a 3-step receipt route with QC', () => {
    const route = threeStepReceipt();
    expect(route.steps).toHaveLength(3);
    expect(route.steps[0]!.fromLocationId).toBe('virtual/supplier');
    expect(route.steps[1]!.fromLocationId).toBe('warehouse/input');
    expect(route.steps[1]!.toLocationId).toBe('warehouse/qc');
    expect(route.steps[2]!.toLocationId).toBe('warehouse/stock');
  });
});

describe('oneStepDelivery', () => {
  it('creates a 1-step delivery route', () => {
    const route = oneStepDelivery();
    expect(route.steps).toHaveLength(1);
    expect(route.steps[0]!.fromLocationId).toBe('warehouse/stock');
    expect(route.steps[0]!.toLocationId).toBe('virtual/customer');
  });
});

describe('twoStepDelivery', () => {
  it('creates a 2-step delivery route', () => {
    const route = twoStepDelivery();
    expect(route.steps).toHaveLength(2);
    expect(route.steps[0]!.fromLocationId).toBe('warehouse/stock');
    expect(route.steps[0]!.toLocationId).toBe('warehouse/output');
    expect(route.steps[1]!.fromLocationId).toBe('warehouse/output');
    expect(route.steps[1]!.toLocationId).toBe('virtual/customer');
  });
});

describe('threeStepDelivery', () => {
  it('creates a 3-step delivery route with pick and pack', () => {
    const route = threeStepDelivery();
    expect(route.steps).toHaveLength(3);
    expect(route.steps[0]!.fromLocationId).toBe('warehouse/stock');
    expect(route.steps[0]!.toLocationId).toBe('warehouse/pick');
    expect(route.steps[1]!.fromLocationId).toBe('warehouse/pick');
    expect(route.steps[1]!.toLocationId).toBe('warehouse/pack');
    expect(route.steps[2]!.fromLocationId).toBe('warehouse/pack');
    expect(route.steps[2]!.toLocationId).toBe('virtual/customer');
  });
});
