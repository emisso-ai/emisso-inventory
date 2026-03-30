/**
 * End-to-end integration tests exercising multiple modules together.
 *
 * Each scenario composes moves, quants, valuation, presets, routes,
 * physical inventory, manufacturing, and barcodes into realistic
 * warehouse workflows.
 */
import { describe, it, expect } from 'vitest';

import {
  // Moves
  createMove,
  applyMove,
  // Quants
  getAvailableStock,
  projectQuants,
  findQuant,
  // Presets
  fromPreset,
  // Valuation
  createValuationLayer,
  consumeFIFO,
  calculateAverageCost,
  consumeAVCO,
  // Locations
  VIRTUAL_LOCATIONS,
  location,
  createWarehouseLocations,
  createVirtualLocations,
  // Physical inventory
  createPIDocument,
  enterCount,
  finalizeCounting,
  postDifferences,
  // Routes
  defineRoute,
  applyRoute,
  // Barcode
  encodeGS1,
  decodeGS1,
  // Types
  type Move,
  type Quant,
  type ValuationLayer,
  type Material,
} from '../../src/index.js';

import {
  explodeBOM,
  createProductionOrder,
  releaseOrder,
  calculateBackflush,
  generateBackflushMoves,
  calculateWIP,
  recordComponentIssue,
  recordGoodsReceipt,
} from '../../src/manufacturing.js';

import { buildLocationTree, STORAGE } from '../fixtures/locations.js';
import { FLOUR, YEAST, WATER, BREAD, PACKAGING_BOX, MATERIALS } from '../fixtures/materials.js';
import { BREAD_BOM } from '../fixtures/scenarios.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shorthand: receive material via preset 101 and apply immediately. */
function receiveStock(
  materialId: string,
  qty: number,
  unitCost: number,
  storageLocation: string,
  quants: Quant[],
  layers: ValuationLayer[],
  material: Material,
  opts?: { batchId?: string; timestamp?: Date },
) {
  const move = fromPreset('101', {
    materialId,
    quantity: qty,
    unitCost,
    storageLocation,
    reference: 'PO-001',
    batchId: opts?.batchId ?? null,
    timestamp: opts?.timestamp,
  });
  return applyMove(move, quants, layers, material);
}

/** Shorthand: create a reversal move (swap from/to of original). */
function createReversal(original: Move): Move {
  return createMove({
    materialId: original.materialId,
    fromLocationId: original.toLocationId,
    toLocationId: original.fromLocationId,
    quantity: original.quantity,
    unitCost: original.unitCost,
    reference: original.reference,
    batchId: original.batchId,
    presetCode: '102', // reversal of 101
  });
}

// ===========================================================================
// Scenario 1: Distribution lifecycle
// ===========================================================================

