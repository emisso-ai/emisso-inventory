import { describe, it, expect } from 'vitest';
import type { ValuationLayer, Move } from '../../src/types.js';
import { multiply } from '../../src/money.js';
import {
  createValuationLayer,
  consumeFromLayer,
  generateLayerId,
} from '../../src/valuation/layer.js';
import { consumeFIFO } from '../../src/valuation/fifo.js';
import { calculateAverageCost, consumeAVCO } from '../../src/valuation/avco.js';
import { consumeStandard } from '../../src/valuation/standard.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMove(overrides: Partial<Move> = {}): Move {
  return {
    id: 'move-1',
    materialId: 'mat-a',
    fromLocationId: 'loc-supplier',
    toLocationId: 'loc-warehouse',
    quantity: 100,
    unit: 'EA',
    unitCost: 1000, // $10.00
    state: 'done',
    reference: null,
    batchId: null,
    presetCode: null,
    reversalOfId: null,
    routeId: null,
    timestamp: new Date('2026-01-01T00:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
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
// Layer creation
// ---------------------------------------------------------------------------

describe('createValuationLayer', () => {
  it('1. creates correct layer from receipt move', () => {
    const move = makeMove({ id: 'move-r1', quantity: 50, unitCost: 2000 });
    const layer = createValuationLayer(move);

    expect(layer.moveId).toBe('move-r1');
    expect(layer.materialId).toBe('mat-a');
    expect(layer.quantity).toBe(50);
    expect(layer.remainingQty).toBe(50);
    expect(layer.unitCost).toBe(2000);
    expect(layer.timestamp).toEqual(move.timestamp);
    expect(layer.id).toMatch(/^layer-/);
  });

  it('2. computes totalValue = quantity * unitCost', () => {
    // 200 units @ 1500 cents = 300_000 cents ($3,000.00)
    const move = makeMove({ quantity: 200, unitCost: 1500 });
    const layer = createValuationLayer(move);

    expect(layer.totalValue).toBe(300_000);
    expect(layer.remainingValue).toBe(300_000);
  });

  it('throws if unitCost is null', () => {
    const move = makeMove({ unitCost: null });
    expect(() => createValuationLayer(move)).toThrow('unitCost is required');
  });
});

// ---------------------------------------------------------------------------
// Layer consumption
// ---------------------------------------------------------------------------

describe('consumeFromLayer', () => {
  it('3. reduces remainingQty and remainingValue', () => {
    // Layer: 100 @ 1000 cents. Consume 30 → remaining 70, value 70_000
    const layer = makeLayer();
    const { updatedLayer } = consumeFromLayer(layer, 30);

    expect(updatedLayer.remainingQty).toBe(70);
    expect(updatedLayer.remainingValue).toBe(70_000);
  });

  it('4. returns correct consumed record', () => {
    const layer = makeLayer({ id: 'layer-x', unitCost: 1500 });
    const { consumed } = consumeFromLayer(layer, 20);

    expect(consumed.layerId).toBe('layer-x');
    expect(consumed.quantity).toBe(20);
    expect(consumed.unitCost).toBe(1500);
    expect(consumed.totalValue).toBe(30_000); // 20 * 1500
  });

  it('5. handles partial consumption', () => {
    const layer = makeLayer({ remainingQty: 80, remainingValue: 80_000 });
    const { updatedLayer, consumed } = consumeFromLayer(layer, 25);

    expect(updatedLayer.remainingQty).toBe(55);
    expect(consumed.quantity).toBe(25);
    expect(consumed.totalValue).toBe(25_000); // 25 * 1000
  });

  it('6. handles full consumption (remainingQty = 0)', () => {
    const layer = makeLayer({ remainingQty: 40, remainingValue: 40_000 });
    const { updatedLayer } = consumeFromLayer(layer, 40);

    expect(updatedLayer.remainingQty).toBe(0);
    expect(updatedLayer.remainingValue).toBe(0);
  });

  it('throws when consuming more than remaining', () => {
    const layer = makeLayer({ remainingQty: 10, remainingValue: 10_000 });
    expect(() => consumeFromLayer(layer, 11)).toThrow('only 10 remaining');
  });
});

// ---------------------------------------------------------------------------
// FIFO
// ---------------------------------------------------------------------------

describe('consumeFIFO', () => {
  it('7. consumes oldest layer first', () => {
    const layers = [
      makeLayer({ id: 'old', unitCost: 1000, timestamp: new Date('2026-01-01') }),
      makeLayer({ id: 'new', unitCost: 1200, timestamp: new Date('2026-02-01') }),
    ];

    const { consumed } = consumeFIFO(layers, 'mat-a', 10);

    expect(consumed).toHaveLength(1);
    expect(consumed[0]!.layerId).toBe('old');
  });

  it('8. 100@$10 then 50@$12, consume 120 → cost = (100*10)+(20*12) = 1240 dollars = 124_000 cents', () => {
    const layers = [
      makeLayer({
        id: 'l1',
        quantity: 100,
        remainingQty: 100,
        unitCost: 1000,
        totalValue: 100_000,
        remainingValue: 100_000,
        timestamp: new Date('2026-01-01'),
      }),
      makeLayer({
        id: 'l2',
        quantity: 50,
        remainingQty: 50,
        unitCost: 1200,
        totalValue: 60_000,
        remainingValue: 60_000,
        timestamp: new Date('2026-02-01'),
      }),
    ];

    const { consumed, totalCost, updatedLayers } = consumeFIFO(layers, 'mat-a', 120);

    // Should consume 100 from l1 + 20 from l2
    expect(consumed).toHaveLength(2);
    expect(consumed[0]!.layerId).toBe('l1');
    expect(consumed[0]!.quantity).toBe(100);
    expect(consumed[0]!.totalValue).toBe(100_000);
    expect(consumed[1]!.layerId).toBe('l2');
    expect(consumed[1]!.quantity).toBe(20);
    expect(consumed[1]!.totalValue).toBe(24_000); // 20 * 1200
    expect(totalCost).toBe(124_000);

    // l1 fully consumed, l2 has 30 remaining
    expect(updatedLayers.find((l) => l.id === 'l1')!.remainingQty).toBe(0);
    expect(updatedLayers.find((l) => l.id === 'l2')!.remainingQty).toBe(30);
  });

  it('9. single layer, partial consumption', () => {
    const layers = [
      makeLayer({ id: 'l1', remainingQty: 100, unitCost: 500, remainingValue: 50_000 }),
    ];

    const { consumed, totalCost } = consumeFIFO(layers, 'mat-a', 40);

    expect(consumed).toHaveLength(1);
    expect(consumed[0]!.quantity).toBe(40);
    expect(totalCost).toBe(20_000); // 40 * 500
  });

  it('10. multiple layers, exact consumption empties first layer', () => {
    const layers = [
      makeLayer({ id: 'l1', remainingQty: 50, unitCost: 800, remainingValue: 40_000, timestamp: new Date('2026-01-01') }),
      makeLayer({ id: 'l2', remainingQty: 50, unitCost: 900, remainingValue: 45_000, timestamp: new Date('2026-02-01') }),
    ];

    const { consumed, updatedLayers, totalCost } = consumeFIFO(layers, 'mat-a', 50);

    expect(consumed).toHaveLength(1);
    expect(consumed[0]!.layerId).toBe('l1');
    expect(consumed[0]!.quantity).toBe(50);
    expect(totalCost).toBe(40_000);
    expect(updatedLayers.find((l) => l.id === 'l1')!.remainingQty).toBe(0);
    expect(updatedLayers.find((l) => l.id === 'l2')!.remainingQty).toBe(50);
  });

  it('11. consume more than available (partial fill)', () => {
    const layers = [
      makeLayer({ id: 'l1', remainingQty: 30, unitCost: 1000, remainingValue: 30_000 }),
    ];

    const { consumed, totalCost } = consumeFIFO(layers, 'mat-a', 100);

    // Only 30 available, so consume 30
    expect(consumed).toHaveLength(1);
    expect(consumed[0]!.quantity).toBe(30);
    expect(totalCost).toBe(30_000);
  });

  it('12. empty layers array returns 0 cost', () => {
    const { consumed, totalCost } = consumeFIFO([], 'mat-a', 10);

    expect(consumed).toHaveLength(0);
    expect(totalCost).toBe(0);
  });

  it('13. filters by materialId', () => {
    const layers = [
      makeLayer({ id: 'l-a', materialId: 'mat-a', remainingQty: 100, unitCost: 1000, remainingValue: 100_000 }),
      makeLayer({ id: 'l-b', materialId: 'mat-b', remainingQty: 100, unitCost: 2000, remainingValue: 200_000 }),
    ];

    const { consumed, totalCost } = consumeFIFO(layers, 'mat-b', 50);

    expect(consumed).toHaveLength(1);
    expect(consumed[0]!.layerId).toBe('l-b');
    expect(consumed[0]!.unitCost).toBe(2000);
    expect(totalCost).toBe(100_000); // 50 * 2000
  });

  it('14. preserves untouched layers', () => {
    const layers = [
      makeLayer({ id: 'l1', materialId: 'mat-a', remainingQty: 50, unitCost: 1000, remainingValue: 50_000 }),
      makeLayer({ id: 'l2', materialId: 'mat-b', remainingQty: 80, unitCost: 1500, remainingValue: 120_000 }),
    ];

    const { updatedLayers } = consumeFIFO(layers, 'mat-a', 20);

    const untouched = updatedLayers.find((l) => l.id === 'l2')!;
    expect(untouched.remainingQty).toBe(80);
    expect(untouched.remainingValue).toBe(120_000);
  });
});

// ---------------------------------------------------------------------------
// AVCO
// ---------------------------------------------------------------------------

describe('calculateAverageCost', () => {
  it('15. single layer returns layer unit cost', () => {
    const layers = [makeLayer({ unitCost: 1500, remainingQty: 50, remainingValue: 75_000 })];
    expect(calculateAverageCost(layers, 'mat-a')).toBe(1500);
  });

  it('16. 100@1000 + 50@1200 → avg = (100000+60000)/150 = 1067 cents', () => {
    const layers = [
      makeLayer({ id: 'l1', remainingQty: 100, unitCost: 1000, remainingValue: 100_000 }),
      makeLayer({ id: 'l2', remainingQty: 50, unitCost: 1200, remainingValue: 60_000 }),
    ];

    // (100_000 + 60_000) / 150 = 160_000 / 150 = 1066.666... → rounds to 1067
    expect(calculateAverageCost(layers, 'mat-a')).toBe(1067);
  });

  it('17. no stock returns 0', () => {
    const layers = [makeLayer({ remainingQty: 0, remainingValue: 0 })];
    expect(calculateAverageCost(layers, 'mat-a')).toBe(0);
  });

  it('no matching material returns 0', () => {
    const layers = [makeLayer({ materialId: 'mat-x' })];
    expect(calculateAverageCost(layers, 'mat-a')).toBe(0);
  });
});

describe('consumeAVCO', () => {
  it('18. consumes at average cost', () => {
    const layers = [
      makeLayer({ id: 'l1', remainingQty: 100, unitCost: 1000, remainingValue: 100_000 }),
      makeLayer({ id: 'l2', remainingQty: 50, unitCost: 1200, remainingValue: 60_000 }),
    ];

    const { consumed, totalCost } = consumeAVCO(layers, 'mat-a', 30);

    // Average cost = 1067
    // Total cost = 30 * 1067 = 32_010
    expect(totalCost).toBe(32_010);
    // All consumed records should use average cost
    for (const c of consumed) {
      expect(c.unitCost).toBe(1067);
    }
  });

  it('19. 100@1000 + 50@1200, consume 30 → totalCost = 30 * 1067 = 32_010', () => {
    const layers = [
      makeLayer({ id: 'l1', remainingQty: 100, unitCost: 1000, remainingValue: 100_000, timestamp: new Date('2026-01-01') }),
      makeLayer({ id: 'l2', remainingQty: 50, unitCost: 1200, remainingValue: 60_000, timestamp: new Date('2026-02-01') }),
    ];

    const { totalCost, consumed } = consumeAVCO(layers, 'mat-a', 30);
    expect(totalCost).toBe(32_010);

    // Total consumed quantity across records should be 30
    const totalConsumed = consumed.reduce((s, c) => s + c.quantity, 0);
    expect(totalConsumed).toBe(30);
  });

  it('20. distributes consumption proportionally across layers', () => {
    const layers = [
      makeLayer({ id: 'l1', remainingQty: 100, unitCost: 1000, remainingValue: 100_000, timestamp: new Date('2026-01-01') }),
      makeLayer({ id: 'l2', remainingQty: 50, unitCost: 1200, remainingValue: 60_000, timestamp: new Date('2026-02-01') }),
    ];

    // Consume 30. Shares: l1 = 100/150 = 66.7%, l2 = 50/150 = 33.3%
    // l1 gets round(30 * 100/150) = round(20) = 20
    // l2 gets 30 - 20 = 10
    const { consumed, updatedLayers } = consumeAVCO(layers, 'mat-a', 30);

    expect(consumed).toHaveLength(2);
    expect(consumed[0]!.layerId).toBe('l1');
    expect(consumed[0]!.quantity).toBe(20);
    expect(consumed[1]!.layerId).toBe('l2');
    expect(consumed[1]!.quantity).toBe(10);

    expect(updatedLayers.find((l) => l.id === 'l1')!.remainingQty).toBe(80);
    expect(updatedLayers.find((l) => l.id === 'l2')!.remainingQty).toBe(40);
  });

  it('21. single layer behaves same as FIFO', () => {
    const layers = [
      makeLayer({ id: 'l1', remainingQty: 100, unitCost: 1000, remainingValue: 100_000 }),
    ];

    const avco = consumeAVCO(layers, 'mat-a', 30);
    const fifo = consumeFIFO(layers, 'mat-a', 30);

    expect(avco.totalCost).toBe(fifo.totalCost);
    expect(avco.consumed[0]!.quantity).toBe(fifo.consumed[0]!.quantity);
  });
});

// ---------------------------------------------------------------------------
// Standard
// ---------------------------------------------------------------------------

describe('consumeStandard', () => {
  it('22. totalCost = quantity * standardPrice always', () => {
    const layers = [
      makeLayer({ remainingQty: 100, unitCost: 1000, remainingValue: 100_000 }),
    ];

    const { totalCost } = consumeStandard(layers, 'mat-a', 50, 1100);
    expect(totalCost).toBe(55_000); // 50 * 1100
  });

  it('23. favorable variance (standard > actual)', () => {
    // Actual cost via FIFO: 50 * 1000 = 50_000
    // Standard cost: 50 * 1100 = 55_000
    // Difference: 55_000 - 50_000 = 5_000 (favorable)
    const layers = [
      makeLayer({ remainingQty: 100, unitCost: 1000, remainingValue: 100_000 }),
    ];

    const { priceDifference } = consumeStandard(layers, 'mat-a', 50, 1100);
    expect(priceDifference).toBe(5_000);
  });

  it('24. unfavorable variance (standard < actual)', () => {
    // Actual cost via FIFO: 50 * 1000 = 50_000
    // Standard cost: 50 * 800 = 40_000
    // Difference: 40_000 - 50_000 = -10_000 (unfavorable)
    const layers = [
      makeLayer({ remainingQty: 100, unitCost: 1000, remainingValue: 100_000 }),
    ];

    const { priceDifference } = consumeStandard(layers, 'mat-a', 50, 800);
    expect(priceDifference).toBe(-10_000);
  });

  it('25. zero variance when standard = actual', () => {
    const layers = [
      makeLayer({ remainingQty: 100, unitCost: 1000, remainingValue: 100_000 }),
    ];

    const { priceDifference } = consumeStandard(layers, 'mat-a', 50, 1000);
    expect(priceDifference).toBe(0);
  });

  it('26. consumes layers FIFO for actual cost tracking', () => {
    const layers = [
      makeLayer({ id: 'l1', remainingQty: 30, unitCost: 800, remainingValue: 24_000, timestamp: new Date('2026-01-01') }),
      makeLayer({ id: 'l2', remainingQty: 70, unitCost: 1200, remainingValue: 84_000, timestamp: new Date('2026-02-01') }),
    ];

    // Consume 50 at standard 1000
    // FIFO actual: 30 * 800 + 20 * 1200 = 24_000 + 24_000 = 48_000
    // Standard: 50 * 1000 = 50_000
    // Difference: 50_000 - 48_000 = 2_000
    const { totalCost, priceDifference, updatedLayers } = consumeStandard(
      layers,
      'mat-a',
      50,
      1000,
    );

    expect(totalCost).toBe(50_000);
    expect(priceDifference).toBe(2_000);
    expect(updatedLayers.find((l) => l.id === 'l1')!.remainingQty).toBe(0);
    expect(updatedLayers.find((l) => l.id === 'l2')!.remainingQty).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('27. zero quantity consumption — FIFO', () => {
    const layers = [makeLayer()];
    const { consumed, totalCost } = consumeFIFO(layers, 'mat-a', 0);
    expect(consumed).toHaveLength(0);
    expect(totalCost).toBe(0);
  });

  it('27b. zero quantity consumption — AVCO', () => {
    const layers = [makeLayer()];
    const { consumed, totalCost } = consumeAVCO(layers, 'mat-a', 0);
    expect(consumed).toHaveLength(0);
    expect(totalCost).toBe(0);
  });

  it('27c. zero quantity consumption — Standard', () => {
    const layers = [makeLayer()];
    const { consumed, totalCost, priceDifference } = consumeStandard(layers, 'mat-a', 0, 1000);
    expect(consumed).toHaveLength(0);
    expect(totalCost).toBe(0);
    expect(priceDifference).toBe(0);
  });

  it('28. layer with remainingQty = 0 is skipped', () => {
    const layers = [
      makeLayer({ id: 'empty', remainingQty: 0, remainingValue: 0, timestamp: new Date('2026-01-01') }),
      makeLayer({ id: 'full', remainingQty: 50, unitCost: 1000, remainingValue: 50_000, timestamp: new Date('2026-02-01') }),
    ];

    const { consumed } = consumeFIFO(layers, 'mat-a', 10);
    expect(consumed).toHaveLength(1);
    expect(consumed[0]!.layerId).toBe('full');
  });

  it('29. multiple materials mixed — correct filtering', () => {
    const layers = [
      makeLayer({ id: 'a1', materialId: 'mat-a', remainingQty: 50, unitCost: 1000, remainingValue: 50_000, timestamp: new Date('2026-01-01') }),
      makeLayer({ id: 'b1', materialId: 'mat-b', remainingQty: 80, unitCost: 2000, remainingValue: 160_000, timestamp: new Date('2026-01-02') }),
      makeLayer({ id: 'a2', materialId: 'mat-a', remainingQty: 30, unitCost: 1100, remainingValue: 33_000, timestamp: new Date('2026-01-03') }),
    ];

    const fifo = consumeFIFO(layers, 'mat-a', 60);
    expect(fifo.consumed).toHaveLength(2);
    expect(fifo.consumed[0]!.layerId).toBe('a1');
    expect(fifo.consumed[0]!.quantity).toBe(50);
    expect(fifo.consumed[1]!.layerId).toBe('a2');
    expect(fifo.consumed[1]!.quantity).toBe(10);
    // 50*1000 + 10*1100 = 50_000 + 11_000 = 61_000
    expect(fifo.totalCost).toBe(61_000);

    // mat-b untouched
    expect(fifo.updatedLayers.find((l) => l.id === 'b1')!.remainingQty).toBe(80);
  });

  it('30. very large quantities (no overflow with integer arithmetic)', () => {
    // 1,000,000 units @ 99,999 cents = 99,999,000,000 cents
    const layers = [
      makeLayer({
        id: 'big',
        remainingQty: 1_000_000,
        unitCost: 99_999,
        remainingValue: 99_999_000_000,
      }),
    ];

    const { totalCost } = consumeFIFO(layers, 'mat-a', 500_000);
    expect(totalCost).toBe(49_999_500_000); // 500_000 * 99_999
  });

  it('generateLayerId produces unique ids', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateLayerId()));
    expect(ids.size).toBe(100);
  });

  it('consumeFromLayer does not mutate original layer', () => {
    const layer = makeLayer({ remainingQty: 100, remainingValue: 100_000 });
    consumeFromLayer(layer, 30);
    expect(layer.remainingQty).toBe(100);
    expect(layer.remainingValue).toBe(100_000);
  });

  it('consumeFIFO does not mutate original layers', () => {
    const layers = [makeLayer({ remainingQty: 100, remainingValue: 100_000 })];
    consumeFIFO(layers, 'mat-a', 30);
    expect(layers[0]!.remainingQty).toBe(100);
  });
});
