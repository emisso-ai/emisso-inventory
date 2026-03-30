/**
 * BOM cost rollup — pure functions.
 */

import { type BOM } from '../types.js';
import { round } from '../money.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ComponentCost = {
  materialId: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
};

// ---------------------------------------------------------------------------
// Single-level costing
// ---------------------------------------------------------------------------

/**
 * Calculate the cost of producing baseQuantity units using a BOM.
 *
 * Unlike explodeBOM (which rounds quantities to integers for material planning),
 * costing uses precise fractional quantities to avoid rounding-induced cost drift.
 */
export function calculateBOMCost(
  bom: BOM,
  priceLookup: (materialId: string) => number,
  options?: { includeScrap?: boolean },
): {
  unitCost: number;
  totalCost: number;
  breakdown: ComponentCost[];
} {
  const includeScrap = options?.includeScrap ?? false;

  const breakdown: ComponentCost[] = bom.components
    .filter((c) => c.itemCategory !== 'text')
    .map((component) => {
      let quantity = component.quantity;
      if (includeScrap && component.scrapPercentage > 0) {
        quantity = quantity + (quantity * component.scrapPercentage) / 100;
      }
      const unitPrice = priceLookup(component.materialId);
      const totalCost = round(quantity * unitPrice);
      return {
        materialId: component.materialId,
        quantity: round(quantity),
        unitCost: unitPrice,
        totalCost,
      };
    });

  const totalCost = breakdown.reduce((acc, c) => acc + c.totalCost, 0);
  const unitCost = round(totalCost / bom.baseQuantity);

  return { unitCost, totalCost, breakdown };
}

// ---------------------------------------------------------------------------
// Multi-level costing
// ---------------------------------------------------------------------------

/**
 * Multi-level cost rollup — recursively resolves sub-BOMs to raw materials
 * and prices everything at the leaf level, preserving fractional precision.
 */
export function calculateBOMCostMultiLevel(
  parentMaterialId: string,
  bomLookup: (materialId: string) => BOM | undefined,
  priceLookup: (materialId: string) => number,
  options?: { includeScrap?: boolean },
): {
  unitCost: number;
  totalCost: number;
  breakdown: ComponentCost[];
} {
  const parentBom = bomLookup(parentMaterialId);
  if (!parentBom) {
    return { unitCost: 0, totalCost: 0, breakdown: [] };
  }

  const includeScrap = options?.includeScrap ?? false;
  const breakdown: ComponentCost[] = [];

  function recurse(materialId: string, multiplier: number): void {
    const bom = bomLookup(materialId);
    if (!bom) return;

    for (const component of bom.components) {
      if (component.itemCategory === 'text') continue;

      let qty = (component.quantity / bom.baseQuantity) * multiplier;
      if (includeScrap && component.scrapPercentage > 0) {
        qty = qty + (qty * component.scrapPercentage) / 100;
      }

      const childBom = bomLookup(component.materialId);
      if (childBom) {
        recurse(component.materialId, qty);
      } else {
        const unitPrice = priceLookup(component.materialId);
        const totalCost = round(qty * unitPrice);
        breakdown.push({
          materialId: component.materialId,
          quantity: round(qty),
          unitCost: unitPrice,
          totalCost,
        });
      }
    }
  }

  recurse(parentMaterialId, parentBom.baseQuantity);

  const totalCost = breakdown.reduce((acc, c) => acc + c.totalCost, 0);
  const unitCost = round(totalCost / parentBom.baseQuantity);

  return { unitCost, totalCost, breakdown };
}