describe('Scenario 1 — Distribution lifecycle', () => {
  it('1. receives 100 FLOUR at receiving via preset 101', () => {
    const result = receiveStock(
      'FLOUR', 100, 500, STORAGE.RECEIVING, [], [], FLOUR, { batchId: 'B1' },
    );

    expect(result.move.state).toBe('done');
    expect(result.newLayers).toHaveLength(1);
    expect(result.newLayers[0]!.quantity).toBe(100);
    expect(result.newLayers[0]!.unitCost).toBe(500);
  });

  it('2. quant shows 100 available at receiving', () => {
    const r = receiveStock(
      'FLOUR', 100, 500, STORAGE.RECEIVING, [], [], FLOUR, { batchId: 'B1' },
    );
    const avail = getAvailableStock(r.newQuants, 'FLOUR', STORAGE.RECEIVING);
    expect(avail).toBe(100);
  });

  it('3-4. transfer to raw-materials zeroes receiving, fills raw-materials', () => {
    // Receive first
    const r1 = receiveStock(
      'FLOUR', 100, 500, STORAGE.RECEIVING, [], [], FLOUR, { batchId: 'B1' },
    );

    // Transfer via preset 311
    const transfer = fromPreset('311', {
      materialId: 'FLOUR',
      quantity: 100,
      storageLocation: STORAGE.RECEIVING,
      toStorageLocation: STORAGE.RAW_MATERIALS,
      batchId: 'B1',
    });
    const r2 = applyMove(transfer, r1.newQuants, r1.newLayers, FLOUR);

    expect(getAvailableStock(r2.newQuants, 'FLOUR', STORAGE.RECEIVING)).toBe(0);
    expect(getAvailableStock(r2.newQuants, 'FLOUR', STORAGE.RAW_MATERIALS)).toBe(100);
  });

  it('5. second receipt at different price recalculates AVCO', () => {
    const t1 = new Date('2025-01-01');
    const t2 = new Date('2025-01-02');

    // First receipt: 100 @ 500
    const r1 = receiveStock(
      'FLOUR', 100, 500, STORAGE.RAW_MATERIALS, [], [], FLOUR, { timestamp: t1 },
    );

    // Second receipt: 50 @ 800
    const r2 = receiveStock(
      'FLOUR', 50, 800, STORAGE.RAW_MATERIALS, r1.newQuants, r1.newLayers, FLOUR, { timestamp: t2 },
    );

    expect(getAvailableStock(r2.newQuants, 'FLOUR', STORAGE.RAW_MATERIALS)).toBe(150);

    // AVCO = (100*500 + 50*800) / 150 = 90000/150 = 600
    const avco = calculateAverageCost(r2.newLayers, 'FLOUR');
    expect(avco).toBe(600);
  });

  it('6. ship 30 to customer via preset 601 generates COGS entry', () => {
    const r1 = receiveStock(
      'FLOUR', 100, 500, STORAGE.SHIPPING, [], [], FLOUR,
    );

    const sale = fromPreset('601', {
      materialId: 'FLOUR',
      quantity: 30,
      storageLocation: STORAGE.SHIPPING,
      reference: 'SO-001',
    });
    const r2 = applyMove(sale, r1.newQuants, r1.newLayers, FLOUR);

    // COGS entry should exist
    const cogs = r2.accountingEntries.find((e) => e.type === 'cogs');
    expect(cogs).toBeDefined();
    expect(cogs!.amount).toBe(30 * 500); // 15000

    // Inventory credit
    const credit = r2.accountingEntries.find((e) => e.type === 'inventory-credit');
    expect(credit).toBeDefined();
    expect(credit!.amount).toBe(-15000);

    // Remaining stock
    expect(getAvailableStock(r2.newQuants, 'FLOUR', STORAGE.SHIPPING)).toBe(70);
  });
});

// ===========================================================================
// Scenario 2: Physical inventory
// ===========================================================================

