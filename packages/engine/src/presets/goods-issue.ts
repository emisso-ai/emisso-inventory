/**
 * Goods Issue presets — 201, 202
 */

import { VIRTUAL_LOCATIONS } from '../locations/virtual.js';
import type { PresetRegistry } from './registry.js';

export function registerGoodsIssuePresets(registry: PresetRegistry): void {
  // 201: Goods Issue to Cost Center
  registry.register({
    code: '201',
    name: 'GI to Cost Center',
    description: 'Goods issue for consumption to a cost center',
    reversalCode: '202',
    createsValuationLayer: false,
    consumesValuationLayer: true,
    requiresReference: false,
    requiresUnitCost: false,
    resolve: (params) => ({
      fromLocationId: params.storageLocation,
      toLocationId: VIRTUAL_LOCATIONS.COST_CENTER,
    }),
  });

  // 202: Reversal of 201
  registry.register({
    code: '202',
    name: 'Reversal of GI to Cost Center',
    description: 'Reversal of goods issue to cost center',
    reversalCode: null,
    createsValuationLayer: true,
    consumesValuationLayer: false,
    requiresReference: false,
    requiresUnitCost: false,
    resolve: (params) => ({
      fromLocationId: VIRTUAL_LOCATIONS.COST_CENTER,
      toLocationId: params.storageLocation,
    }),
  });
}
