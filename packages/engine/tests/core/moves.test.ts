import { describe, it, expect } from 'vitest';
import type { Move, Quant, ValuationLayer, Material } from '../../src/types.js';
import {
  createMove,
  transitionMove,
  applyMove,
  isVirtualLocation,
} from '../../src/moves/move.js';
import { validateMove } from '../../src/moves/validate.js';
import { createReversalMove } from '../../src/moves/reverse.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeMaterial(overrides?: Partial<Material>): Material {
  return {
    id: 'mat-001',
    description: 'Test Material',
    type: 'raw',
    baseUnit: 'EA',
    materialGroup: null,
    valuationMethod: 'fifo',
    standardPrice: null,
    batchManaged: false,
    weight: null,
    weightUnit: null,
    active: true,
    ...overrides,
  };
}

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
    state: 'draft',
    reference: null,
    batchId: null,
    presetCode: null,
    reversalOfId: null,
    routeId: null,
    timestamp: new Date('2026-01-15'),
    createdAt: new Date('2026-01-15'),
    ...overrides,
  };
}

function makeLayer(
  overrides: Partial<ValuationLayer> & Pick<ValuationLayer, 'id' | 'materialId'>,
): ValuationLayer {
  return {
    moveId: 'move-0',
    quantity: 100,
    remainingQty: 100,
    unitCost: 1000,
    totalValue: 100000,
    remainingValue: 100000,
    timestamp: new Date('2026-01-01'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Move creation
// ---------------------------------------------------------------------------

describe('createMove', () => {
  it('creates move in draft state', () => {
    const move = createMove({
      materialId: 'mat-001',
      fromLocationId: 'virtual/supplier',
      toLocationId: 'warehouse/raw',
      quantity: 50,
    });
    expect(move.state).toBe('draft');
  });

  it('sets timestamp to now if not provided', () => {
    const before = new Date();
    const move = createMove({
      materialId: 'mat-001',
      fromLocationId: 'virtual/supplier',
      toLocationId: 'warehouse/raw',
      quantity: 50,
    });
    const after = new Date();
    expect(move.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(move.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('generates unique ID', () => {
    const m1 = createMove({
      materialId: 'mat-001',
      fromLocationId: 'virtual/supplier',
      toLocationId: 'warehouse/raw',
      quantity: 10,
    });
    const m2 = createMove({
      materialId: 'mat-001',
      fromLocationId: 'virtual/supplier',
      toLocationId: 'warehouse/raw',
      quantity: 10,
    });
    expect(m1.id).not.toBe(m2.id);
  });
});

// ---------------------------------------------------------------------------
// State transitions
// ---------------------------------------------------------------------------

describe('transitionMove', () => {
  it('draft → confirmed works', () => {
    const move = makeMove({
      materialId: 'mat-001',
      fromLocationId: 'virtual/supplier',
      toLocationId: 'warehouse/raw',
      quantity: 10,
      state: 'draft',
    });
    const result = transitionMove(move, 'confirmed');
    expect(result.state).toBe('confirmed');
  });

  it('confirmed → assigned works', () => {
    const move = makeMove({
      materialId: 'mat-001',
      fromLocationId: 'virtual/supplier',
      toLocationId: 'warehouse/raw',
      quantity: 10,
      state: 'confirmed',
    });
    const result = transitionMove(move, 'assigned');
    expect(result.state).toBe('assigned');
  });

  it('assigned → done works', () => {
    const move = makeMove({
      materialId: 'mat-001',
      fromLocationId: 'virtual/supplier',
      toLocationId: 'warehouse/raw',
      quantity: 10,
      state: 'assigned',
    });
    const result = transitionMove(move, 'done');
    expect(result.state).toBe('done');
  });

  it('draft → cancelled works', () => {
    const move = makeMove({
      materialId: 'mat-001',
      fromLocationId: 'virtual/supplier',
      toLocationId: 'warehouse/raw',
      quantity: 10,
      state: 'draft',
    });
    const result = transitionMove(move, 'cancelled');
    expect(result.state).toBe('cancelled');
  });

  it('done → anything throws', () => {
    const move = makeMove({
      materialId: 'mat-001',
      fromLocationId: 'virtual/supplier',
      toLocationId: 'warehouse/raw',
      quantity: 10,
      state: 'done',
    });
    expect(() => transitionMove(move, 'confirmed')).toThrow('Invalid state transition');
    expect(() => transitionMove(move, 'cancelled')).toThrow('Invalid state transition');
  });

  it('draft → done throws (must go through states)', () => {
    const move = makeMove({
      materialId: 'mat-001',
      fromLocationId: 'virtual/supplier',
      toLocationId: 'warehouse/raw',
      quantity: 10,
      state: 'draft',
    });
    expect(() => transitionMove(move, 'done')).toThrow('Invalid state transition');
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('validateMove', () => {
  it('valid receipt move', () => {
    const move = makeMove({
      materialId: 'mat-001',
      fromLocationId: 'virtual/supplier',
      toLocationId: 'warehouse/raw',
      quantity: 50,
      unitCost: 1000,
    });
    const result = validateMove(move, []);
    expect(result.valid).toBe(true);
  });

  it('receipt without unitCost fails', () => {
    const move = makeMove({
      materialId: 'mat-001',
      fromLocationId: 'virtual/supplier',
      toLocationId: 'warehouse/raw',
      quantity: 50,
      unitCost: null,
    });
    const result = validateMove(move, []);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('Unit cost'))).toBe(true);
    }
  });

  it('issue with insufficient stock fails', () => {
    const quants: Quant[] = [
      makeQuant({ materialId: 'mat-001', locationId: 'warehouse/raw', quantity: 10 }),
    ];
    const move = makeMove({
      materialId: 'mat-001',
      fromLocationId: 'warehouse/raw',
      toLocationId: 'virtual/customer',
      quantity: 50,
    });
    const result = validateMove(move, quants);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('Insufficient stock'))).toBe(true);
    }
  });

  it('issue with allowNegativeStock succeeds', () => {
    const quants: Quant[] = [
      makeQuant({ materialId: 'mat-001', locationId: 'warehouse/raw', quantity: 10 }),
    ];
    const move = makeMove({
      materialId: 'mat-001',
      fromLocationId: 'warehouse/raw',
      toLocationId: 'virtual/customer',
      quantity: 50,
    });
    const result = validateMove(move, quants, { allowNegativeStock: true });
    expect(result.valid).toBe(true);
  });

  it('zero quantity fails', () => {
    const move = makeMove({
      materialId: 'mat-001',
      fromLocationId: 'virtual/supplier',
      toLocationId: 'warehouse/raw',
      quantity: 0,
      unitCost: 1000,
    });
    const result = validateMove(move, []);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('Quantity'))).toBe(true);
    }
  });

  it('empty materialId fails', () => {
    const move = makeMove({
      materialId: '',
      fromLocationId: 'virtual/supplier',
      toLocationId: 'warehouse/raw',
      quantity: 10,
      unitCost: 1000,
    });
    const result = validateMove(move, []);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('Material ID'))).toBe(true);
    }
  });

  it('same from/to fails', () => {
    const move = makeMove({
      materialId: 'mat-001',
      fromLocationId: 'warehouse/raw',
      toLocationId: 'warehouse/raw',
      quantity: 10,
    });
    const result = validateMove(move, [
      makeQuant({ materialId: 'mat-001', locationId: 'warehouse/raw', quantity: 100 }),
    ]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('different'))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// applyMove — Receipt (virtual → physical)
// ---------------------------------------------------------------------------

describe('applyMove — Receipt', () => {
  const material = makeMaterial();

  it('quant increases at toLocation', () => {
    const move = makeMove({
      materialId: 'mat-001',
      fromLocationId: 'virtual/supplier',
      toLocationId: 'warehouse/raw',
      quantity: 100,
      unitCost: 1000,
    });
    const { newQuants } = applyMove(move, [], [], material);
    const q = newQuants.find((q) => q.locationId === 'warehouse/raw');
    expect(q).toBeDefined();
    expect(q!.quantity).toBe(100);
  });

  it('creates valuation layer', () => {
    const move = makeMove({
      materialId: 'mat-001',
      fromLocationId: 'virtual/supplier',
      toLocationId: 'warehouse/raw',
      quantity: 50,
      unitCost: 2000,
    });
    const { newLayers } = applyMove(move, [], [], material);
    expect(newLayers).toHaveLength(1);
    expect(newLayers[0]!.materialId).toBe('mat-001');
    expect(newLayers[0]!.quantity).toBe(50);
    expect(newLayers[0]!.unitCost).toBe(2000);
    expect(newLayers[0]!.totalValue).toBe(100000);
    expect(newLayers[0]!.remainingQty).toBe(50);
  });

  it('generates accounting entries (inventory-debit + grn-clearing)', () => {
    const move = makeMove({
      materialId: 'mat-001',
      fromLocationId: 'virtual/supplier',
      toLocationId: 'warehouse/raw',
      quantity: 10,
      unitCost: 500,
    });
    const { accountingEntries } = applyMove(move, [], [], material);
    expect(accountingEntries).toHaveLength(2);
    const debit = accountingEntries.find((e) => e.type === 'inventory-debit');
    const clearing = accountingEntries.find((e) => e.type === 'grn-clearing');
    expect(debit).toBeDefined();
    expect(debit!.amount).toBe(5000);
    expect(clearing).toBeDefined();
    expect(clearing!.amount).toBe(-5000);
  });

  it('move is now in done state', () => {
    const move = makeMove({
      materialId: 'mat-001',
      fromLocationId: 'virtual/supplier',
      toLocationId: 'warehouse/raw',
      quantity: 10,
      unitCost: 500,
    });
    const { move: doneMove } = applyMove(move, [], [], material);
    expect(doneMove.state).toBe('done');
  });
});

// ---------------------------------------------------------------------------
// applyMove — Issue / Sale / Scrap (physical → virtual)
// ---------------------------------------------------------------------------

describe('applyMove — Issue / Sale', () => {
  const material = makeMaterial();
  const initialQuants: Quant[] = [
    makeQuant({ materialId: 'mat-001', locationId: 'warehouse/raw', quantity: 100 }),
  ];
  const initialLayers: ValuationLayer[] = [
    makeLayer({
      id: 'vl-001',
      materialId: 'mat-001',
      moveId: 'mov-receipt-1',
      quantity: 100,
      remainingQty: 100,
      unitCost: 1000,
      totalValue: 100000,
      remainingValue: 100000,
      timestamp: new Date('2026-01-01'),
    }),
  ];

  it('sale: quant decreases at fromLocation', () => {
    const move = makeMove({
      materialId: 'mat-001',
      fromLocationId: 'warehouse/raw',
      toLocationId: 'virtual/customer',
      quantity: 40,
    });
    const { newQuants } = applyMove(move, initialQuants, initialLayers, material);
    const q = newQuants.find((q) => q.locationId === 'warehouse/raw');
    expect(q).toBeDefined();
    expect(q!.quantity).toBe(60);
  });

  it('sale: consumes valuation layers', () => {
    const move = makeMove({
      materialId: 'mat-001',
      fromLocationId: 'warehouse/raw',
      toLocationId: 'virtual/customer',
      quantity: 30,
    });
    const { newLayers } = applyMove(move, initialQuants, initialLayers, material);
    const layer = newLayers.find((l) => l.id === 'vl-001');
    expect(layer).toBeDefined();
    expect(layer!.remainingQty).toBe(70);
  });

  it('sale: generates COGS + inventory-credit entries', () => {
    const move = makeMove({
      materialId: 'mat-001',
      fromLocationId: 'warehouse/raw',
      toLocationId: 'virtual/customer',
      quantity: 20,
    });
    const { accountingEntries } = applyMove(move, initialQuants, initialLayers, material);
    const cogs = accountingEntries.find((e) => e.type === 'cogs');
    const credit = accountingEntries.find((e) => e.type === 'inventory-credit');
    expect(cogs).toBeDefined();
    expect(cogs!.amount).toBe(20000); // 20 * 1000
    expect(credit).toBeDefined();
    expect(credit!.amount).toBe(-20000);
  });

  it('scrap: generates scrap-expense entry', () => {
    const move = makeMove({
      materialId: 'mat-001',
      fromLocationId: 'warehouse/raw',
      toLocationId: 'virtual/scrap',
      quantity: 5,
    });
    const { accountingEntries } = applyMove(move, initialQuants, initialLayers, material);
    const scrapEntry = accountingEntries.find((e) => e.type === 'scrap-expense');
    const credit = accountingEntries.find((e) => e.type === 'inventory-credit');
    expect(scrapEntry).toBeDefined();
    expect(scrapEntry!.amount).toBe(5000); // 5 * 1000
    expect(credit).toBeDefined();
    expect(credit!.amount).toBe(-5000);
  });
});

// ---------------------------------------------------------------------------
// applyMove — Transfer (physical → physical)
// ---------------------------------------------------------------------------

describe('applyMove — Transfer', () => {
  const material = makeMaterial();
  const initialQuants: Quant[] = [
    makeQuant({ materialId: 'mat-001', locationId: 'warehouse/raw', quantity: 100 }),
  ];
  const initialLayers: ValuationLayer[] = [
    makeLayer({
      id: 'vl-001',
      materialId: 'mat-001',
      quantity: 100,
      remainingQty: 100,
      unitCost: 1000,
      totalValue: 100000,
      remainingValue: 100000,
    }),
  ];

  it('decreases source, increases dest', () => {
    const move = makeMove({
      materialId: 'mat-001',
      fromLocationId: 'warehouse/raw',
      toLocationId: 'warehouse/finished',
      quantity: 30,
    });
    const { newQuants } = applyMove(move, initialQuants, initialLayers, material);
    const source = newQuants.find((q) => q.locationId === 'warehouse/raw');
    const dest = newQuants.find((q) => q.locationId === 'warehouse/finished');
    expect(source!.quantity).toBe(70);
    expect(dest!.quantity).toBe(30);
  });

  it('no valuation change', () => {
    const move = makeMove({
      materialId: 'mat-001',
      fromLocationId: 'warehouse/raw',
      toLocationId: 'warehouse/finished',
      quantity: 30,
    });
    const { newLayers } = applyMove(move, initialQuants, initialLayers, material);
    // Layers should be unchanged
    expect(newLayers).toHaveLength(1);
    expect(newLayers[0]!.remainingQty).toBe(100);
  });

  it('no accounting entries', () => {
    const move = makeMove({
      materialId: 'mat-001',
      fromLocationId: 'warehouse/raw',
      toLocationId: 'warehouse/finished',
      quantity: 30,
    });
    const { accountingEntries } = applyMove(move, initialQuants, initialLayers, material);
    expect(accountingEntries).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Reversal
// ---------------------------------------------------------------------------

describe('createReversalMove', () => {
  it('swaps from/to', () => {
    const original = makeMove({
      id: 'mov-original',
      materialId: 'mat-001',
      fromLocationId: 'virtual/supplier',
      toLocationId: 'warehouse/raw',
      quantity: 50,
      unitCost: 1000,
      state: 'done',
    });
    const reversal = createReversalMove(original);
    expect(reversal.fromLocationId).toBe('warehouse/raw');
    expect(reversal.toLocationId).toBe('virtual/supplier');
  });

  it('sets reversalOfId', () => {
    const original = makeMove({
      id: 'mov-original',
      materialId: 'mat-001',
      fromLocationId: 'virtual/supplier',
      toLocationId: 'warehouse/raw',
      quantity: 50,
      unitCost: 1000,
      state: 'done',
    });
    const reversal = createReversalMove(original);
    expect(reversal.reversalOfId).toBe('mov-original');
    expect(reversal.state).toBe('draft');
    expect(reversal.quantity).toBe(50);
    expect(reversal.unitCost).toBe(1000);
    expect(reversal.materialId).toBe('mat-001');
  });

  it('applying reversal undoes the original effect on quants', () => {
    const material = makeMaterial();

    // Original receipt: virtual/supplier → warehouse/raw, qty 50
    const original = makeMove({
      id: 'mov-original',
      materialId: 'mat-001',
      fromLocationId: 'virtual/supplier',
      toLocationId: 'warehouse/raw',
      quantity: 50,
      unitCost: 1000,
    });
    const { newQuants: afterReceipt, newLayers: afterReceiptLayers } = applyMove(
      original,
      [],
      [],
      material,
    );
    expect(afterReceipt.find((q) => q.locationId === 'warehouse/raw')!.quantity).toBe(50);

    // Reversal: warehouse/raw → virtual/supplier, qty 50
    const reversal = createReversalMove({ ...original, state: 'done' });
    const { newQuants: afterReversal } = applyMove(
      reversal,
      afterReceipt,
      afterReceiptLayers,
      material,
    );
    const q = afterReversal.find((q) => q.locationId === 'warehouse/raw');
    expect(q!.quantity).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// isVirtualLocation
// ---------------------------------------------------------------------------

describe('isVirtualLocation', () => {
  it('returns true for virtual locations', () => {
    expect(isVirtualLocation('virtual/supplier')).toBe(true);
    expect(isVirtualLocation('virtual/customer')).toBe(true);
    expect(isVirtualLocation('virtual/scrap')).toBe(true);
  });

  it('returns false for physical locations', () => {
    expect(isVirtualLocation('warehouse/raw')).toBe(false);
    expect(isVirtualLocation('wh-1')).toBe(false);
  });
});