describe('Scenario 2 — Physical inventory', () => {
  function setupStock() {
    // Start with 100 FLOUR at raw-materials
    const r = receiveStock(
      'FLOUR', 100, 500, STORAGE.RAW_MATERIALS, [], [], FLOUR,
    );
    return { quants: r.newQuants, layers: r.newLayers };
  }

  it('7-8. creates PI document from known stock', () => {
    const { quants } = setupStock();
    const bookQty = getAvailableStock(quants, 'FLOUR', STORAGE.RAW_MATERIALS);

    const doc = createPIDocument([
      { materialId: 'FLOUR', locationId: STORAGE.RAW_MATERIALS, bookQuantity: bookQty },
    ]);

    expect(doc.state).toBe('open');
    expect(doc.items).toHaveLength(1);
    expect(doc.items[0]!.bookQuantity).toBe(100);
  });

  it('9-10. enter counts, post differences, verify 701/702 moves', () => {
    const { quants, layers } = setupStock();
    const bookQty = getAvailableStock(quants, 'FLOUR', STORAGE.RAW_MATERIALS);

    let doc = createPIDocument([
      { materialId: 'FLOUR', locationId: STORAGE.RAW_MATERIALS, bookQuantity: bookQty },
    ]);

    // Count reveals only 90 (loss of 10)
    doc = enterCount(doc, 'FLOUR', STORAGE.RAW_MATERIALS, 90);
    expect(doc.state).toBe('counting');
    expect(doc.items[0]!.difference).toBe(-10);

    doc = finalizeCounting(doc);
    expect(doc.state).toBe('counted');

    const { postedDoc, adjustmentMoves } = postDifferences(doc, layers);
    expect(postedDoc.state).toBe('posted');

    // One adjustment move for the loss (702)
    expect(adjustmentMoves).toHaveLength(1);
    expect(adjustmentMoves[0]!.presetCode).toBe('702');
    expect(adjustmentMoves[0]!.quantity).toBe(10);
  });

  it('11. applying adjustment moves updates quants to match counted values', () => {
    const { quants, layers } = setupStock();
    const bookQty = getAvailableStock(quants, 'FLOUR', STORAGE.RAW_MATERIALS);

    let doc = createPIDocument([
      { materialId: 'FLOUR', locationId: STORAGE.RAW_MATERIALS, bookQuantity: bookQty },
    ]);
    doc = enterCount(doc, 'FLOUR', STORAGE.RAW_MATERIALS, 90);
    doc = finalizeCounting(doc);
    const { adjustmentMoves } = postDifferences(doc, layers);

    // Apply adjustment move
    let currentQuants = quants;
    let currentLayers = layers;
    for (const adjMove of adjustmentMoves) {
      const result = applyMove(adjMove, currentQuants, currentLayers, FLOUR);
      currentQuants = result.newQuants;
      currentLayers = result.newLayers;
    }

    expect(getAvailableStock(currentQuants, 'FLOUR', STORAGE.RAW_MATERIALS)).toBe(90);
  });
});

// ===========================================================================
// Scenario 3: Multi-step route
// ===========================================================================

describe('Scenario 3 — Multi-step route', () => {
  it('12-15. 3-step receipt route generates and applies 3 moves', () => {
    // Define route: supplier → receiving → quality → raw-materials
    const route = defineRoute({
      name: 'Receipt with QC',
      steps: [
        {
          fromLocationId: VIRTUAL_LOCATIONS.SUPPLIER,
          toLocationId: STORAGE.RECEIVING,
          trigger: 'push',
        },
        {
          fromLocationId: STORAGE.RECEIVING,
          toLocationId: STORAGE.RAW_MATERIALS,
          trigger: 'push',
        },
        {
          fromLocationId: STORAGE.RAW_MATERIALS,
          toLocationId: STORAGE.PRODUCTION_FLOOR,
          trigger: 'push',
        },
      ],
    });

    expect(route.steps).toHaveLength(3);

    // Create initial receipt move
    const initialMove = createMove({
      materialId: 'FLOUR',
      fromLocationId: VIRTUAL_LOCATIONS.SUPPLIER,
      toLocationId: STORAGE.PRODUCTION_FLOOR,
      quantity: 50,
      unitCost: 500,
      reference: 'PO-002',
    });

    // Apply route → expands to 3 moves
    const routeMoves = applyRoute(route, initialMove);
    expect(routeMoves).toHaveLength(3);
    expect(routeMoves[0]!.fromLocationId).toBe(VIRTUAL_LOCATIONS.SUPPLIER);
    expect(routeMoves[0]!.toLocationId).toBe(STORAGE.RECEIVING);
    expect(routeMoves[2]!.toLocationId).toBe(STORAGE.PRODUCTION_FLOOR);

    // Apply each move sequentially
    let quants: Quant[] = [];
    let layers: ValuationLayer[] = [];

    for (const m of routeMoves) {
      const result = applyMove(m, quants, layers, FLOUR);
      quants = result.newQuants;
      layers = result.newLayers;
    }

    // Stock should be at the final location only
    expect(getAvailableStock(quants, 'FLOUR', STORAGE.RECEIVING)).toBe(0);
    expect(getAvailableStock(quants, 'FLOUR', STORAGE.RAW_MATERIALS)).toBe(0);
    expect(getAvailableStock(quants, 'FLOUR', STORAGE.PRODUCTION_FLOOR)).toBe(50);
  });
});

// ===========================================================================
// Scenario 4: Manufacturing lifecycle
// ===========================================================================

