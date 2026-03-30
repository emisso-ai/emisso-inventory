import type { Quant, Material } from '../types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StockReportLine = {
  materialId: string;
  description: string;
  locationId: string;
  batchId: string | null;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  unit: string;
};

export type StockReportSummary = {
  totalMaterials: number;
  totalLocations: number;
  totalQuantity: number;
  lines: StockReportLine[];
};

// ---------------------------------------------------------------------------
// Report generator
// ---------------------------------------------------------------------------

export function generateStockReport(
  quants: Quant[],
  materials: Material[],
  filters?: {
    materialId?: string;
    locationId?: string;
    onlyAvailable?: boolean;
  },
): StockReportSummary {
  const materialMap = new Map(materials.map((m) => [m.id, m]));

  const filtered = quants.filter((q) => {
    if (filters?.materialId && q.materialId !== filters.materialId) return false;
    if (filters?.locationId && q.locationId !== filters.locationId) return false;
    if (filters?.onlyAvailable && (q.quantity - q.reservedQuantity) <= 0) return false;
    return true;
  });

  const lines: StockReportLine[] = filtered.map((q) => {
    const mat = materialMap.get(q.materialId);
    return {
      materialId: q.materialId,
      description: mat?.description ?? '',
      locationId: q.locationId,
      batchId: q.batchId,
      quantity: q.quantity,
      reservedQuantity: q.reservedQuantity,
      availableQuantity: q.quantity - q.reservedQuantity,
      unit: mat?.baseUnit ?? '',
    };
  });

  const uniqueMaterials = new Set(lines.map((l) => l.materialId));
  const uniqueLocations = new Set(lines.map((l) => l.locationId));

  return {
    totalMaterials: uniqueMaterials.size,
    totalLocations: uniqueLocations.size,
    totalQuantity: lines.reduce((sum, l) => sum + l.quantity, 0),
    lines,
  };
}
