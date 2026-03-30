import { describe, it, expect } from 'vitest';
import type { ProductionOrder, Move } from '../../src/types.js';
import { calculateWIP } from '../../src/manufacturing/wip.js';
import { calculateVariances } from '../../src/manufacturing/variance.js';
import type { PlannedCosts, ActualCosts } from '../../src/manufacturing/variance.js';
import { analyzeScrap } from '../../src/manufacturing/scrap.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeOrder(overrides?: Partial<ProductionOrder>): ProductionOrder {
  return {
    id: 'PO-001',
    materialId: 'FERT-001',
    plantLocationId: 'loc-plant',
    plannedQuantity: 100,
    unit: 'EA',
    status: 'released',
    bomId: 'BOM-001',
    components: [
      {
        materialId: 'RAW-001',
        plannedQuantity: 200,
        issuedQuantity: 200,
        unit: 'EA',
        backflush: false,
      },
      {
        materialId: 'RAW-002',
        plannedQuantity: 100,
        issuedQuantity: 100,
        unit: 'KG',
        backflush: false,
      },
    ],
    operations: [
      {
        id: 'OP-010',
        sequence: 10,
        description: 'Assembly',
        workCenterId: 'WC-ASM',
        plannedTime: 600,
        confirmedTime: 600,
        confirmedYield: 100,
        confirmedScrap: 0,
      },
    ],
    receivedQuantity: 100,
    scrapQuantity: 0,
    startDate: null,
    endDate: null,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeMove(overrides?: Partial<Move>): Move {
  return {
    id: 'MOV-001',
    materialId: 'RAW-001',
    fromLocationId: 'loc-production',
    toLocationId: 'virtual/scrap',
    quantity: 10,
    unit: 'EA',
    unitCost: null,
    state: 'done',
    reference: 'PO-001',
    batchId: null,
    presetCode: '551',
    reversalOfId: null,
    routeId: null,
    timestamp: new Date('2026-01-15'),
    createdAt: new Date('2026-01-15'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// WIP Calculation
// ---------------------------------------------------------------------------

describe('calculateWIP', () => {
  const materialPrices = new Map([
    ['RAW-001', 500],   // $5.00 per unit
    ['RAW-002', 1000],  // $10.00 per kg
  ]);

  const activityRates = new Map([
    ['WC-ASM', 200],    // $2.00 per minute
  ]);

  it('calculates WIP with only material costs', () => {
    const order = makeOrder();
    const result = calculateWIP(order, materialPrices);

    // RAW-001: 200 × 500 = 100000, RAW-002: 100 × 1000 = 100000
    expect(result.materialCost).toBe(200000);
    expect(result.activityCost).toBe(0);
    expect(result.overheadCost).toBe(0);
    expect(result.totalWIP).toBe(200000);
  });

  it('calculates WIP with material + activity costs', () => {
    const order = makeOrder();
    const result = calculateWIP(order, materialPrices, activityRates);

    // Materials: 200000, Activity: 600 min × 200 = 120000
    expect(result.materialCost).toBe(200000);
    expect(result.activityCost).toBe(120000);
    expect(result.totalWIP).toBe(320000);
  });

  it('calculates WIP with overhead', () => {
    const order = makeOrder();
    const result = calculateWIP(order, materialPrices, activityRates, 10);

    // Overhead: 200000 × 10/100 = 20000
    expect(result.overheadCost).toBe(20000);
    expect(result.totalWIP).toBe(340000); // 200000 + 120000 + 20000
  });

  it('materialCost = sum(issuedQty × price) for each component', () => {
    const order = makeOrder({
      components: [
        { materialId: 'RAW-001', plannedQuantity: 200, issuedQuantity: 150, unit: 'EA', backflush: false },
        { materialId: 'RAW-002', plannedQuantity: 100, issuedQuantity: 80, unit: 'KG', backflush: false },
      ],
    });
    const result = calculateWIP(order, materialPrices);

    // 150 × 500 = 75000, 80 × 1000 = 80000
    expect(result.materialCost).toBe(155000);
  });

  it('activityCost = sum(confirmedTime × rate) for each operation', () => {
    const order = makeOrder({
      operations: [
        { id: 'OP-010', sequence: 10, description: 'Cut', workCenterId: 'WC-ASM', plannedTime: 300, confirmedTime: 300, confirmedYield: 50, confirmedScrap: 0 },
        { id: 'OP-020', sequence: 20, description: 'Weld', workCenterId: 'WC-ASM', plannedTime: 300, confirmedTime: 250, confirmedYield: 50, confirmedScrap: 0 },
      ],
    });
    const result = calculateWIP(order, materialPrices, activityRates);

    // 300 × 200 + 250 × 200 = 60000 + 50000 = 110000
    expect(result.activityCost).toBe(110000);
  });

  it('overheadCost = materialCost × overheadRate / 100', () => {
    const order = makeOrder();
    const result = calculateWIP(order, materialPrices, undefined, 15);

    // 200000 × 15/100 = 30000
    expect(result.overheadCost).toBe(30000);
  });

  it('totalWIP = material + activity + overhead', () => {
    const order = makeOrder();
    const result = calculateWIP(order, materialPrices, activityRates, 5);

    const expected = 200000 + 120000 + 10000; // material + activity + overhead(5%)
    expect(result.totalWIP).toBe(expected);
  });

  it('deliveredValue proportional to received/planned', () => {
    const order = makeOrder({ receivedQuantity: 50, plannedQuantity: 100 });
    const result = calculateWIP(order, materialPrices, activityRates);

    // totalWIP = 320000, received/planned = 50/100 = 0.5
    expect(result.deliveredValue).toBe(160000);
  });

  it('balance = totalWIP - deliveredValue', () => {
    const order = makeOrder({ receivedQuantity: 50, plannedQuantity: 100 });
    const result = calculateWIP(order, materialPrices, activityRates);

    expect(result.balance).toBe(result.totalWIP - result.deliveredValue);
    expect(result.balance).toBe(160000);
  });

  it('no components issued → materialCost = 0', () => {
    const order = makeOrder({
      components: [
        { materialId: 'RAW-001', plannedQuantity: 200, issuedQuantity: 0, unit: 'EA', backflush: false },
        { materialId: 'RAW-002', plannedQuantity: 100, issuedQuantity: 0, unit: 'KG', backflush: false },
      ],
    });
    const result = calculateWIP(order, materialPrices);

    expect(result.materialCost).toBe(0);
    expect(result.totalWIP).toBe(0);
  });

  it('missing prices default to 0', () => {
    const order = makeOrder();
    const emptyPrices = new Map<string, number>();
    const result = calculateWIP(order, emptyPrices);

    expect(result.materialCost).toBe(0);
    expect(result.totalWIP).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Variance Analysis
// ---------------------------------------------------------------------------

describe('calculateVariances', () => {
  // Standard scenario: 100 units planned
  // Planned: material 50000, activity 20000, total 70000 → unit cost 700
  const basePlanned: PlannedCosts = {
    materialCost: 50000,
    activityCost: 20000,
    totalPlannedCost: 70000,
  };

  it('zero variance when actual = planned', () => {
    const order = makeOrder({ receivedQuantity: 100, scrapQuantity: 0 });
    const actual: ActualCosts = {
      materialCost: 50000,
      activityCost: 20000,
      totalActualCost: 70000,
    };

    const result = calculateVariances(order, basePlanned, actual);

    expect(result.totalVariance).toBe(0);
    expect(result.inputPriceVariance).toBe(0);
  });

  it('positive inputPriceVariance when overspending on materials', () => {
    const order = makeOrder({ receivedQuantity: 100, scrapQuantity: 0 });
    const actual: ActualCosts = {
      materialCost: 55000,  // 5000 over plan
      activityCost: 20000,
      totalActualCost: 75000,
    };

    const result = calculateVariances(order, basePlanned, actual);

    // Expected material at actual volume = 50000 / 100 × 100 = 50000
    expect(result.inputPriceVariance).toBe(5000);
  });

  it('negative inputPriceVariance when underspending', () => {
    const order = makeOrder({ receivedQuantity: 100, scrapQuantity: 0 });
    const actual: ActualCosts = {
      materialCost: 45000,  // 5000 under plan
      activityCost: 20000,
      totalActualCost: 65000,
    };

    const result = calculateVariances(order, basePlanned, actual);

    expect(result.inputPriceVariance).toBe(-5000);
  });

  it('usageVariance when using more material than BOM', () => {
    // Issued 220 of RAW-001 instead of planned 200 for 100 units, received 100
    const order = makeOrder({
      receivedQuantity: 100,
      scrapQuantity: 0,
      components: [
        { materialId: 'RAW-001', plannedQuantity: 200, issuedQuantity: 220, unit: 'EA', backflush: false },
        { materialId: 'RAW-002', plannedQuantity: 100, issuedQuantity: 100, unit: 'KG', backflush: false },
      ],
    });

    // Planned costs: RAW-001 at 50000 total → 250/unit, RAW-002 at 50000 → 500/unit
    // Split evenly: each component gets proportional share
    const planned: PlannedCosts = {
      materialCost: 50000,
      activityCost: 20000,
      totalPlannedCost: 70000,
    };
    const actual: ActualCosts = {
      materialCost: 55000,  // higher due to more material
      activityCost: 20000,
      totalActualCost: 75000,
    };

    const result = calculateVariances(order, planned, actual);

    // Usage variance should be positive (used more than planned)
    // RAW-001: (220 - 200) × planned price per unit
    // RAW-001 planned share = 50000 × (200/300) = 33333, price/unit = 33333/200 = 166.67
    // RAW-002 planned share = 50000 × (100/300) = 16667, price/unit = 16667/100 = 166.67
    // Usage variance RAW-001 = 20 × 166.67 = 3333, RAW-002 = 0
    expect(result.usageVariance).toBeGreaterThan(0);
  });

  it('scrapVariance when scrap exceeds plan', () => {
    const order = makeOrder({
      receivedQuantity: 90,
      scrapQuantity: 10,
    });
    const actual: ActualCosts = {
      materialCost: 50000,
      activityCost: 20000,
      totalActualCost: 70000,
    };

    // 5% planned scrap rate, actual = 10/(90+10) = 10%
    const result = calculateVariances(order, basePlanned, actual, 5);

    // scrapVariance = (0.10 - 0.05) × 700 × 100 = 3500
    expect(result.scrapVariance).toBe(3500);
  });

  it('lotSizeVariance when producing less than planned', () => {
    const order = makeOrder({
      receivedQuantity: 80,
      scrapQuantity: 0,
    });
    const actual: ActualCosts = {
      materialCost: 50000,
      activityCost: 20000,
      totalActualCost: 70000,
    };

    const result = calculateVariances(order, basePlanned, actual);

    // lotSizeVariance = activityCost × (1 - received/planned) = 20000 × (1 - 0.8) = 4000
    expect(result.lotSizeVariance).toBe(4000);
  });

  it('totalVariance = sum of all categories', () => {
    const order = makeOrder({
      receivedQuantity: 90,
      scrapQuantity: 10,
    });
    const actual: ActualCosts = {
      materialCost: 48000,
      activityCost: 22000,
      totalActualCost: 70000,
    };

    const result = calculateVariances(order, basePlanned, actual, 5);

    const categorySum = result.inputPriceVariance
      + result.usageVariance
      + result.scrapVariance
      + result.lotSizeVariance
      + result.mixVariance;

    expect(result.totalVariance).toBe(categorySum);
  });

  it('mixVariance captures residual', () => {
    const order = makeOrder({
      receivedQuantity: 95,
      scrapQuantity: 5,
    });
    const actual: ActualCosts = {
      materialCost: 52000,
      activityCost: 21000,
      totalActualCost: 73000,
    };

    const result = calculateVariances(order, basePlanned, actual, 2);

    // mixVariance = total - (inputPrice + usage + scrap + lotSize)
    const otherVariances = result.inputPriceVariance
      + result.usageVariance
      + result.scrapVariance
      + result.lotSizeVariance;

    expect(result.mixVariance).toBe(result.totalVariance - otherVariances);
  });
});

// ---------------------------------------------------------------------------
// Scrap Analysis
// ---------------------------------------------------------------------------

describe('analyzeScrap', () => {
  it('filters scrap moves only', () => {
    const moves: Move[] = [
      makeMove({ id: 'M1', toLocationId: 'virtual/scrap', quantity: 10 }),
      makeMove({ id: 'M2', toLocationId: 'loc-warehouse', quantity: 100 }),
      makeMove({ id: 'M3', toLocationId: 'virtual/scrap/bin', quantity: 5 }),
    ];

    const result = analyzeScrap(moves);

    // Should only include M1 and M3 (both have 'scrap' in toLocationId)
    expect(result.length).toBe(1); // grouped by material, both RAW-001
    expect(result[0]!.totalScrap).toBe(15); // 10 + 5
  });

  it('groups by material', () => {
    const moves: Move[] = [
      makeMove({ id: 'M1', materialId: 'RAW-001', toLocationId: 'virtual/scrap', quantity: 10 }),
      makeMove({ id: 'M2', materialId: 'RAW-002', toLocationId: 'virtual/scrap', quantity: 20 }),
      makeMove({ id: 'M3', materialId: 'RAW-001', toLocationId: 'virtual/scrap', quantity: 5 }),
    ];

    const result = analyzeScrap(moves, undefined, 'material');

    expect(result.length).toBe(2);
    // Sorted by totalScrap descending
    expect(result[0]!.key).toBe('RAW-002');
    expect(result[0]!.totalScrap).toBe(20);
    expect(result[1]!.key).toBe('RAW-001');
    expect(result[1]!.totalScrap).toBe(15);
  });

  it('groups by reference (order)', () => {
    const moves: Move[] = [
      makeMove({ id: 'M1', reference: 'PO-001', toLocationId: 'virtual/scrap', quantity: 10 }),
      makeMove({ id: 'M2', reference: 'PO-002', toLocationId: 'virtual/scrap', quantity: 8 }),
      makeMove({ id: 'M3', reference: 'PO-001', toLocationId: 'virtual/scrap', quantity: 7 }),
    ];

    const result = analyzeScrap(moves, undefined, 'reference');

    expect(result.length).toBe(2);
    expect(result[0]!.key).toBe('PO-001');
    expect(result[0]!.totalScrap).toBe(17);
    expect(result[1]!.key).toBe('PO-002');
    expect(result[1]!.totalScrap).toBe(8);
  });

  it('calculates variance vs planned', () => {
    const moves: Move[] = [
      makeMove({ id: 'M1', materialId: 'RAW-001', toLocationId: 'virtual/scrap', quantity: 50 }),
    ];

    const materials = new Map([
      ['RAW-001', { description: 'Steel Rod', plannedScrapRate: 5 }],
    ]);

    const result = analyzeScrap(moves, materials, 'material');

    expect(result.length).toBe(1);
    expect(result[0]!.totalScrap).toBe(50);
    // plannedScrap = 50 × (5/100) = 2.5 → round to 3
    expect(result[0]!.plannedScrap).toBe(3);
    // variance = 50 - 3 = 47
    expect(result[0]!.variance).toBe(47);
  });
});
