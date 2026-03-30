/**
 * Virtual locations and factory helpers
 *
 * Virtual locations represent external parties and abstract destinations
 * in the double-entry move system. They never hold real stock.
 */

import type { Location, VirtualType } from '../types.js';
import { createLocation } from './location.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const VIRTUAL_LOCATIONS = {
  SUPPLIER: 'virtual/supplier',
  CUSTOMER: 'virtual/customer',
  PRODUCTION: 'virtual/production',
  SCRAP: 'virtual/scrap',
  INVENTORY_LOSS: 'virtual/inventory-loss',
  TRANSIT: 'virtual/transit',
  COST_CENTER: 'virtual/cost-center',
} as const;

// ---------------------------------------------------------------------------
// Virtual type to ID mapping
// ---------------------------------------------------------------------------

const virtualTypeToId: Record<VirtualType, string> = {
  supplier: VIRTUAL_LOCATIONS.SUPPLIER,
  customer: VIRTUAL_LOCATIONS.CUSTOMER,
  production: VIRTUAL_LOCATIONS.PRODUCTION,
  scrap: VIRTUAL_LOCATIONS.SCRAP,
  'inventory-loss': VIRTUAL_LOCATIONS.INVENTORY_LOSS,
  transit: VIRTUAL_LOCATIONS.TRANSIT,
  'cost-center': VIRTUAL_LOCATIONS.COST_CENTER,
};

const virtualTypeToName: Record<VirtualType, string> = {
  supplier: 'Suppliers',
  customer: 'Customers',
  production: 'Production',
  scrap: 'Scrap',
  'inventory-loss': 'Inventory Loss',
  transit: 'Transit',
  'cost-center': 'Cost Center',
};

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

/**
 * Create all standard virtual locations.
 */
export function createVirtualLocations(): Location[] {
  return (Object.keys(virtualTypeToId) as VirtualType[]).map((vt) =>
    createLocation({
      id: virtualTypeToId[vt],
      name: virtualTypeToName[vt],
      type: 'virtual',
      virtualType: vt,
    }),
  );
}

/**
 * Get the virtual location for a given virtual type.
 */
export function getVirtualLocation(virtualType: VirtualType): Location {
  return createLocation({
    id: virtualTypeToId[virtualType],
    name: virtualTypeToName[virtualType],
    type: 'virtual',
    virtualType,
  });
}

/**
 * Create a supplier sub-location (e.g., for a specific vendor).
 */
export function supplierLocation(supplierId: string, name?: string): Location {
  return createLocation({
    id: `${VIRTUAL_LOCATIONS.SUPPLIER}/${supplierId}`,
    name: name ?? `Supplier ${supplierId}`,
    type: 'virtual',
    parentId: VIRTUAL_LOCATIONS.SUPPLIER,
    virtualType: 'supplier',
  });
}

/**
 * Create a customer sub-location (e.g., for a specific customer).
 */
export function customerLocation(customerId: string, name?: string): Location {
  return createLocation({
    id: `${VIRTUAL_LOCATIONS.CUSTOMER}/${customerId}`,
    name: name ?? `Customer ${customerId}`,
    type: 'virtual',
    parentId: VIRTUAL_LOCATIONS.CUSTOMER,
    virtualType: 'customer',
  });
}

// ---------------------------------------------------------------------------
// Location ID builders for readability
// ---------------------------------------------------------------------------

/** Check whether a location ID refers to a virtual location. */
export function isVirtualLocation(locationId: string): boolean {
  return locationId.startsWith('virtual/');
}

/** Check whether a location ID refers to a physical location. */
export function isPhysicalLocation(locationId: string): boolean {
  return !locationId.startsWith('virtual/');
}

export const location = {
  physical: (warehouseId: string, storageLocation: string) =>
    `${warehouseId}/${storageLocation}`,
  virtual: {
    supplier: (id?: string) => (id ? `virtual/supplier/${id}` : VIRTUAL_LOCATIONS.SUPPLIER),
    customer: (id?: string) => (id ? `virtual/customer/${id}` : VIRTUAL_LOCATIONS.CUSTOMER),
    production: () => VIRTUAL_LOCATIONS.PRODUCTION,
    scrap: () => VIRTUAL_LOCATIONS.SCRAP,
    inventoryLoss: () => VIRTUAL_LOCATIONS.INVENTORY_LOSS,
    transit: () => VIRTUAL_LOCATIONS.TRANSIT,
    costCenter: (id?: string) =>
      id ? `virtual/cost-center/${id}` : VIRTUAL_LOCATIONS.COST_CENTER,
  },
};
