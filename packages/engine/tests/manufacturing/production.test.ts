import { describe, expect, it } from 'vitest';
import type { BOM, ProductionOrder } from '../../src/types.js';
import {
  createProductionOrder,
  transitionOrder,
  releaseOrder,
  getOrderCompletion,
  confirmOperation,
  recordComponentIssue,
  recordGoodsReceipt,
  calculateBackflush,
  generateBackflushMoves,
  MANUFACTURING_PRESETS,
  registerManufacturingPresets,
} from '../../src/manufacturing/index.js';
import { PresetRegistry } from '../../src/presets/registry.js';
import { VIRTUAL_LOCATIONS } from '../../src/locations/virtual.js';

// ---------------------------------------------------------------------------
// Sample BOM: Bread (base quantity 100 loaves)
// ---------------------------------------------------------------------------

const breadBOM: BOM = {
  id: 'BOM-BREAD-001',
  parentMaterialId: 'MAT-BREAD',
  baseQuantity: 100,
  baseUnit: 'EA',
  usage: 'production',
  validFrom: new Date('2026-01-01'),
  validTo: null,
  components: [
    {
      materialId: 'MAT-FLOUR',
      quantity: 30,
      unit: 'KG',
      itemCategory: 'stock',
      scrapPercentage: 0,
      backflush: true,
      position: 10,
    },
    {
      materialId: 'MAT-YEAST',
      quantity: 2,
      unit: 'KG',
      itemCategory: 'stock',
      scrapPercentage: 0,
      backflush: true,
      position: 20,
    },
    {
      materialId: 'MAT-WATER',
      quantity: 20,
      unit: 'LT',
      itemCategory: 'stock',
      scrapPercentage: 0,
      backflush: false,
      position: 30,
    },
  ],
  active: true,
};

const sampleOperations = [
  { id: 'OP-10', sequence: 10, description: 'Mixing', plannedTime: 60 },
  { id: 'OP-20', sequence: 20, description: 'Baking', workCenterId: 'WC-OVEN', plannedTime: 120 },
];

// Helper: create a released order for 500 loaves
function createReleasedOrder(): ProductionOrder {
  const order = createProductionOrder({
    materialId: 'MAT-BREAD',
    quantity: 500,
    unit: 'EA',
    bom: breadBOM,
    plantLocationId: 'PLANT-01',
    operations: sampleOperations,
  });
  return releaseOrder(order);
}

// ---------------------------------------------------------------------------
// Order creation
// ---------------------------------------------------------------------------