describe('Scenario 4 — Manufacturing lifecycle', () => {
  function setupRawMaterials() {
    let quants: Quant[] = [];
    let layers: ValuationLayer[] = [];

    // Receive FLOUR: 200 KG @ 500
    const r1 = receiveStock('FLOUR', 200, 500, STORAGE.RAW_MATERIALS, quants, layers, FLOUR);
    quants = r1.newQuants;
    layers = r1.newLayers;

    // Receive YEAST: 20 KG @ 3000
    const r2 = receiveStock('YEAST', 20, 3000, STORAGE.RAW_MATERIALS, quants, layers, YEAST);
    quants = r2.newQuants;
    layers = r2.newLayers;

    // Receive WATER: 200 LT @ 10
    const r3 = receiveStock('WATER', 200, 10, STORAGE.RAW_MATERIALS, quants, layers, WATER);
    quants = r3.newQuants;
    layers = r3.newLayers;

    return { quants, layers };
  }

  it('16. receives raw materials', () => {
    const { quants } = setupRawMaterials();
    expect(getAvailableStock(quants, 'FLOUR', STORAGE.RAW_MATERIALS)).toBe(200);
    expect(getAvailableStock(quants, 'YEAST', STORAGE.RAW_MATERIALS)).toBe(20);
    expect(getAvailableStock(quants, 'WATER', STORAGE.RAW_MATERIALS)).toBe(200);
  });

  it('17. explodes bread BOM for 500 units', () => {
    const reqs = explodeBOM(BREAD_BOM, 500, { includeScrap: true });

    // FLOUR: (30/100)*500 = 150 + 2% scrap = 150 + 3 = 153
    const flour = reqs.find((r) => r.materialId === 'FLOUR')!;
    expect(flour.requiredQuantity).toBe(153);
    expect(flour.scrapQuantity).toBe(3);
    expect(flour.includesScrap).toBe(true);

    // YEAST: (2/100)*500 = 10
    const yeast = reqs.find((r) => r.materialId === 'YEAST')!;
    expect(yeast.requiredQuantity).toBe(10);

    // WATER: (20/100)*500 = 100
    const water = reqs.find((r) => r.materialId === 'WATER')!;
    expect(water.requiredQuantity).toBe(100);
  });

  it('18-19. creates and releases production order', () => {
    let order = createProductionOrder({
      materialId: 'BREAD',
      quantity: 500,
      unit: 'EA',
      bom: BREAD_BOM,
      plantLocationId: STORAGE.RAW_MATERIALS,
      operations: [
        { id: 'OP10', sequence: 10, description: 'Mixing', workCenterId: 'WC-MIX', plannedTime: 60 },
        { id: 'OP20', sequence: 20, description: 'Baking', workCenterId: 'WC-OVEN', plannedTime: 120 },
      ],
    });

    expect(order.status).toBe('created');
    expect(order.components).toHaveLength(3);
    expect(order.plannedQuantity).toBe(500);

    order = releaseOrder(order);
    expect(order.status).toBe('released');
  });

  it('20-21. calculates backflush and generates consumption moves', () => {
    let order = createProductionOrder({
      materialId: 'BREAD',
      quantity: 500,
      unit: 'EA',
      bom: BREAD_BOM,
      plantLocationId: STORAGE.RAW_MATERIALS,
    });
    order = releaseOrder(order);

    // 480 yield + 20 scrap = 500 total output
    const consumptions = calculateBackflush(order, 480, 20);

    // Only backflush components: FLOUR and YEAST (not WATER)
    expect(consumptions).toHaveLength(2);
    const flourConsumption = consumptions.find((c) => c.materialId === 'FLOUR')!;
    const yeastConsumption = consumptions.find((c) => c.materialId === 'YEAST')!;

    // FLOUR: ratio = 150/500 = 0.3, consume = round(500 * 0.3) = 150
    expect(flourConsumption.quantity).toBe(150);
    // YEAST: ratio = 10/500 = 0.02, consume = round(500 * 0.02) = 10
    expect(yeastConsumption.quantity).toBe(10);

    // Generate moves
    const moves = generateBackflushMoves(order, consumptions);
    expect(moves).toHaveLength(2);
    expect(moves[0]!.presetCode).toBe('261');
    expect(moves[0]!.toLocationId).toBe(VIRTUAL_LOCATIONS.PRODUCTION);
  });

  it('22. applies backflush moves and receives finished goods', () => {
    const { quants: initialQuants, layers: initialLayers } = setupRawMaterials();

    let order = createProductionOrder({
      materialId: 'BREAD',
      quantity: 500,
      unit: 'EA',
      bom: BREAD_BOM,
      plantLocationId: STORAGE.RAW_MATERIALS,
    });
    order = releaseOrder(order);

    const consumptions = calculateBackflush(order, 480, 20);
    const backflushMoves = generateBackflushMoves(order, consumptions);

    // Apply backflush moves (material goes to virtual/production)
    let quants = initialQuants;
    let layers = initialLayers;

    for (const m of backflushMoves) {
      const result = applyMove(m, quants, layers, MATERIALS[m.materialId]!);
      quants = result.newQuants;
      layers = result.newLayers;
    }

    // Record consumption on order
    for (const c of consumptions) {
      order = recordComponentIssue(order, c.materialId, c.quantity);
    }

    // FLOUR: 200 - 150 = 50 remaining
    expect(getAvailableStock(quants, 'FLOUR', STORAGE.RAW_MATERIALS)).toBe(50);
    // YEAST: 20 - 10 = 10 remaining
    expect(getAvailableStock(quants, 'YEAST', STORAGE.RAW_MATERIALS)).toBe(10);

    // Receive finished goods (virtual/production → finished-goods)
    const fgReceipt = createMove({
      materialId: 'BREAD',
      fromLocationId: VIRTUAL_LOCATIONS.PRODUCTION,
      toLocationId: STORAGE.FINISHED_GOODS,
      quantity: 480,
      unitCost: 400, // production cost per unit
      reference: order.id,
    });

    const fgResult = applyMove(fgReceipt, quants, layers, BREAD);
    order = recordGoodsReceipt(order, 480, 20);

    expect(getAvailableStock(fgResult.newQuants, 'BREAD', STORAGE.FINISHED_GOODS)).toBe(480);
    expect(order.receivedQuantity).toBe(480);
    expect(order.scrapQuantity).toBe(20);
  });

  it('23. calculates WIP for the production order', () => {
    let order = createProductionOrder({
      materialId: 'BREAD',
      quantity: 500,
      unit: 'EA',
      bom: BREAD_BOM,
      plantLocationId: STORAGE.RAW_MATERIALS,
      operations: [
        { id: 'OP10', sequence: 10, description: 'Mixing', workCenterId: 'WC-MIX', plannedTime: 60 },
        { id: 'OP20', sequence: 20, description: 'Baking', workCenterId: 'WC-OVEN', plannedTime: 120 },
      ],
    });
    order = releaseOrder(order);

    // Simulate partial consumption
    order = recordComponentIssue(order, 'FLOUR', 150);
    order = recordComponentIssue(order, 'YEAST', 10);

    const materialPrices = new Map<string, number>([
      ['FLOUR', 500],
      ['YEAST', 3000],
    ]);

    const activityRates = new Map<string, number>([
      ['WC-MIX', 100],  // 100 cents/min
      ['WC-OVEN', 150], // 150 cents/min
    ]);

    const wip = calculateWIP(order, materialPrices, activityRates, 10);

    // Material cost: 150*500 + 10*3000 = 75000 + 30000 = 105000
    expect(wip.materialCost).toBe(105000);

    // Activity cost: 0 (no confirmed time yet)
    expect(wip.activityCost).toBe(0);

    // Overhead: 105000 * 10% = 10500
    expect(wip.overheadCost).toBe(10500);

    // Total WIP: 105000 + 0 + 10500 = 115500
    expect(wip.totalWIP).toBe(115500);

    // No goods received yet → balance = totalWIP
    expect(wip.balance).toBe(115500);
    expect(wip.deliveredValue).toBe(0);
  });

  it('24. ships finished goods to customer', () => {
    // Receive finished goods first
    const receipt = receiveStock(
      'BREAD', 480, 400, STORAGE.FINISHED_GOODS, [], [], BREAD,
    );

    // Ship to customer
    const sale = fromPreset('601', {
      materialId: 'BREAD',
      quantity: 100,
      storageLocation: STORAGE.FINISHED_GOODS,
      reference: 'SO-100',
    });

    const result = applyMove(sale, receipt.newQuants, receipt.newLayers, BREAD);

    expect(getAvailableStock(result.newQuants, 'BREAD', STORAGE.FINISHED_GOODS)).toBe(380);

    const cogs = result.accountingEntries.find((e) => e.type === 'cogs');
    expect(cogs).toBeDefined();
    expect(cogs!.amount).toBe(100 * 400);
  });
});

