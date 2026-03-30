import { describe, it, expect } from 'vitest';
import type { Quant, Material, Move, ValuationLayer } from '../../src/types.js';
import { generateStockReport } from '../../src/reports/stock-report.js';
import { generateMoveHistory } from '../../src/reports/move-history.js';
import { generateValuationReport } from '../../src/reports/valuation-report.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMaterial(overrides: Partial<Material> = {}): Material {
  return {
    id: 'mat-a',
    description: 'Widget A',
    type: 'finished',
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

function makeQuant(overrides: Partial<Quant> = {}): Quant {
  return {
    materialId: 'mat-a',
    locationId: 'loc-wh1',
    batchId: null,
    quantity: 100,
    reservedQuantity: 0,
    ...overrides,
  };
}

function makeMove(overrides: Partial<Move> = {}): Move {
  return {
    id: 'move-1',
    materialId: 'mat-a',
    fromLocationId: 'loc-supplier',
    toLocationId: 'loc-wh1',
    quantity: 100,
    unit: 'EA',
    unitCost: 1000,
    state: 'done',
    reference: null,
    batchId: null,
    presetCode: null,
    reversalOfId: null,
    routeId: null,
    timestamp: new Date('2026-01-15T00:00:00Z'),
    createdAt: new Date('2026-01-15T00:00:00Z'),
    ...overrides,
  };
}

function makeLayer(overrides: Partial<ValuationLayer> = {}): ValuationLayer {
  return {
    id: 'layer-1',
    moveId: 'move-1',
    materialId: 'mat-a',
    quantity: 100,
    remainingQty: 100,
    unitCost: 1000,
    totalValue: 100_000,
    remainingValue: 100_000,
    timestamp: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Stock Report
// ---------------------------------------------------------------------------

describe('generateStockReport', () => {
  const materials = [
    makeMaterial({ id: 'mat-a', description: 'Widget A', baseUnit: 'EA' }),
    makeMaterial({ id: 'mat-b', description: 'Widget B', baseUnit: 'KG' }),
  ];

  it('returns correct lines from quants', () => {
    const quants = [
      makeQuant({ materialId: 'mat-a', locationId: 'loc-wh1', quantity: 50 }),
      makeQuant({ materialId: 'mat-b', locationId: 'loc-wh2', quantity: 30 }),
    ];

    const report = generateStockReport(quants, materials);

    expect(report.lines).toHaveLength(2);
    expect(report.totalMaterials).toBe(2);
    expect(report.totalLocations).toBe(2);
    expect(report.totalQuantity).toBe(80);
    expect(report.lines[0]!.description).toBe('Widget A');
    expect(report.lines[1]!.unit).toBe('KG');
  });

  it('filters by materialId', () => {
    const quants = [
      makeQuant({ materialId: 'mat-a', locationId: 'loc-wh1', quantity: 50 }),
      makeQuant({ materialId: 'mat-b', locationId: 'loc-wh2', quantity: 30 }),
    ];

    const report = generateStockReport(quants, materials, { materialId: 'mat-a' });

    expect(report.lines).toHaveLength(1);
    expect(report.lines[0]!.materialId).toBe('mat-a');
    expect(report.totalMaterials).toBe(1);
  });

  it('filters by locationId', () => {
    const quants = [
      makeQuant({ materialId: 'mat-a', locationId: 'loc-wh1', quantity: 50 }),
      makeQuant({ materialId: 'mat-a', locationId: 'loc-wh2', quantity: 20 }),
      makeQuant({ materialId: 'mat-b', locationId: 'loc-wh2', quantity: 30 }),
    ];

    const report = generateStockReport(quants, materials, { locationId: 'loc-wh2' });

    expect(report.lines).toHaveLength(2);
    expect(report.totalLocations).toBe(1);
  });

  it('excludes zero-quantity lines with onlyAvailable', () => {
    const quants = [
      makeQuant({ materialId: 'mat-a', locationId: 'loc-wh1', quantity: 50 }),
      makeQuant({ materialId: 'mat-b', locationId: 'loc-wh2', quantity: 0 }),
    ];

    const report = generateStockReport(quants, materials, { onlyAvailable: true });

    expect(report.lines).toHaveLength(1);
    expect(report.lines[0]!.materialId).toBe('mat-a');
  });

  it('calculates availableQuantity correctly', () => {
    const quants = [
      makeQuant({
        materialId: 'mat-a',
        locationId: 'loc-wh1',
        quantity: 100,
        reservedQuantity: 25,
      }),
    ];

    const report = generateStockReport(quants, materials);

    expect(report.lines[0]!.quantity).toBe(100);
    expect(report.lines[0]!.reservedQuantity).toBe(25);
    expect(report.lines[0]!.availableQuantity).toBe(75);
  });
});

// ---------------------------------------------------------------------------
// Move History
// ---------------------------------------------------------------------------

describe('generateMoveHistory', () => {
  const baseMoves = [
    makeMove({
      id: 'move-1',
      materialId: 'mat-a',
      fromLocationId: 'loc-supplier',
      toLocationId: 'loc-wh1',
      quantity: 100,
      presetCode: '101',
      timestamp: new Date('2026-01-10T00:00:00Z'),
    }),
    makeMove({
      id: 'move-2',
      materialId: 'mat-b',
      fromLocationId: 'loc-wh1',
      toLocationId: 'loc-customer',
      quantity: 50,
      presetCode: '601',
      timestamp: new Date('2026-01-20T00:00:00Z'),
    }),
    makeMove({
      id: 'move-3',
      materialId: 'mat-a',
      fromLocationId: 'loc-wh1',
      toLocationId: 'loc-wh2',
      quantity: 30,
      presetCode: '301',
      timestamp: new Date('2026-02-05T00:00:00Z'),
    }),
  ];

  it('returns all moves', () => {
    const report = generateMoveHistory(baseMoves);

    expect(report.totalMoves).toBe(3);
    expect(report.lines).toHaveLength(3);
  });

  it('filters by materialId', () => {
    const report = generateMoveHistory(baseMoves, { materialId: 'mat-a' });

    expect(report.totalMoves).toBe(2);
    expect(report.lines.every((l) => l.materialId === 'mat-a')).toBe(true);
  });

  it('filters by date range', () => {
    const report = generateMoveHistory(baseMoves, {
      fromDate: new Date('2026-01-15T00:00:00Z'),
      toDate: new Date('2026-01-25T00:00:00Z'),
    });

    expect(report.totalMoves).toBe(1);
    expect(report.lines[0]!.moveId).toBe('move-2');
  });

  it('sorts by timestamp desc', () => {
    const report = generateMoveHistory(baseMoves, undefined, {
      field: 'timestamp',
      direction: 'desc',
    });

    expect(report.lines[0]!.moveId).toBe('move-3');
    expect(report.lines[1]!.moveId).toBe('move-2');
    expect(report.lines[2]!.moveId).toBe('move-1');
  });

  it('filters by presetCode', () => {
    const report = generateMoveHistory(baseMoves, { presetCode: '601' });

    expect(report.totalMoves).toBe(1);
    expect(report.lines[0]!.moveId).toBe('move-2');
  });
});

// ---------------------------------------------------------------------------
// Valuation Report
// ---------------------------------------------------------------------------

describe('generateValuationReport', () => {
  const materials = [
    makeMaterial({ id: 'mat-a', description: 'Widget A' }),
    makeMaterial({ id: 'mat-b', description: 'Widget B' }),
  ];

  it('aggregates layers by material', () => {
    const layers = [
      makeLayer({ id: 'l1', materialId: 'mat-a', remainingQty: 60, remainingValue: 60_000 }),
      makeLayer({ id: 'l2', materialId: 'mat-a', remainingQty: 40, remainingValue: 44_000 }),
      makeLayer({ id: 'l3', materialId: 'mat-b', remainingQty: 20, remainingValue: 30_000 }),
    ];

    const report = generateValuationReport(layers, materials);

    expect(report.totalMaterials).toBe(2);
    const lineA = report.lines.find((l) => l.materialId === 'mat-a')!;
    expect(lineA.totalQuantity).toBe(100);
    expect(lineA.totalValue).toBe(104_000);
    expect(lineA.layerCount).toBe(2);
  });

  it('calculates averageCost correctly', () => {
    const layers = [
      makeLayer({ id: 'l1', materialId: 'mat-a', remainingQty: 60, unitCost: 1000, remainingValue: 60_000 }),
      makeLayer({ id: 'l2', materialId: 'mat-a', remainingQty: 40, unitCost: 1100, remainingValue: 44_000 }),
    ];

    const report = generateValuationReport(layers, materials);
    const lineA = report.lines.find((l) => l.materialId === 'mat-a')!;

    // averageCost = 104_000 / 100 = 1040
    expect(lineA.averageCost).toBe(1040);
  });

  it('filters out zero-stock materials with onlyWithStock', () => {
    const layers = [
      makeLayer({ id: 'l1', materialId: 'mat-a', remainingQty: 50, remainingValue: 50_000 }),
      makeLayer({ id: 'l2', materialId: 'mat-b', remainingQty: 0, remainingValue: 0 }),
    ];

    const report = generateValuationReport(layers, materials, { onlyWithStock: true });

    expect(report.totalMaterials).toBe(1);
    expect(report.lines[0]!.materialId).toBe('mat-a');
  });

  it('calculates totalValue across all materials', () => {
    const layers = [
      makeLayer({ id: 'l1', materialId: 'mat-a', remainingQty: 50, remainingValue: 50_000 }),
      makeLayer({ id: 'l2', materialId: 'mat-b', remainingQty: 30, remainingValue: 45_000 }),
    ];

    const report = generateValuationReport(layers, materials);

    expect(report.totalValue).toBe(95_000);
  });
});
