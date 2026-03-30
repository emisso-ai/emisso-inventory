import { describe, expect, it } from 'vitest';
import {
  canHoldStock,
  createLocation,
  createVirtualLocations,
  createWarehouseLocations,
  customerLocation,
  findLocation,
  getChildLocations,
  getLocationPath,
  isChildOf,
  location,
  supplierLocation,
  VIRTUAL_LOCATIONS,
} from '../../src/index.js';

// ---------------------------------------------------------------------------
// createLocation
// ---------------------------------------------------------------------------

describe('createLocation', () => {
  it('creates a valid physical location', () => {
    const loc = createLocation({ id: 'WH01', name: 'Main Warehouse', type: 'physical' });
    expect(loc).toEqual({
      id: 'WH01',
      name: 'Main Warehouse',
      type: 'physical',
      parentId: null,
      virtualType: null,
      active: true,
    });
  });

  it('creates a virtual location with virtualType', () => {
    const loc = createLocation({
      id: 'virtual/supplier',
      name: 'Suppliers',
      type: 'virtual',
      virtualType: 'supplier',
    });
    expect(loc.type).toBe('virtual');
    expect(loc.virtualType).toBe('supplier');
  });

  it('sets parentId when provided', () => {
    const loc = createLocation({
      id: 'WH01/A1',
      name: 'A1',
      type: 'physical',
      parentId: 'WH01',
    });
    expect(loc.parentId).toBe('WH01');
  });
});

// ---------------------------------------------------------------------------
// createWarehouseLocations
// ---------------------------------------------------------------------------

describe('createWarehouseLocations', () => {
  it('creates correct tree with root + children', () => {
    const locs = createWarehouseLocations('WH01', 'Main Warehouse', ['A1', 'A2', 'B1']);
    expect(locs).toHaveLength(4);
    expect(locs[0].id).toBe('WH01');
    expect(locs[0].parentId).toBeNull();
    expect(locs[1].id).toBe('WH01/A1');
    expect(locs[1].parentId).toBe('WH01');
    expect(locs[2].id).toBe('WH01/A2');
    expect(locs[3].id).toBe('WH01/B1');
  });

  it('all locations are physical', () => {
    const locs = createWarehouseLocations('WH01', 'Main', ['A1']);
    for (const loc of locs) {
      expect(loc.type).toBe('physical');
    }
  });
});

// ---------------------------------------------------------------------------
// findLocation
// ---------------------------------------------------------------------------

