/**
 * Transfer presets — 301, 302, 311, 312
 */

import type { PresetRegistry } from './registry.js';

export function registerTransferPresets(registry: PresetRegistry): void {
  // 301: Plant-to-Plant Transfer
  registry.register({
    code: '301',
    name: 'Plant-to-Plant Transfer',
    description: 'Transfer stock between plants',
    reversalCode: '302',
    createsValuationLayer: false,
    consumesValuationLayer: false,
    requiresReference: false,
    requiresUnitCost: false,
    resolve: (params) => {
      if (!params.toStorageLocation) {
        throw new Error('Preset 301 requires toStorageLocation');
      }
      return {
        fromLocationId: params.storageLocation,
        toLocationId: params.toStorageLocation,
      };
    },
  });

  // 302: Reversal of 301
  registry.register({
    code: '302',
    name: 'Reversal of Plant-to-Plant Transfer',
    description: 'Reversal of inter-plant stock transfer',
    reversalCode: null,
    createsValuationLayer: false,
    consumesValuationLayer: false,
    requiresReference: false,
    requiresUnitCost: false,
    resolve: (params) => {
      if (!params.toStorageLocation) {
        throw new Error('Preset 302 requires toStorageLocation');
      }
      return {
        fromLocationId: params.toStorageLocation,
        toLocationId: params.storageLocation,
      };
    },
  });

  // 311: Storage Location Transfer (within same plant)
  registry.register({
    code: '311',
    name: 'Storage Location Transfer',
    description: 'Transfer stock between storage locations within the same plant',
    reversalCode: '312',
    createsValuationLayer: false,
    consumesValuationLayer: false,
    requiresReference: false,
    requiresUnitCost: false,
    resolve: (params) => {
      if (!params.toStorageLocation) {
        throw new Error('Preset 311 requires toStorageLocation');
      }
      return {
        fromLocationId: params.storageLocation,
        toLocationId: params.toStorageLocation,
      };
    },
  });

  // 312: Reversal of 311
  registry.register({
    code: '312',
    name: 'Reversal of Storage Location Transfer',
    description: 'Reversal of intra-plant storage location transfer',
    reversalCode: null,
    createsValuationLayer: false,
    consumesValuationLayer: false,
    requiresReference: false,
    requiresUnitCost: false,
    resolve: (params) => {
      if (!params.toStorageLocation) {
        throw new Error('Preset 312 requires toStorageLocation');
      }
      return {
        fromLocationId: params.toStorageLocation,
        toLocationId: params.storageLocation,
      };
    },
  });
}
