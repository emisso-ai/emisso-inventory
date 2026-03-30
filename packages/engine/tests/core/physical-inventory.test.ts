import { describe, it, expect } from 'vitest';
import type { ValuationLayer } from '../../src/types.js';
import {
  createPIDocument,
  enterCount,
  isFullyCounted,
  finalizeCounting,
  postDifferences,
} from '../../src/physical-inventory/document.js';
import { calculateAdjustmentValue } from '../../src/physical-inventory/adjustment.js';
import {
  classifyABC,
  generateCycleCountSchedule,
} from '../../src/physical-inventory/cycle-count.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeValuationLayer(
  overrides: Partial<ValuationLayer> & Pick<ValuationLayer, 'materialId'>,
): ValuationLayer {
  const now = new Date();
  return {
    id: 'vl-001',
    moveId: 'mov-001',
    quantity: 100,
    remainingQty: 100,
    unitCost: 1000, // 10.00 in cents
    totalValue: 100_000,
    remainingValue: 100_000,
    timestamp: now,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Document lifecycle
// ---------------------------------------------------------------------------

describe('Physical Inventory — Document lifecycle', () => {
  it('createPIDocument creates document in open state', () => {
    const doc = createPIDocument([
      { materialId: 'mat-001', locationId: 'loc-wh1', bookQuantity: 100 },
    ]);
    expect(doc.state).toBe('open');
    expect(doc.id).toMatch(/^pi-/);
    expect(doc.countedAt).toBeNull();
    expect(doc.postedAt).toBeNull();
  });

  it('createPIDocument populates items with book quantities', () => {
    const doc = createPIDocument([
      { materialId: 'mat-001', locationId: 'loc-wh1', bookQuantity: 100 },
      { materialId: 'mat-002', locationId: 'loc-wh1', bookQuantity: 50, batchId: 'batch-1' },
    ]);
    expect(doc.items).toHaveLength(2);
    expect(doc.items[0]!.bookQuantity).toBe(100);
    expect(doc.items[0]!.countedQuantity).toBeNull();
    expect(doc.items[0]!.difference).toBeNull();
    expect(doc.items[1]!.batchId).toBe('batch-1');
  });

  it('enterCount updates counted quantity for matching item', () => {
    const doc = createPIDocument([
      { materialId: 'mat-001', locationId: 'loc-wh1', bookQuantity: 100 },
    ]);
    const updated = enterCount(doc, 'mat-001', 'loc-wh1', 95);
    expect(updated.items[0]!.countedQuantity).toBe(95);
  });

  it('enterCount calculates positive difference correctly', () => {
    const doc = createPIDocument([
      { materialId: 'mat-001', locationId: 'loc-wh1', bookQuantity: 100 },
    ]);
    const updated = enterCount(doc, 'mat-001', 'loc-wh1', 110);
    expect(updated.items[0]!.difference).toBe(10);
  });

  it('enterCount calculates negative difference correctly', () => {
    const doc = createPIDocument([
      { materialId: 'mat-001', locationId: 'loc-wh1', bookQuantity: 100 },
    ]);
    const updated = enterCount(doc, 'mat-001', 'loc-wh1', 90);
    expect(updated.items[0]!.difference).toBe(-10);
  });

  it('enterCount transitions state to counting', () => {
    const doc = createPIDocument([
      { materialId: 'mat-001', locationId: 'loc-wh1', bookQuantity: 100 },
    ]);
    expect(doc.state).toBe('open');
    const updated = enterCount(doc, 'mat-001', 'loc-wh1', 95);
    expect(updated.state).toBe('counting');
  });

  it('isFullyCounted returns false when items uncounted', () => {
    const doc = createPIDocument([
      { materialId: 'mat-001', locationId: 'loc-wh1', bookQuantity: 100 },
      { materialId: 'mat-002', locationId: 'loc-wh1', bookQuantity: 50 },
    ]);
    const partial = enterCount(doc, 'mat-001', 'loc-wh1', 100);
    expect(isFullyCounted(partial)).toBe(false);
  });

  it('isFullyCounted returns true when all counted', () => {
    const doc = createPIDocument([
      { materialId: 'mat-001', locationId: 'loc-wh1', bookQuantity: 100 },
      { materialId: 'mat-002', locationId: 'loc-wh1', bookQuantity: 50 },
    ]);
    let updated = enterCount(doc, 'mat-001', 'loc-wh1', 100);
    updated = enterCount(updated, 'mat-002', 'loc-wh1', 50);
    expect(isFullyCounted(updated)).toBe(true);
  });

  it('finalizeCounting transitions to counted state', () => {
    const doc = createPIDocument([
      { materialId: 'mat-001', locationId: 'loc-wh1', bookQuantity: 100 },
    ]);
    const counted = enterCount(doc, 'mat-001', 'loc-wh1', 100);
    const finalized = finalizeCounting(counted);
    expect(finalized.state).toBe('counted');
    expect(finalized.countedAt).toBeInstanceOf(Date);
  });

  it('finalizeCounting throws if not all counted', () => {
    const doc = createPIDocument([
      { materialId: 'mat-001', locationId: 'loc-wh1', bookQuantity: 100 },
      { materialId: 'mat-002', locationId: 'loc-wh1', bookQuantity: 50 },
    ]);
    const partial = enterCount(doc, 'mat-001', 'loc-wh1', 100);
    expect(() => finalizeCounting(partial)).toThrow('not all items have been counted');
  });
});

// ---------------------------------------------------------------------------
// Post differences
// ---------------------------------------------------------------------------

describe('Physical Inventory — Post differences', () => {
  function makeCountedDoc(items: Array<{ materialId: string; locationId: string; bookQuantity: number; countedQuantity: number; batchId?: string | null }>) {
    let doc = createPIDocument(
      items.map((i) => ({
        materialId: i.materialId,
        locationId: i.locationId,
        bookQuantity: i.bookQuantity,
        batchId: i.batchId,
      })),
    );
    for (const item of items) {
      doc = enterCount(doc, item.materialId, item.locationId, item.countedQuantity);
    }
    return finalizeCounting(doc);
  }

  const layers: ValuationLayer[] = [
    makeValuationLayer({ materialId: 'mat-001' }),
  ];

  it('generates 701 move for positive difference', () => {
    const doc = makeCountedDoc([
      { materialId: 'mat-001', locationId: 'loc-wh1', bookQuantity: 100, countedQuantity: 110 },
    ]);
    const result = postDifferences(doc, layers);
    expect(result.adjustmentMoves).toHaveLength(1);
    const move = result.adjustmentMoves[0]!;
    expect(move.presetCode).toBe('701');
    expect(move.fromLocationId).toBe('virtual/inventory-loss');
    expect(move.toLocationId).toBe('loc-wh1');
    expect(move.quantity).toBe(10);
    expect(result.totalPositiveValue).toBeGreaterThan(0);
  });

  it('generates 702 move for negative difference', () => {
    const doc = makeCountedDoc([
      { materialId: 'mat-001', locationId: 'loc-wh1', bookQuantity: 100, countedQuantity: 90 },
    ]);
    const result = postDifferences(doc, layers);
    expect(result.adjustmentMoves).toHaveLength(1);
    const move = result.adjustmentMoves[0]!;
    expect(move.presetCode).toBe('702');
    expect(move.fromLocationId).toBe('loc-wh1');
    expect(move.toLocationId).toBe('virtual/inventory-loss');
    expect(move.quantity).toBe(10);
    expect(result.totalNegativeValue).toBeGreaterThan(0);
  });

  it('generates no moves when no differences', () => {
    const doc = makeCountedDoc([
      { materialId: 'mat-001', locationId: 'loc-wh1', bookQuantity: 100, countedQuantity: 100 },
    ]);
    const result = postDifferences(doc, layers);
    expect(result.adjustmentMoves).toHaveLength(0);
    expect(result.totalPositiveValue).toBe(0);
    expect(result.totalNegativeValue).toBe(0);
  });

  it('sets reference to PI doc ID on each move', () => {
    const doc = makeCountedDoc([
      { materialId: 'mat-001', locationId: 'loc-wh1', bookQuantity: 100, countedQuantity: 110 },
    ]);
    const result = postDifferences(doc, layers);
    for (const move of result.adjustmentMoves) {
      expect(move.reference).toBe(doc.id);
    }
  });

  it('transitions to posted state', () => {
    const doc = makeCountedDoc([
      { materialId: 'mat-001', locationId: 'loc-wh1', bookQuantity: 100, countedQuantity: 100 },
    ]);
    const result = postDifferences(doc, layers);
    expect(result.postedDoc.state).toBe('posted');
    expect(result.postedDoc.postedAt).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// Adjustment value
// ---------------------------------------------------------------------------

describe('Physical Inventory — Adjustment value', () => {
  it('calculates positive adjustment using average cost', () => {
    const layers: ValuationLayer[] = [
      makeValuationLayer({ materialId: 'mat-001', remainingQty: 50, unitCost: 1000, remainingValue: 50_000 }),
      makeValuationLayer({ id: 'vl-002', materialId: 'mat-001', remainingQty: 50, unitCost: 2000, remainingValue: 100_000 }),
    ];
    // Average cost = 150_000 / 100 = 1500
    const value = calculateAdjustmentValue('mat-001', 10, layers);
    expect(value).toBe(15000); // 10 * 1500
  });

  it('returns 0 when no layers exist', () => {
    const value = calculateAdjustmentValue('mat-001', 10, []);
    expect(value).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ABC Classification
// ---------------------------------------------------------------------------

describe('Physical Inventory — ABC classification', () => {
  const materials = [
    { materialId: 'mat-A1', annualValue: 50_000 },
    { materialId: 'mat-A2', annualValue: 30_000 },
    { materialId: 'mat-B1', annualValue: 10_000 },
    { materialId: 'mat-B2', annualValue: 5_000 },
    { materialId: 'mat-C1', annualValue: 3_000 },
    { materialId: 'mat-C2', annualValue: 2_000 },
  ];

  it('sorts by value descending', () => {
    const result = classifyABC(materials);
    for (let i = 1; i < result.length; i++) {
      expect(result[i]!.annualValue).toBeLessThanOrEqual(result[i - 1]!.annualValue);
    }
  });

  it('assigns A to top 80% of value', () => {
    const result = classifyABC(materials);
    const aItems = result.filter((r) => r.abcClass === 'A');
    // Total = 100,000. 80% = 80,000. mat-A1 (50k) + mat-A2 (30k) = 80k → exactly 80%
    expect(aItems.map((a) => a.materialId)).toEqual(['mat-A1', 'mat-A2']);
  });

  it('assigns B to next 15%', () => {
    const result = classifyABC(materials);
    const bItems = result.filter((r) => r.abcClass === 'B');
    // 80k + 10k = 90%, 90k + 5k = 95%
    expect(bItems.map((b) => b.materialId)).toEqual(['mat-B1', 'mat-B2']);
  });

  it('assigns C to remaining', () => {
    const result = classifyABC(materials);
    const cItems = result.filter((r) => r.abcClass === 'C');
    expect(cItems.map((c) => c.materialId)).toEqual(['mat-C1', 'mat-C2']);
  });
});

// ---------------------------------------------------------------------------
// Cycle count schedule
// ---------------------------------------------------------------------------

describe('Physical Inventory — Cycle count schedule', () => {
  const config = {
    aFrequencyDays: 30,
    bFrequencyDays: 90,
    cFrequencyDays: 365,
  };

  it('generates correct next count dates', () => {
    const start = new Date('2026-01-01');
    const schedule = generateCycleCountSchedule(
      [{ materialId: 'mat-001', abcClass: 'A' }],
      config,
      start,
    );
    expect(schedule).toHaveLength(1);
    const entry = schedule[0]!;
    expect(entry.nextCountDate).toEqual(new Date('2026-01-31'));
    expect(entry.frequencyDays).toBe(30);
  });

  it('respects frequency config per ABC class', () => {
    const start = new Date('2026-01-01');
    const schedule = generateCycleCountSchedule(
      [
        { materialId: 'mat-A', abcClass: 'A' },
        { materialId: 'mat-B', abcClass: 'B' },
        { materialId: 'mat-C', abcClass: 'C' },
      ],
      config,
      start,
    );

    expect(schedule[0]!.frequencyDays).toBe(30);
    expect(schedule[0]!.nextCountDate).toEqual(new Date('2026-01-31'));

    expect(schedule[1]!.frequencyDays).toBe(90);
    expect(schedule[1]!.nextCountDate).toEqual(new Date('2026-04-01'));

    expect(schedule[2]!.frequencyDays).toBe(365);
    expect(schedule[2]!.nextCountDate).toEqual(new Date('2027-01-01'));
  });
});
