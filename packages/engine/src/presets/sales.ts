/**
 * Sales presets — 601, 602
 */

import { VIRTUAL_LOCATIONS } from '../locations/virtual.js';
import type { PresetRegistry } from './registry.js';

export function registerSalesPresets(registry: PresetRegistry): void {
  // 601: Goods Issue for Sales Delivery
  registry.register({
    code: '601',
    name: 'GI for Sales Delivery',
    description: 'Goods issue against a sales order delivery (COGS)',
    reversalCode: '602',
    createsValuationLayer: false,
    consumesValuationLayer: true,
    requiresReference: true,
    requiresUnitCost: false,
    resolve: (params) => ({
      fromLocationId: params.storageLocation,
      toLocationId: VIRTUAL_LOCATIONS.CUSTOMER,
    }),
  });

  // 602: Reversal of 601
  registry.register({
    code: '602',
    name: 'Reversal of GI for Sales Delivery',
    description: 'Reversal of sales delivery goods issue',
    reversalCode: null,
    createsValuationLayer: true,
    consumesValuationLayer: false,
    requiresReference: false,
    requiresUnitCost: false,
    resolve: (params) => ({
      fromLocationId: VIRTUAL_LOCATIONS.CUSTOMER,
      toLocationId: params.storageLocation,
    }),
  });
}