// ===========================================================================
// Scenario 5: Barcode round-trip
// ===========================================================================

describe('Scenario 5 — Barcode round-trip', () => {
  it('25-27. encodes and decodes GS1 with all fields matching', () => {
    const data = {
      gtin: '04012345678901',
      batchId: 'BATCH-2025-A',
      serialNumber: 'SN-001',
      expiryDate: new Date(2026, 11, 31), // Dec 31, 2026
      quantity: 100,
      weight: 25.5,
    };

    const encoded = encodeGS1(data);
    const decoded = decodeGS1(encoded);

    expect(decoded.gtin).toBe(data.gtin);
    expect(decoded.batchId).toBe(data.batchId);
    expect(decoded.serialNumber).toBe(data.serialNumber);
    expect(decoded.quantity).toBe(data.quantity);
    expect(decoded.weight).toBeCloseTo(data.weight, 2);

    // Date comparison (year/month/day)
    expect(decoded.expiryDate!.getFullYear()).toBe(2026);
    expect(decoded.expiryDate!.getMonth()).toBe(11);
    expect(decoded.expiryDate!.getDate()).toBe(31);
  });

  it('encodes and decodes minimal GS1 (GTIN only)', () => {
    const encoded = encodeGS1({ gtin: '12345678901234' });
    const decoded = decodeGS1(encoded);
    expect(decoded.gtin).toBe('12345678901234');
    expect(decoded.batchId).toBeNull();
  });
});

