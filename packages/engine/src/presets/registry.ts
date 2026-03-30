/**
 * Preset registry — maps SAP movement type codes to double-entry move configurations.
 *
 * Each preset resolves a movement type code + params into a Move in 'draft' state.
 */

import type { Move } from '../types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PresetParams = {
  materialId: string;
  quantity: number;
  unit?: string;
  unitCost?: number | null;
  reference?: string | null;
  batchId?: string | null;
  storageLocation: string;
  toStorageLocation?: string;
  timestamp?: Date;
};

export type PresetResolver = (params: PresetParams) => {
  fromLocationId: string;
  toLocationId: string;
};

export type PresetConfig = {
  code: string;
  name: string;
  description: string;
  reversalCode: string | null;
  createsValuationLayer: boolean;
  consumesValuationLayer: boolean;
  requiresReference: boolean;
  requiresUnitCost: boolean;
  resolve: PresetResolver;
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export class PresetRegistry {
  private presets = new Map<string, PresetConfig>();

  register(config: PresetConfig): void {
    this.presets.set(config.code, config);
  }

  get(code: string): PresetConfig | undefined {
    return this.presets.get(code);
  }

  has(code: string): boolean {
    return this.presets.has(code);
  }

  codes(): string[] {
    return [...this.presets.keys()];
  }

  fromPreset(code: string, params: PresetParams): Move {
    const config = this.presets.get(code);
    if (!config) {
      throw new Error(`Unknown preset code: ${code}`);
    }

    if (config.requiresUnitCost && (params.unitCost == null)) {
      throw new Error(`Preset ${code} requires unitCost`);
    }

    if (config.requiresReference && !params.reference) {
      throw new Error(`Preset ${code} requires reference`);
    }

    const { fromLocationId, toLocationId } = config.resolve(params);
    const now = new Date();

    return {
      id: crypto.randomUUID(),
      materialId: params.materialId,
      fromLocationId,
      toLocationId,
      quantity: params.quantity,
      unit: params.unit ?? 'EA',
      unitCost: params.unitCost ?? null,
      state: 'draft',
      reference: params.reference ?? null,
      batchId: params.batchId ?? null,
      presetCode: code,
      reversalOfId: null,
      routeId: null,
      timestamp: params.timestamp ?? now,
      createdAt: now,
    };
  }
}

// ---------------------------------------------------------------------------
// Default registry
// ---------------------------------------------------------------------------

import { registerGoodsReceiptPresets } from './goods-receipt.js';
import { registerGoodsIssuePresets } from './goods-issue.js';
import { registerTransferPresets } from './transfer.js';
import { registerScrapPresets } from './scrap.js';
import { registerSalesPresets } from './sales.js';
import { registerAdjustmentPresets } from './adjustment.js';

export function createDefaultRegistry(): PresetRegistry {
  const registry = new PresetRegistry();
  registerGoodsReceiptPresets(registry);
  registerGoodsIssuePresets(registry);
  registerTransferPresets(registry);
  registerScrapPresets(registry);
  registerSalesPresets(registry);
  registerAdjustmentPresets(registry);
  return registry;
}

const defaultRegistry = createDefaultRegistry();

/**
 * Convenience: create a Move from a preset code using the default registry.
 */
export function fromPreset(code: string, params: PresetParams): Move {
  return defaultRegistry.fromPreset(code, params);
}
