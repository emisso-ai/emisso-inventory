import { describe, expect, it } from 'vitest';
import {
  createDefaultRegistry,
  fromPreset,
  PresetRegistry,
  type PresetParams,
} from '../../src/index.js';
import { VIRTUAL_LOCATIONS } from '../../src/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseParams: PresetParams = {
  materialId: 'MAT-001',
  quantity: 10,
  unit: 'EA',
  storageLocation: 'WH01/A1',
};

// ---------------------------------------------------------------------------
// Goods Receipt — 101, 102, 103, 105
// ---------------------------------------------------------------------------

describe('Goods Receipt presets', () => {
  it('101: creates move from virtual/supplier to storageLocation', () => {
    const move = fromPreset('101', {
      ...baseParams,
      unitCost: 5000,
      reference: 'PO-001',
    });
    expect(move.fromLocationId).toBe(VIRTUAL_LOCATIONS.SUPPLIER);
    expect(move.toLocationId).toBe('WH01/A1');
  });

  it('101: requires unitCost', () => {
    expect(() =>
      fromPreset('101', { ...baseParams, reference: 'PO-001' }),
    ).toThrow('requires unitCost');
  });

  it('101: requires reference', () => {
    expect(() =>
      fromPreset('101', { ...baseParams, unitCost: 5000 }),
    ).toThrow('requires reference');
  });

  it('101: sets createsValuationLayer on config', () => {
    const registry = createDefaultRegistry();
    const config = registry.get('101');
    expect(config?.createsValuationLayer).toBe(true);
    expect(config?.consumesValuationLayer).toBe(false);
  });

  it('102: creates reverse of 101 (from physical to virtual/supplier)', () => {
    const move = fromPreset('102', baseParams);
    expect(move.fromLocationId).toBe('WH01/A1');
    expect(move.toLocationId).toBe(VIRTUAL_LOCATIONS.SUPPLIER);
  });

  it('103: creates move from virtual/supplier to storageLocation', () => {
    const move = fromPreset('103', {
      ...baseParams,
      unitCost: 3000,
      reference: 'PO-002',
    });
    expect(move.fromLocationId).toBe(VIRTUAL_LOCATIONS.SUPPLIER);
    expect(move.toLocationId).toBe('WH01/A1');
  });

  it('105: creates same from/to (status change)', () => {
    const move = fromPreset('105', baseParams);
    expect(move.fromLocationId).toBe('WH01/A1');
    expect(move.toLocationId).toBe('WH01/A1');
  });
});

// ---------------------------------------------------------------------------
// Goods Issue — 201, 202
// ---------------------------------------------------------------------------

describe('Goods Issue presets', () => {
  it('201: creates move to virtual/cost-center', () => {
    const move = fromPreset('201', baseParams);
    expect(move.fromLocationId).toBe('WH01/A1');
    expect(move.toLocationId).toBe(VIRTUAL_LOCATIONS.COST_CENTER);
  });

  it('202: creates reverse of 201', () => {
    const move = fromPreset('202', baseParams);
    expect(move.fromLocationId).toBe(VIRTUAL_LOCATIONS.COST_CENTER);
    expect(move.toLocationId).toBe('WH01/A1');
  });
});

// ---------------------------------------------------------------------------
// Transfer — 301, 302, 311, 312
// ---------------------------------------------------------------------------

describe('Transfer presets', () => {
  it('301: creates transfer between two storage locations', () => {
    const move = fromPreset('301', {
      ...baseParams,
      toStorageLocation: 'WH02/B1',
    });
    expect(move.fromLocationId).toBe('WH01/A1');
    expect(move.toLocationId).toBe('WH02/B1');
  });

  it('301: requires toStorageLocation', () => {
    expect(() => fromPreset('301', baseParams)).toThrow('requires toStorageLocation');
  });

  it('302: creates reverse of 301', () => {
    const move = fromPreset('302', {
      ...baseParams,
      toStorageLocation: 'WH02/B1',
    });
    expect(move.fromLocationId).toBe('WH02/B1');
    expect(move.toLocationId).toBe('WH01/A1');
  });

  it('311: creates transfer within same context', () => {
    const move = fromPreset('311', {
      ...baseParams,
      toStorageLocation: 'WH01/A2',
    });
    expect(move.fromLocationId).toBe('WH01/A1');
    expect(move.toLocationId).toBe('WH01/A2');
  });

  it('312: creates reverse of 311', () => {
    const move = fromPreset('312', {
      ...baseParams,
      toStorageLocation: 'WH01/A2',
    });
    expect(move.fromLocationId).toBe('WH01/A2');
    expect(move.toLocationId).toBe('WH01/A1');
  });
});

// ---------------------------------------------------------------------------
// Scrap — 551, 552
// ---------------------------------------------------------------------------

describe('Scrap presets', () => {
  it('551: creates move to virtual/scrap', () => {
    const move = fromPreset('551', baseParams);
    expect(move.fromLocationId).toBe('WH01/A1');
    expect(move.toLocationId).toBe(VIRTUAL_LOCATIONS.SCRAP);
  });

  it('552: creates reverse of 551', () => {
    const move = fromPreset('552', baseParams);
    expect(move.fromLocationId).toBe(VIRTUAL_LOCATIONS.SCRAP);
    expect(move.toLocationId).toBe('WH01/A1');
  });
});

