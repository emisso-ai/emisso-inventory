/**
 * Physical Inventory Adjustment presets — 701, 702
 */

import { VIRTUAL_LOCATIONS } from '../locations/virtual.js';
import type { PresetRegistry } from './registry.js';

export function registerAdjustmentPresets(registry: PresetRegistry): void {
  // 701: Physical Inventory Increase (counted > book)
  registry.register({
    code: '701',
    name: 'PI Increase',
    description: 'Physical inventory count increase (counted quantity exceeds book quantity)',
    reversalCode: null,
    createsValuationLayer: true,
    consumesValuationLayer: false,
    requiresReference: true,
    requiresUnitCost: false,
    resolve: (params) => ({
      fromLocationId: VIRTUAL_LOCATIONS.INVENTORY_LOSS,
      toLocationId: params.storageLocation,
    }),
  });

  // 702: Physical Inventory Decrease (counted < book)
  registry.register({
    code: '702',
    name: 'PI Decrease',
    description: 'Physical inventory count decrease (book quantity exceeds counted quantity)',
    reversalCode: null,
    createsValuationLayer: false,
    consumesValuationLayer: true,
    requiresReference: true,
    requiresUnitCost: false,
    resolve: (params) => ({
      fromLocationId: params.storageLocation,
      toLocationId: VIRTUAL_LOCATIONS.INVENTORY_LOSS,
    }),
  });
}
