/**
 * Manufacturing-specific presets — 261, 262
 *
 * 261: Goods Issue for Production Order (issue components to production)
 * 262: Reversal of 261 (return components from production)
 */

import { VIRTUAL_LOCATIONS } from '../locations/virtual.js';
import type { PresetRegistry } from '../presets/registry.js';

// ---------------------------------------------------------------------------
// Preset configs
// ---------------------------------------------------------------------------

export const MANUFACTURING_PRESETS = {
  '261': {
    code: '261' as const,
    name: 'GI for Production Order',
    description: 'Issue components to production order',
    reversalCode: '262' as const,
    createsValuationLayer: false,
    consumesValuationLayer: true,
    requiresReference: true,
    requiresUnitCost: false,
  },
  '262': {
    code: '262' as const,
    name: 'Reversal of 261',
    description: 'Return components from production order',
    reversalCode: '261' as const,
    createsValuationLayer: true,
    consumesValuationLayer: false,
    requiresReference: true,
    requiresUnitCost: false,
  },
};

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * Register manufacturing presets into a preset registry.
 */
export function registerManufacturingPresets(registry: PresetRegistry): void {
  // 261: GI for Production Order
  registry.register({
    ...MANUFACTURING_PRESETS['261'],
    resolve: (params) => ({
      fromLocationId: params.storageLocation,
      toLocationId: VIRTUAL_LOCATIONS.PRODUCTION,
    }),
  });

  // 262: Reversal of 261
  registry.register({
    ...MANUFACTURING_PRESETS['262'],
    resolve: (params) => ({
      fromLocationId: VIRTUAL_LOCATIONS.PRODUCTION,
      toLocationId: params.storageLocation,
    }),
  });
}