// ---------------------------------------------------------------------------
// Sales — 601, 602
// ---------------------------------------------------------------------------

describe('Sales presets', () => {
  it('601: creates move to virtual/customer', () => {
    const move = fromPreset('601', {
      ...baseParams,
      reference: 'SO-001',
    });
    expect(move.fromLocationId).toBe('WH01/A1');
    expect(move.toLocationId).toBe(VIRTUAL_LOCATIONS.CUSTOMER);
  });

  it('601: requires reference', () => {
    expect(() => fromPreset('601', baseParams)).toThrow('requires reference');
  });

  it('602: creates reverse of 601', () => {
    const move = fromPreset('602', baseParams);
    expect(move.fromLocationId).toBe(VIRTUAL_LOCATIONS.CUSTOMER);
    expect(move.toLocationId).toBe('WH01/A1');
  });
});

// ---------------------------------------------------------------------------
// Adjustment — 701, 702
// ---------------------------------------------------------------------------

describe('Adjustment presets', () => {
  it('701: creates move from virtual/inventory-loss to storageLocation', () => {
    const move = fromPreset('701', { ...baseParams, reference: 'PI-001' });
    expect(move.fromLocationId).toBe(VIRTUAL_LOCATIONS.INVENTORY_LOSS);
    expect(move.toLocationId).toBe('WH01/A1');
  });

  it('702: creates move from storageLocation to virtual/inventory-loss', () => {
    const move = fromPreset('702', { ...baseParams, reference: 'PI-002' });
    expect(move.fromLocationId).toBe('WH01/A1');
    expect(move.toLocationId).toBe(VIRTUAL_LOCATIONS.INVENTORY_LOSS);
  });
});

// ---------------------------------------------------------------------------
// Move structure
// ---------------------------------------------------------------------------

describe('Move structure', () => {
  it('returns move in draft state', () => {
    const move = fromPreset('201', baseParams);
    expect(move.state).toBe('draft');
  });

  it('sets presetCode on the move', () => {
    const move = fromPreset('551', baseParams);
    expect(move.presetCode).toBe('551');
  });

  it('passes through materialId, quantity, batchId, reference', () => {
    const move = fromPreset('101', {
      ...baseParams,
      unitCost: 5000,
      reference: 'PO-100',
      batchId: 'BATCH-01',
    });
    expect(move.materialId).toBe('MAT-001');
    expect(move.quantity).toBe(10);
    expect(move.batchId).toBe('BATCH-01');
    expect(move.reference).toBe('PO-100');
  });

  it('defaults unit to EA when not provided', () => {
    const move = fromPreset('201', {
      materialId: 'MAT-001',
      quantity: 5,
      storageLocation: 'WH01/A1',
    });
    expect(move.unit).toBe('EA');
  });

  it('has a valid id', () => {
    const move = fromPreset('201', baseParams);
    expect(move.id).toBeDefined();
    expect(typeof move.id).toBe('string');
    expect(move.id.length).toBeGreaterThan(0);
  });

  it('sets timestamp and createdAt', () => {
    const move = fromPreset('201', baseParams);
    expect(move.timestamp).toBeInstanceOf(Date);
    expect(move.createdAt).toBeInstanceOf(Date);
  });

  it('uses provided timestamp', () => {
    const ts = new Date('2025-01-15T10:00:00Z');
    const move = fromPreset('201', { ...baseParams, timestamp: ts });
    expect(move.timestamp).toBe(ts);
  });
});

// ---------------------------------------------------------------------------
// Registry API
// ---------------------------------------------------------------------------

describe('PresetRegistry', () => {
  it('register() adds custom preset', () => {
    const registry = new PresetRegistry();
    registry.register({
      code: '999',
      name: 'Custom',
      description: 'Custom preset',
      reversalCode: null,
      createsValuationLayer: false,
      consumesValuationLayer: false,
      requiresReference: false,
      requiresUnitCost: false,
      resolve: (params) => ({
        fromLocationId: params.storageLocation,
        toLocationId: 'virtual/custom',
      }),
    });
    expect(registry.has('999')).toBe(true);
  });

  it('has() checks existence', () => {
    const registry = createDefaultRegistry();
    expect(registry.has('101')).toBe(true);
    expect(registry.has('999')).toBe(false);
  });

  it('codes() returns all codes', () => {
    const registry = createDefaultRegistry();
    const codes = registry.codes();
    expect(codes).toContain('101');
    expect(codes).toContain('201');
    expect(codes).toContain('301');
    expect(codes).toContain('551');
    expect(codes).toContain('601');
    expect(codes).toContain('701');
    expect(codes.length).toBe(16); // All core presets
  });

  it('261 does NOT exist in core registry (manufacturing)', () => {
    const registry = createDefaultRegistry();
    expect(registry.has('261')).toBe(false);
  });

  it('unknown preset code throws error', () => {
    expect(() => fromPreset('999', baseParams)).toThrow('Unknown preset code: 999');
  });
});