describe('findLocation', () => {
  const locs = createWarehouseLocations('WH01', 'Main', ['A1', 'A2']);

  it('finds by ID', () => {
    const found = findLocation(locs, 'WH01/A1');
    expect(found).toBeDefined();
    expect(found!.name).toBe('A1');
  });

  it('returns undefined for missing ID', () => {
    expect(findLocation(locs, 'NOPE')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getChildLocations
// ---------------------------------------------------------------------------

describe('getChildLocations', () => {
  it('returns direct + nested children', () => {
    // Build a 3-level tree: WH01 -> Zone-A -> Bin-A1
    const locs = [
      createLocation({ id: 'WH01', name: 'WH01', type: 'physical' }),
      createLocation({ id: 'Zone-A', name: 'Zone A', type: 'physical', parentId: 'WH01' }),
      createLocation({ id: 'Bin-A1', name: 'Bin A1', type: 'physical', parentId: 'Zone-A' }),
      createLocation({ id: 'Zone-B', name: 'Zone B', type: 'physical', parentId: 'WH01' }),
    ];

    const children = getChildLocations(locs, 'WH01');
    expect(children).toHaveLength(3);
    expect(children.map((c) => c.id)).toContain('Zone-A');
    expect(children.map((c) => c.id)).toContain('Bin-A1');
    expect(children.map((c) => c.id)).toContain('Zone-B');
  });
});

// ---------------------------------------------------------------------------
// getLocationPath
// ---------------------------------------------------------------------------

describe('getLocationPath', () => {
  it('returns correct path from root to leaf', () => {
    const locs = [
      createLocation({ id: 'WH01', name: 'WH01', type: 'physical' }),
      createLocation({ id: 'Zone-A', name: 'Zone A', type: 'physical', parentId: 'WH01' }),
      createLocation({ id: 'Bin-A1', name: 'Bin A1', type: 'physical', parentId: 'Zone-A' }),
    ];

    const path = getLocationPath(locs, 'Bin-A1');
    expect(path).toEqual(['WH01', 'Zone-A', 'Bin-A1']);
  });

  it('returns single-element path for root', () => {
    const locs = [createLocation({ id: 'WH01', name: 'WH01', type: 'physical' })];
    expect(getLocationPath(locs, 'WH01')).toEqual(['WH01']);
  });
});

// ---------------------------------------------------------------------------
// isChildOf
// ---------------------------------------------------------------------------

describe('isChildOf', () => {
  const locs = [
    createLocation({ id: 'WH01', name: 'WH01', type: 'physical' }),
    createLocation({ id: 'Zone-A', name: 'Zone A', type: 'physical', parentId: 'WH01' }),
    createLocation({ id: 'Bin-A1', name: 'Bin A1', type: 'physical', parentId: 'Zone-A' }),
    createLocation({ id: 'WH02', name: 'WH02', type: 'physical' }),
  ];

  it('detects direct ancestry', () => {
    expect(isChildOf(locs, 'Zone-A', 'WH01')).toBe(true);
  });

  it('detects deep ancestry', () => {
    expect(isChildOf(locs, 'Bin-A1', 'WH01')).toBe(true);
  });

  it('returns false for non-ancestors', () => {
    expect(isChildOf(locs, 'WH02', 'WH01')).toBe(false);
  });

  it('returns false for self', () => {
    expect(isChildOf(locs, 'WH01', 'WH01')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// canHoldStock
// ---------------------------------------------------------------------------

describe('canHoldStock', () => {
  it('returns true for physical locations', () => {
    const loc = createLocation({ id: 'WH01', name: 'WH01', type: 'physical' });
    expect(canHoldStock(loc)).toBe(true);
  });

  it('returns false for virtual locations', () => {
    const loc = createLocation({
      id: 'virtual/supplier',
      name: 'Suppliers',
      type: 'virtual',
      virtualType: 'supplier',
    });
    expect(canHoldStock(loc)).toBe(false);
  });

  it('returns false for view locations', () => {
    const loc = createLocation({ id: 'view/all', name: 'All Stock', type: 'view' });
    expect(canHoldStock(loc)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Virtual locations
// ---------------------------------------------------------------------------

describe('createVirtualLocations', () => {
  it('creates all 7 virtual types', () => {
    const virtuals = createVirtualLocations();
    expect(virtuals).toHaveLength(7);
    const types = virtuals.map((v) => v.virtualType);
    expect(types).toContain('supplier');
    expect(types).toContain('customer');
    expect(types).toContain('production');
    expect(types).toContain('scrap');
    expect(types).toContain('inventory-loss');
    expect(types).toContain('transit');
    expect(types).toContain('cost-center');
  });

  it('all virtual locations have type "virtual"', () => {
    for (const loc of createVirtualLocations()) {
      expect(loc.type).toBe('virtual');
    }
  });
});

describe('supplierLocation', () => {
  it('creates correct virtual sub-location', () => {
    const loc = supplierLocation('ACME', 'Acme Corp');
    expect(loc.id).toBe('virtual/supplier/ACME');
    expect(loc.name).toBe('Acme Corp');
    expect(loc.parentId).toBe(VIRTUAL_LOCATIONS.SUPPLIER);
    expect(loc.virtualType).toBe('supplier');
  });

  it('uses default name when not provided', () => {
    const loc = supplierLocation('V001');
    expect(loc.name).toBe('Supplier V001');
  });
});

describe('customerLocation', () => {
  it('creates correct virtual sub-location', () => {
    const loc = customerLocation('C001', 'Big Client');
    expect(loc.id).toBe('virtual/customer/C001');
    expect(loc.name).toBe('Big Client');
    expect(loc.parentId).toBe(VIRTUAL_LOCATIONS.CUSTOMER);
    expect(loc.virtualType).toBe('customer');
  });

  it('uses default name when not provided', () => {
    const loc = customerLocation('C002');
    expect(loc.name).toBe('Customer C002');
  });
});

// ---------------------------------------------------------------------------
// location helpers
// ---------------------------------------------------------------------------

describe('location helpers', () => {
  it('physical builds correct ID', () => {
    expect(location.physical('WH01', 'A1')).toBe('WH01/A1');
  });

  it('virtual.supplier without ID returns root', () => {
    expect(location.virtual.supplier()).toBe('virtual/supplier');
  });

  it('virtual.supplier with ID returns sub-location', () => {
    expect(location.virtual.supplier('ACME')).toBe('virtual/supplier/ACME');
  });

  it('virtual.customer without ID returns root', () => {
    expect(location.virtual.customer()).toBe('virtual/customer');
  });

  it('virtual.customer with ID returns sub-location', () => {
    expect(location.virtual.customer('C001')).toBe('virtual/customer/C001');
  });

  it('virtual.production returns correct ID', () => {
    expect(location.virtual.production()).toBe('virtual/production');
  });

  it('virtual.scrap returns correct ID', () => {
    expect(location.virtual.scrap()).toBe('virtual/scrap');
  });

  it('virtual.inventoryLoss returns correct ID', () => {
    expect(location.virtual.inventoryLoss()).toBe('virtual/inventory-loss');
  });

  it('virtual.transit returns correct ID', () => {
    expect(location.virtual.transit()).toBe('virtual/transit');
  });

  it('virtual.costCenter without ID returns root', () => {
    expect(location.virtual.costCenter()).toBe('virtual/cost-center');
  });

  it('virtual.costCenter with ID returns sub-location', () => {
    expect(location.virtual.costCenter('CC01')).toBe('virtual/cost-center/CC01');
  });
});
