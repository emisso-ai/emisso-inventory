/**
 * Goods Receipt presets — 101, 102, 103, 105
 */

import { VIRTUAL_LOCATIONS } from '../locations/virtual.js';
import type { PresetRegistry } from './registry.js';

export function registerGoodsReceiptPresets(registry: PresetRegistry): void {
  // 101: Goods Receipt from Purchase Order
  registry.register({
    code: '101',
    name: 'GR from Purchase Order',
    description: 'Goods receipt from supplier against a purchase order',
    reversalCode: '102',
    createsValuationLayer: true,
    consumesValuationLayer: false,
    requiresReference: true,
    requiresUnitCost: true,
    resolve: (params) => ({
      fromLocationId: VIRTUAL_LOCATIONS.SUPPLIER,
      toLocationId: params.storageLocation,
    }),
  });

  // 102: Reversal of 101
  registry.register({
    code: '102',
    name: 'Reversal of GR from PO',
    description: 'Reversal of goods receipt from purchase order',
    reversalCode: null,
    createsValuationLayer: false,
    consumesValuationLayer: true,
    requiresReference: false,
    requiresUnitCost: false,
    resolve: (params) => ({
      fromLocationId: params.storageLocation,
      toLocationId: VIRTUAL_LOCATIONS.SUPPLIER,
    }),
  });

  // 103: GR into Blocked Stock
  registry.register({
    code: '103',
    name: 'GR into Blocked Stock',
    description: 'Goods receipt into blocked (quality inspection) stock',
    reversalCode: null,
    createsValuationLayer: true,
    consumesValuationLayer: false,
    requiresReference: true,
    requiresUnitCost: true,
    resolve: (params) => ({
      fromLocationId: VIRTUAL_LOCATIONS.SUPPLIER,
      toLocationId: params.storageLocation,
    }),
  });

  // 105: Release from Blocked to Unrestricted
  registry.register({
    code: '105',
    name: 'Release from Blocked Stock',
    description: 'Release from blocked stock to unrestricted use (status change)',
    reversalCode: null,
    createsValuationLayer: false,
    consumesValuationLayer: false,
    requiresReference: false,
    requiresUnitCost: false,
    resolve: (params) => ({
      fromLocationId: params.storageLocation,
      toLocationId: params.storageLocation,
    }),
  });
}
