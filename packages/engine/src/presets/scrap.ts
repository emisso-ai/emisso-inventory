/**
 * Scrap presets — 551, 552
 */

import { VIRTUAL_LOCATIONS } from '../locations/virtual.js';
import type { PresetRegistry } from './registry.js';

export function registerScrapPresets(registry: PresetRegistry): void {
  // 551: Scrapping
  registry.register({
    code: '551',
    name: 'Scrapping',
    description: 'Scrap stock (expense)',
    reversalCode: '552',
    createsValuationLayer: false,
    consumesValuationLayer: true,
    requiresReference: false,
    requiresUnitCost: false,
    resolve: (params) => ({
      fromLocationId: params.storageLocation,
      toLocationId: VIRTUAL_LOCATIONS.SCRAP,
    }),
  });

  // 552: Reversal of 551
  registry.register({
    code: '552',
    name: 'Reversal of Scrapping',
    description: 'Reversal of scrap posting',
    reversalCode: null,
    createsValuationLayer: true,
    consumesValuationLayer: false,
    requiresReference: false,
    requiresUnitCost: false,
    resolve: (params) => ({
      fromLocationId: VIRTUAL_LOCATIONS.SCRAP,
      toLocationId: params.storageLocation,
    }),
  });
}