describe('Order creation', () => {
  it('creates order in created status', () => {
    const order = createProductionOrder({
      materialId: 'MAT-BREAD',
      quantity: 500,
      unit: 'EA',
      bom: breadBOM,
      plantLocationId: 'PLANT-01',
    });
    expect(order.status).toBe('created');
    expect(order.materialId).toBe('MAT-BREAD');
    expect(order.plannedQuantity).toBe(500);
  });

  it('explodes BOM into components scaled to order quantity', () => {
    const order = createProductionOrder({
      materialId: 'MAT-BREAD',
      quantity: 500,
      unit: 'EA',
      bom: breadBOM,
      plantLocationId: 'PLANT-01',
    });
    // 500 / 100 = 5x scale
    expect(order.components).toHaveLength(3);
    expect(order.components[0]).toMatchObject({
      materialId: 'MAT-FLOUR',
      plannedQuantity: 150, // 30 * 5
      unit: 'KG',
      backflush: true,
    });
    expect(order.components[1]).toMatchObject({
      materialId: 'MAT-YEAST',
      plannedQuantity: 10, // 2 * 5
      unit: 'KG',
      backflush: true,
    });
    expect(order.components[2]).toMatchObject({
      materialId: 'MAT-WATER',
      plannedQuantity: 100, // 20 * 5
      unit: 'LT',
      backflush: false,
    });
  });

  it('sets all quantities to 0', () => {
    const order = createProductionOrder({
      materialId: 'MAT-BREAD',
      quantity: 500,
      unit: 'EA',
      bom: breadBOM,
      plantLocationId: 'PLANT-01',
      operations: sampleOperations,
    });
    expect(order.receivedQuantity).toBe(0);
    expect(order.scrapQuantity).toBe(0);
    for (const c of order.components) {
      expect(c.issuedQuantity).toBe(0);
    }
    for (const op of order.operations) {
      expect(op.confirmedTime).toBe(0);
      expect(op.confirmedYield).toBe(0);
      expect(op.confirmedScrap).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

describe('Status transitions', () => {
  it('releaseOrder transitions to released', () => {
    const order = createProductionOrder({
      materialId: 'MAT-BREAD',
      quantity: 500,
      unit: 'EA',
      bom: breadBOM,
      plantLocationId: 'PLANT-01',
    });
    const released = releaseOrder(order);
    expect(released.status).toBe('released');
  });

  it('created → released works', () => {
    const order = createProductionOrder({
      materialId: 'MAT-BREAD',
      quantity: 500,
      unit: 'EA',
      bom: breadBOM,
      plantLocationId: 'PLANT-01',
    });
    const result = transitionOrder(order, 'released');
    expect(result.status).toBe('released');
  });

  it('released → partially-confirmed works', () => {
    const order = createReleasedOrder();
    const result = transitionOrder(order, 'partially-confirmed');
    expect(result.status).toBe('partially-confirmed');
  });

  it('confirmed → technically-complete works', () => {
    const order = createReleasedOrder();
    const confirmed = transitionOrder(order, 'confirmed');
    const result = transitionOrder(confirmed, 'technically-complete');
    expect(result.status).toBe('technically-complete');
  });

  it('invalid transition throws', () => {
    const order = createProductionOrder({
      materialId: 'MAT-BREAD',
      quantity: 500,
      unit: 'EA',
      bom: breadBOM,
      plantLocationId: 'PLANT-01',
    });
    // created → technically-complete is not valid
    expect(() => transitionOrder(order, 'technically-complete')).toThrow(
      'Invalid transition',
    );
  });
});

// ---------------------------------------------------------------------------
// Confirmation
// ---------------------------------------------------------------------------

describe('Confirmation', () => {
  it('confirmOperation updates operation confirmed values', () => {
    const order = createReleasedOrder();
    const result = confirmOperation(order, 'OP-10', {
      yield: 480,
      scrap: 20,
      time: 55,
    });
    const op = result.operations.find((o) => o.id === 'OP-10')!;
    expect(op.confirmedYield).toBe(480);
    expect(op.confirmedScrap).toBe(20);
    expect(op.confirmedTime).toBe(55);
  });

  it('confirmOperation with multiple operations', () => {
    let order = createReleasedOrder();
    order = confirmOperation(order, 'OP-10', { yield: 500, scrap: 0, time: 58 });
    order = confirmOperation(order, 'OP-20', { yield: 490, scrap: 10, time: 115 });

    const op10 = order.operations.find((o) => o.id === 'OP-10')!;
    const op20 = order.operations.find((o) => o.id === 'OP-20')!;
    expect(op10.confirmedYield).toBe(500);
    expect(op20.confirmedYield).toBe(490);
    expect(op20.confirmedScrap).toBe(10);
  });

  it('recordComponentIssue increases issuedQuantity', () => {
    const order = createReleasedOrder();
    const result = recordComponentIssue(order, 'MAT-FLOUR', 50);
    const flour = result.components.find((c) => c.materialId === 'MAT-FLOUR')!;
    expect(flour.issuedQuantity).toBe(50);
  });

  it('recordComponentIssue for unknown component throws', () => {
    const order = createReleasedOrder();
    expect(() => recordComponentIssue(order, 'MAT-UNKNOWN', 10)).toThrow(
      'Component not found',
    );
  });

  it('recordGoodsReceipt increases receivedQuantity', () => {
    const order = createReleasedOrder();
    const result = recordGoodsReceipt(order, 480);
    expect(result.receivedQuantity).toBe(480);
  });

  it('recordGoodsReceipt adds scrap', () => {
    const order = createReleasedOrder();
    const result = recordGoodsReceipt(order, 480, 20);
    expect(result.receivedQuantity).toBe(480);
    expect(result.scrapQuantity).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// Completion
// ---------------------------------------------------------------------------

describe('Completion', () => {
  it('calculates yield percentage', () => {
    let order = createReleasedOrder();
    order = recordGoodsReceipt(order, 250);
    const completion = getOrderCompletion(order);
    expect(completion.yieldPercentage).toBe(50); // 250/500
  });

  it('calculates component issue percentage', () => {
    let order = createReleasedOrder();
    // Issue half of each component
    order = recordComponentIssue(order, 'MAT-FLOUR', 75);  // 75/150
    order = recordComponentIssue(order, 'MAT-YEAST', 5);   // 5/10
    order = recordComponentIssue(order, 'MAT-WATER', 50);  // 50/100
    const completion = getOrderCompletion(order);
    // total issued = 130, total planned = 260
    expect(completion.componentIssuePercentage).toBe(50);
  });

  it('handles zero planned values', () => {
    const order = createProductionOrder({
      materialId: 'MAT-BREAD',
      quantity: 500,
      unit: 'EA',
      bom: { ...breadBOM, components: [] },
      plantLocationId: 'PLANT-01',
    });
    const completion = getOrderCompletion(order);
    expect(completion.componentIssuePercentage).toBe(0);
    expect(completion.timePercentage).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Backflush
// ---------------------------------------------------------------------------

describe('Backflush', () => {
  it('returns correct quantities for backflush components', () => {
    const order = createReleasedOrder();
    // Confirmed output: 480 yield + 20 scrap = 500 total
    const consumptions = calculateBackflush(order, 480, 20);

    // Flour: ratio = 150/500 = 0.3, consume = round(500 * 0.3) = 150
    // Yeast: ratio = 10/500 = 0.02, consume = round(500 * 0.02) = 10
    expect(consumptions).toHaveLength(2); // Only backflush components
    const flour = consumptions.find((c) => c.materialId === 'MAT-FLOUR')!;
    const yeast = consumptions.find((c) => c.materialId === 'MAT-YEAST')!;
    expect(flour.quantity).toBe(150);
    expect(yeast.quantity).toBe(10);
  });

  it('skips non-backflush components', () => {
    const order = createReleasedOrder();
    const consumptions = calculateBackflush(order, 480, 20);
    const water = consumptions.find((c) => c.materialId === 'MAT-WATER');
    expect(water).toBeUndefined();
  });

  it('accounts for already issued quantities', () => {
    let order = createReleasedOrder();
    // Issue 50 KG of flour already
    order = recordComponentIssue(order, 'MAT-FLOUR', 50);

    const consumptions = calculateBackflush(order, 480, 20);
    const flour = consumptions.find((c) => c.materialId === 'MAT-FLOUR')!;
    // consume = 150, already issued = 50, net = 100
    expect(flour.quantity).toBe(100);
  });

  it('generateBackflushMoves creates correct moves', () => {
    const order = createReleasedOrder();
    const consumptions = calculateBackflush(order, 480, 20);
    const moves = generateBackflushMoves(order, consumptions);

    expect(moves).toHaveLength(2);
    for (const move of moves) {
      expect(move.fromLocationId).toBe('PLANT-01');
      expect(move.toLocationId).toBe(VIRTUAL_LOCATIONS.PRODUCTION);
      expect(move.state).toBe('draft');
      expect(move.presetCode).toBe('261');
    }
  });

  it('generateBackflushMoves sets reference to order ID', () => {
    const order = createReleasedOrder();
    const consumptions = calculateBackflush(order, 480, 20);
    const moves = generateBackflushMoves(order, consumptions);

    for (const move of moves) {
      expect(move.reference).toBe(order.id);
    }
  });
});

// ---------------------------------------------------------------------------
// Manufacturing presets
// ---------------------------------------------------------------------------

describe('Manufacturing presets', () => {
  it('registers 261 and 262 into registry', () => {
    const registry = new PresetRegistry();
    registerManufacturingPresets(registry);
    expect(registry.has('261')).toBe(true);
    expect(registry.has('262')).toBe(true);
  });

  it('261 resolves from storage to virtual/production', () => {
    const registry = new PresetRegistry();
    registerManufacturingPresets(registry);
    const move = registry.fromPreset('261', {
      materialId: 'MAT-FLOUR',
      quantity: 150,
      unit: 'KG',
      storageLocation: 'PLANT-01',
      reference: 'PO-001',
    });
    expect(move.fromLocationId).toBe('PLANT-01');
    expect(move.toLocationId).toBe(VIRTUAL_LOCATIONS.PRODUCTION);
  });

  it('262 resolves from virtual/production to storage', () => {
    const registry = new PresetRegistry();
    registerManufacturingPresets(registry);
    const move = registry.fromPreset('262', {
      materialId: 'MAT-FLOUR',
      quantity: 10,
      unit: 'KG',
      storageLocation: 'PLANT-01',
      reference: 'PO-001',
    });
    expect(move.fromLocationId).toBe(VIRTUAL_LOCATIONS.PRODUCTION);
    expect(move.toLocationId).toBe('PLANT-01');
  });

  it('MANUFACTURING_PRESETS exports correct config', () => {
    expect(MANUFACTURING_PRESETS['261'].requiresReference).toBe(true);
    expect(MANUFACTURING_PRESETS['261'].consumesValuationLayer).toBe(true);
    expect(MANUFACTURING_PRESETS['262'].createsValuationLayer).toBe(true);
  });
});