// ===========================================================================
// Scenario 6: Reversal
// ===========================================================================

describe('Scenario 6 — Reversal', () => {
  it('28-30. applies receipt, reverses it, quants return to zero', () => {
    // Apply receipt
    const r1 = receiveStock(
      'FLOUR', 50, 500, STORAGE.RECEIVING, [], [], FLOUR,
    );

    expect(getAvailableStock(r1.newQuants, 'FLOUR', STORAGE.RECEIVING)).toBe(50);
    expect(r1.newLayers).toHaveLength(1);

    // Create and apply reversal (physical → virtual/supplier)
    const reversal = createReversal(r1.move);
    const r2 = applyMove(reversal, r1.newQuants, r1.newLayers, FLOUR);

    // Stock should be back to 0
    expect(getAvailableStock(r2.newQuants, 'FLOUR', STORAGE.RECEIVING)).toBe(0);

    // Layer should be consumed
    const flourLayer = r2.newLayers.find((l) => l.materialId === 'FLOUR')!;
    expect(flourLayer.remainingQty).toBe(0);
  });

  it('reversal of a transfer restores original positions', () => {
    // Receive at receiving
    const r1 = receiveStock('FLOUR', 80, 500, STORAGE.RECEIVING, [], [], FLOUR);

    // Transfer to raw-materials
    const xfer = fromPreset('311', {
      materialId: 'FLOUR',
      quantity: 80,
      storageLocation: STORAGE.RECEIVING,
      toStorageLocation: STORAGE.RAW_MATERIALS,
    });
    const r2 = applyMove(xfer, r1.newQuants, r1.newLayers, FLOUR);

    expect(getAvailableStock(r2.newQuants, 'FLOUR', STORAGE.RECEIVING)).toBe(0);
    expect(getAvailableStock(r2.newQuants, 'FLOUR', STORAGE.RAW_MATERIALS)).toBe(80);

    // Reverse the transfer (312 is reversal of 311)
    // 312 resolve: from = toStorageLocation, to = storageLocation (swapped)
    // So we pass the same params as the original 311 to reverse it
    const revXfer = fromPreset('312', {
      materialId: 'FLOUR',
      quantity: 80,
      storageLocation: STORAGE.RECEIVING,
      toStorageLocation: STORAGE.RAW_MATERIALS,
    });
    const r3 = applyMove(revXfer, r2.newQuants, r2.newLayers, FLOUR);

    expect(getAvailableStock(r3.newQuants, 'FLOUR', STORAGE.RECEIVING)).toBe(80);
    expect(getAvailableStock(r3.newQuants, 'FLOUR', STORAGE.RAW_MATERIALS)).toBe(0);
  });
});

