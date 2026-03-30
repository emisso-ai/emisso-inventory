import type { ValuationLayer, Material } from '../types.js';
import { divide } from '../money.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ValuationReportLine = {
  materialId: string;
  description: string;
  totalQuantity: number;
  totalValue: number;
  averageCost: number;
  layerCount: number;
};

export type ValuationReportSummary = {
  totalMaterials: number;
  totalValue: number;
  lines: ValuationReportLine[];
};

// ---------------------------------------------------------------------------
// Report generator
// ---------------------------------------------------------------------------

export function generateValuationReport(
  layers: ValuationLayer[],
  materials: Material[],
  filters?: {
    materialId?: string;
    onlyWithStock?: boolean;
  },
): ValuationReportSummary {
  const materialMap = new Map(materials.map((m) => [m.id, m]));

  let filtered = layers;

  if (filters?.materialId) {
    filtered = filtered.filter((l) => l.materialId === filters.materialId);
  }

  // Group by materialId
  const grouped = new Map<
    string,
    { totalQuantity: number; totalValue: number; layerCount: number }
  >();

  for (const layer of filtered) {
    const existing = grouped.get(layer.materialId);
    if (existing) {
      existing.totalQuantity += layer.remainingQty;
      existing.totalValue += layer.remainingValue;
      existing.layerCount += 1;
    } else {
      grouped.set(layer.materialId, {
        totalQuantity: layer.remainingQty,
        totalValue: layer.remainingValue,
        layerCount: 1,
      });
    }
  }

  let lines: ValuationReportLine[] = [];

  for (const [materialId, agg] of grouped) {
    if (filters?.onlyWithStock && agg.totalQuantity <= 0) continue;

    const mat = materialMap.get(materialId);
    lines.push({
      materialId,
      description: mat?.description ?? '',
      totalQuantity: agg.totalQuantity,
      totalValue: agg.totalValue,
      averageCost: agg.totalQuantity !== 0 ? divide(agg.totalValue, agg.totalQuantity) : 0,
      layerCount: agg.layerCount,
    });
  }

  return {
    totalMaterials: lines.length,
    totalValue: lines.reduce((sum, l) => sum + l.totalValue, 0),
    lines,
  };
}
