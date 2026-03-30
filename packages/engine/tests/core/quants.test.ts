import { describe, it, expect } from 'vitest';
import type { Quant, Move } from '../../src/types.js';
import {
  findQuant,
  getAvailableStock,
  getTotalStock,
  getStockByLocation,
  applyMoveToQuants,
  projectQuants,
} from '../../src/quants/quant.js';
import {
  reserveStock,
  unreserveStock,
  autoReserve,
} from '../../src/quants/reservation.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQuant(
  overrides: Partial<Quant> & Pick<Quant, 'materialId' | 'locationId'>,
): Quant {
  return {
    batchId: null,
    quantity: 0,
    reservedQuantity: 0,
    ...overrides,
  };
}

function makeMove(
  overrides: Partial<Move> & Pick<Move, 'materialId' | 'fromLocationId' | 'toLocationId' | 'quantity'>,
): Move {
  return {
    id: 'move-1',
    unit: 'EA',
    unitCost: null,
    state: 'done',
    reference: null,
    batchId: null,
    presetCode: null,
    reversalOfId: null,
    routeId: null,
    timestamp: new Date('2026-01-01'),
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Quant operations
// ---------------------------------------------------------------------------

describe('findQuant', () => {
  const quants: Quant[] = [
    makeQuant({ materialId: 'mat-1', locationId: 'wh-1', batchId: 'batch-A', quantity: 10 }),
    makeQuant({ materialId: 'mat-1', locationId: 'wh-1', batchId: null, quantity: 5 }),
    makeQuant({ materialId: 'mat-2', locationId: 'wh-1', quantity: 20 }),
  ];

  it('finds exact match (material + location + batch)', () => {
    const result = findQuant(quants, 'mat-1', 'wh-1', 'batch-A');
    expect(result).toBeDefined();
    expect(result!.quantity).toBe(10);
    expect(result!.batchId).toBe('batch-A');
  });

  it('returns undefined when not found', () => {
    expect(findQuant(quants, 'mat-99', 'wh-1')).toBeUndefined();
    expect(findQuant(quants, 'mat-1', 'wh-99')).toBeUndefined();
    expect(findQuant(quants, 'mat-1', 'wh-1', 'batch-Z')).toBeUndefined();
  });

  it('matches null batch correctly', () => {
    const result = findQuant(quants, 'mat-1', 'wh-1', null);
    expect(result).toBeDefined();
    expect(result!.quantity).toBe(5);
    expect(result!.batchId).toBeNull();
  });
});

describe('getAvailableStock', () => {
  it('returns quantity minus reserved', () => {
    const quants: Quant[] = [
      makeQuant({ materialId: 'mat-1', locationId: 'wh-1', quantity: 100, reservedQuantity: 30 }),
      makeQuant({ materialId: 'mat-1', locationId: 'wh-1', batchId: 'b1', quantity: 50, reservedQuantity: 10 }),
    ];
    // (100-30) + (50-10) = 70 + 40 = 110
    expect(getAvailableStock(quants, 'mat-1', 'wh-1')).toBe(110);
  });

  it('returns 0 for unknown material', () => {
    expect(getAvailableStock([], 'mat-unknown', 'wh-1')).toBe(0);
  });
});

describe('getTotalStock', () => {
  it('sums across all locations', () => {
    const quants: Quant[] = [
      makeQuant({ materialId: 'mat-1', locationId: 'wh-1', quantity: 50 }),
      makeQuant({ materialId: 'mat-1', locationId: 'wh-2', quantity: 30 }),
      makeQuant({ materialId: 'mat-2', locationId: 'wh-1', quantity: 100 }),
    ];
    expect(getTotalStock(quants, 'mat-1')).toBe(80);
    expect(getTotalStock(quants, 'mat-2')).toBe(100);
  });
});

describe('getStockByLocation', () => {
  it('groups correctly', () => {
    const quants: Quant[] = [
      makeQuant({ materialId: 'mat-1', locationId: 'wh-1', quantity: 50, reservedQuantity: 10 }),
      makeQuant({ materialId: 'mat-1', locationId: 'wh-1', batchId: 'b1', quantity: 20, reservedQuantity: 5 }),
      makeQuant({ materialId: 'mat-1', locationId: 'wh-2', quantity: 30, reservedQuantity: 0 }),
    ];
    const result = getStockByLocation(quants, 'mat-1');
    expect(result).toHaveLength(2);

    const wh1 = result.find((r) => r.locationId === 'wh-1')!;
    expect(wh1.quantity).toBe(70);
    expect(wh1.reservedQuantity).toBe(15);
    expect(wh1.available).toBe(55);

    const wh2 = result.find((r) => r.locationId === 'wh-2')!;
    expect(wh2.quantity).toBe(30);
    expect(wh2.available).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// applyMoveToQuants
// ---------------------------------------------------------------------------

describe('applyMoveToQuants', () => {
  it('receipt from supplier adds to physical location', () => {
    const move = makeMove({
      materialId: 'mat-1',
      fromLocationId: 'virtual/supplier',
      toLocationId: 'wh-1',
      quantity: 100,
    });
    const result = applyMoveToQuants([], move);
    expect(result).toHaveLength(1);
    expect(result[0]!.locationId).toBe('wh-1');
    expect(result[0]!.quantity).toBe(100);
  });

  it('issue to customer removes from physical location', () => {
    const quants: Quant[] = [
      makeQuant({ materialId: 'mat-1', locationId: 'wh-1', quantity: 100 }),
    ];
    const move = makeMove({
      materialId: 'mat-1',
      fromLocationId: 'wh-1',
      toLocationId: 'virtual/customer',
      quantity: 40,
    });
    const result = applyMoveToQuants(quants, move);
    expect(result).toHaveLength(1);
    expect(result[0]!.quantity).toBe(60);
  });

  it('transfer between physical locations decreases source and increases dest', () => {
    const quants: Quant[] = [
      makeQuant({ materialId: 'mat-1', locationId: 'wh-1', quantity: 100 }),
    ];
    const move = makeMove({
      materialId: 'mat-1',
      fromLocationId: 'wh-1',
      toLocationId: 'wh-2',
      quantity: 30,
    });
    const result = applyMoveToQuants(quants, move);
    const wh1 = result.find((q) => q.locationId === 'wh-1')!;
    const wh2 = result.find((q) => q.locationId === 'wh-2')!;
    expect(wh1.quantity).toBe(70);
    expect(wh2.quantity).toBe(30);
  });

  it('creates new quant if none exists', () => {
    const move = makeMove({
      materialId: 'mat-1',
      fromLocationId: 'virtual/supplier',
      toLocationId: 'wh-1',
      quantity: 50,
    });
    const result = applyMoveToQuants([], move);
    expect(result).toHaveLength(1);
    expect(result[0]!.materialId).toBe('mat-1');
    expect(result[0]!.locationId).toBe('wh-1');
    expect(result[0]!.quantity).toBe(50);
  });

  it('only applies done moves', () => {
    const move = makeMove({
      materialId: 'mat-1',
      fromLocationId: 'virtual/supplier',
      toLocationId: 'wh-1',
      quantity: 100,
      state: 'confirmed',
    });
    const result = applyMoveToQuants([], move);
    expect(result).toHaveLength(0);
  });

  it('handles batch correctly', () => {
    const quants: Quant[] = [
      makeQuant({ materialId: 'mat-1', locationId: 'wh-1', batchId: 'batch-A', quantity: 50 }),
      makeQuant({ materialId: 'mat-1', locationId: 'wh-1', batchId: null, quantity: 30 }),
    ];
    const move = makeMove({
      materialId: 'mat-1',
      fromLocationId: 'wh-1',
      toLocationId: 'virtual/customer',
      quantity: 10,
      batchId: 'batch-A',
    });
    const result = applyMoveToQuants(quants, move);
    const batchA = result.find((q) => q.batchId === 'batch-A')!;
    const noBatch = result.find((q) => q.batchId === null)!;
    expect(batchA.quantity).toBe(40);
    expect(noBatch.quantity).toBe(30); // unchanged
  });

  it('virtual to virtual has no quant effect', () => {
    const move = makeMove({
      materialId: 'mat-1',
      fromLocationId: 'virtual/production',
      toLocationId: 'virtual/scrap',
      quantity: 10,
    });
    const result = applyMoveToQuants([], move);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// projectQuants
// ---------------------------------------------------------------------------

describe('projectQuants', () => {
  it('rebuilds from scratch', () => {
    const moves: Move[] = [
      makeMove({ id: 'm1', materialId: 'mat-1', fromLocationId: 'virtual/supplier', toLocationId: 'wh-1', quantity: 100 }),
      makeMove({ id: 'm2', materialId: 'mat-1', fromLocationId: 'wh-1', toLocationId: 'virtual/customer', quantity: 25 }),
    ];
    const quants = projectQuants(moves);
    expect(quants).toHaveLength(1);
    expect(quants[0]!.quantity).toBe(75);
  });

  it('handles multiple materials and locations', () => {
    const moves: Move[] = [
      makeMove({ id: 'm1', materialId: 'mat-1', fromLocationId: 'virtual/supplier', toLocationId: 'wh-1', quantity: 100 }),
      makeMove({ id: 'm2', materialId: 'mat-2', fromLocationId: 'virtual/supplier', toLocationId: 'wh-1', quantity: 50 }),
      makeMove({ id: 'm3', materialId: 'mat-1', fromLocationId: 'wh-1', toLocationId: 'wh-2', quantity: 30 }),
      makeMove({ id: 'm4', materialId: 'mat-1', fromLocationId: 'wh-1', toLocationId: 'virtual/customer', quantity: 20, state: 'confirmed' }), // not done
    ];
    const quants = projectQuants(moves);

    const mat1wh1 = quants.find((q) => q.materialId === 'mat-1' && q.locationId === 'wh-1')!;
    const mat1wh2 = quants.find((q) => q.materialId === 'mat-1' && q.locationId === 'wh-2')!;
    const mat2wh1 = quants.find((q) => q.materialId === 'mat-2' && q.locationId === 'wh-1')!;

    expect(mat1wh1.quantity).toBe(70); // 100 - 30
    expect(mat1wh2.quantity).toBe(30);
    expect(mat2wh1.quantity).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// Reservation
// ---------------------------------------------------------------------------

describe('reserveStock', () => {
  it('increases reservedQuantity', () => {
    const quants: Quant[] = [
      makeQuant({ materialId: 'mat-1', locationId: 'wh-1', quantity: 100, reservedQuantity: 0 }),
    ];
    const { newQuants } = reserveStock(quants, 'mat-1', 'wh-1', 30);
    expect(newQuants[0]!.reservedQuantity).toBe(30);
  });

  it('returns fullyReserved=true when enough stock', () => {
    const quants: Quant[] = [
      makeQuant({ materialId: 'mat-1', locationId: 'wh-1', quantity: 100, reservedQuantity: 0 }),
    ];
    const { fullyReserved } = reserveStock(quants, 'mat-1', 'wh-1', 50);
    expect(fullyReserved).toBe(true);
  });

  it('returns fullyReserved=false when insufficient stock', () => {
    const quants: Quant[] = [
      makeQuant({ materialId: 'mat-1', locationId: 'wh-1', quantity: 100, reservedQuantity: 80 }),
    ];
    const { fullyReserved } = reserveStock(quants, 'mat-1', 'wh-1', 50);
    expect(fullyReserved).toBe(false);
  });
});

describe('unreserveStock', () => {
  it('decreases reservedQuantity', () => {
    const quants: Quant[] = [
      makeQuant({ materialId: 'mat-1', locationId: 'wh-1', quantity: 100, reservedQuantity: 30 }),
    ];
    const result = unreserveStock(quants, 'mat-1', 'wh-1', 10);
    expect(result[0]!.reservedQuantity).toBe(20);
  });

  it('never goes below 0', () => {
    const quants: Quant[] = [
      makeQuant({ materialId: 'mat-1', locationId: 'wh-1', quantity: 100, reservedQuantity: 5 }),
    ];
    const result = unreserveStock(quants, 'mat-1', 'wh-1', 20);
    expect(result[0]!.reservedQuantity).toBe(0);
  });
});

describe('autoReserve', () => {
  it('finds best quant (most available stock)', () => {
    const quants: Quant[] = [
      makeQuant({ materialId: 'mat-1', locationId: 'wh-1', quantity: 50, reservedQuantity: 10 }),
      makeQuant({ materialId: 'mat-1', locationId: 'wh-2', quantity: 100, reservedQuantity: 0 }),
    ];
    const result = autoReserve(quants, 'mat-1', 30);
    expect(result).not.toBeNull();
    expect(result!.locationId).toBe('wh-2'); // 100 available vs 40
    expect(result!.reserved).toBe(30);
  });

  it('prefers specified location', () => {
    const quants: Quant[] = [
      makeQuant({ materialId: 'mat-1', locationId: 'wh-1', quantity: 50, reservedQuantity: 0 }),
      makeQuant({ materialId: 'mat-1', locationId: 'wh-2', quantity: 100, reservedQuantity: 0 }),
    ];
    const result = autoReserve(quants, 'mat-1', 30, 'wh-1');
    expect(result).not.toBeNull();
    expect(result!.locationId).toBe('wh-1');
    expect(result!.reserved).toBe(30);
  });

  it('returns null when no stock available', () => {
    const quants: Quant[] = [
      makeQuant({ materialId: 'mat-1', locationId: 'wh-1', quantity: 10, reservedQuantity: 10 }),
    ];
    const result = autoReserve(quants, 'mat-1', 5);
    expect(result).toBeNull();
  });
});