// ===========================================================================
// Additional edge-case tests
// ===========================================================================

describe('Edge cases', () => {
  it('standard price material creates price difference on receipt', () => {
    // Receive PACKAGING-BOX at different price than standard (200)
    const move = fromPreset('101', {
      materialId: 'PACKAGING-BOX',
      quantity: 100,
      unitCost: 250, // 250 vs standard 200 → variance = 100*(250-200)=5000
      storageLocation: STORAGE.RECEIVING,
      reference: 'PO-003',
    });

    const result = applyMove(move, [], [], PACKAGING_BOX);

    const variance = result.accountingEntries.find((e) => e.type === 'price-difference');
    expect(variance).toBeDefined();
    expect(variance!.amount).toBe(5000); // (250-200)*100
  });

  it('scrap move generates scrap-expense entry', () => {
    // Receive, then scrap
    const r1 = receiveStock('FLOUR', 50, 500, STORAGE.RAW_MATERIALS, [], [], FLOUR);

    const scrapMove = fromPreset('551', {
      materialId: 'FLOUR',
      quantity: 10,
      storageLocation: STORAGE.RAW_MATERIALS,
    });

    const r2 = applyMove(scrapMove, r1.newQuants, r1.newLayers, FLOUR);

    const scrapEntry = r2.accountingEntries.find((e) => e.type === 'scrap-expense');
    expect(scrapEntry).toBeDefined();
    expect(scrapEntry!.amount).toBe(10 * 500);

    expect(getAvailableStock(r2.newQuants, 'FLOUR', STORAGE.RAW_MATERIALS)).toBe(40);
  });

  it('FIFO consumes oldest layers first', () => {
    const t1 = new Date('2025-01-01');
    const t2 = new Date('2025-02-01');

    // Receive 50 @ 400, then 50 @ 600
    const r1 = receiveStock('FLOUR', 50, 400, STORAGE.RAW_MATERIALS, [], [], FLOUR, { timestamp: t1 });
    const r2 = receiveStock('FLOUR', 50, 600, STORAGE.RAW_MATERIALS, r1.newQuants, r1.newLayers, FLOUR, { timestamp: t2 });

    // Consume 60 via FIFO
    const { consumed, totalCost } = consumeFIFO(r2.newLayers, 'FLOUR', 60);

    // Should take all 50 from first layer (50*400=20000) + 10 from second (10*600=6000)
    expect(consumed).toHaveLength(2);
    expect(consumed[0]!.quantity).toBe(50);
    expect(consumed[0]!.unitCost).toBe(400);
    expect(consumed[1]!.quantity).toBe(10);
    expect(consumed[1]!.unitCost).toBe(600);
    expect(totalCost).toBe(26000);
  });

  it('projectQuants replays all moves from scratch', () => {
    // Build some moves manually
    const m1 = createMove({
      materialId: 'FLOUR',
      fromLocationId: VIRTUAL_LOCATIONS.SUPPLIER,
      toLocationId: STORAGE.RECEIVING,
      quantity: 100,
      unitCost: 500,
    });
    // Manually set state to done
    const m1Done: Move = { ...m1, state: 'done' };

    const m2: Move = {
      ...createMove({
        materialId: 'FLOUR',
        fromLocationId: STORAGE.RECEIVING,
        toLocationId: STORAGE.RAW_MATERIALS,
        quantity: 60,
      }),
      state: 'done',
    };

    const quants = projectQuants([m1Done, m2]);

    // receiving: 100 - 60 = 40
    expect(getAvailableStock(quants, 'FLOUR', STORAGE.RECEIVING)).toBe(40);
    // raw-materials: 60
    expect(getAvailableStock(quants, 'FLOUR', STORAGE.RAW_MATERIALS)).toBe(60);
  });

  it('physical inventory with positive adjustment (701)', () => {
    const r = receiveStock('FLOUR', 100, 500, STORAGE.RAW_MATERIALS, [], [], FLOUR);

    let doc = createPIDocument([
      { materialId: 'FLOUR', locationId: STORAGE.RAW_MATERIALS, bookQuantity: 100 },
    ]);

    // Count reveals 110 (gain of 10)
    doc = enterCount(doc, 'FLOUR', STORAGE.RAW_MATERIALS, 110);
    doc = finalizeCounting(doc);

    const { adjustmentMoves, totalPositiveValue } = postDifferences(doc, r.newLayers);

    expect(adjustmentMoves).toHaveLength(1);
    expect(adjustmentMoves[0]!.presetCode).toBe('701');
    expect(adjustmentMoves[0]!.quantity).toBe(10);
    expect(totalPositiveValue).toBeGreaterThan(0);

    // Apply the gain move
    const result = applyMove(adjustmentMoves[0]!, r.newQuants, r.newLayers, FLOUR);
    expect(getAvailableStock(result.newQuants, 'FLOUR', STORAGE.RAW_MATERIALS)).toBe(110);
  });

  it('batch-managed material tracks separate quants per batch', () => {
    // Receive batch B1
    const r1 = receiveStock(
      'FLOUR', 50, 500, STORAGE.RAW_MATERIALS, [], [], FLOUR, { batchId: 'B1' },
    );
    // Receive batch B2
    const r2 = receiveStock(
      'FLOUR', 30, 600, STORAGE.RAW_MATERIALS, r1.newQuants, r1.newLayers, FLOUR, { batchId: 'B2' },
    );

    // Should have separate quants per batch
    const b1 = findQuant(r2.newQuants, 'FLOUR', STORAGE.RAW_MATERIALS, 'B1');
    const b2 = findQuant(r2.newQuants, 'FLOUR', STORAGE.RAW_MATERIALS, 'B2');

    expect(b1).toBeDefined();
    expect(b1!.quantity).toBe(50);
    expect(b2).toBeDefined();
    expect(b2!.quantity).toBe(30);

    // Total stock across batches
    expect(getAvailableStock(r2.newQuants, 'FLOUR', STORAGE.RAW_MATERIALS)).toBe(80);
  });

  it('AVCO consumption distributes proportionally across layers', () => {
    const t1 = new Date('2025-01-01');
    const t2 = new Date('2025-02-01');

    const r1 = receiveStock('FLOUR', 100, 500, STORAGE.RAW_MATERIALS, [], [], FLOUR, { timestamp: t1 });
    const r2 = receiveStock('FLOUR', 100, 700, STORAGE.RAW_MATERIALS, r1.newQuants, r1.newLayers, FLOUR, { timestamp: t2 });

    // AVCO = (100*500 + 100*700) / 200 = 600
    const avco = calculateAverageCost(r2.newLayers, 'FLOUR');
    expect(avco).toBe(600);

    // Consume 50 at AVCO
    const { consumed, totalCost } = consumeAVCO(r2.newLayers, 'FLOUR', 50);
    expect(totalCost).toBe(50 * 600); // 30000
    expect(consumed.length).toBeGreaterThanOrEqual(1);

    // Each consumed record should use AVCO rate
    for (const c of consumed) {
      expect(c.unitCost).toBe(600);
    }
  });
});
