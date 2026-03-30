/**
 * BOM explosion and validation — pure functions.
 */

import { type BOM, type ComponentRequirement } from '../types.js';
import { round, percentage } from '../money.js';

// ---------------------------------------------------------------------------
// Single-level explosion
// ---------------------------------------------------------------------------

/**
 * Explode a BOM for a given order quantity.
 * Returns the list of component requirements.
 */
export function explodeBOM(
  bom: BOM,
  orderQuantity: number,
  options?: { includeScrap?: boolean },
): ComponentRequirement[] {
  const includeScrap = options?.includeScrap ?? false;

  return bom.components
    .filter((c) => c.itemCategory !== 'text')
    .map((component) => {
      const baseRequired = (component.quantity / bom.baseQuantity) * orderQuantity;
      let requiredQuantity: number;
      let scrapQuantity: number;

      if (includeScrap && component.scrapPercentage > 0) {
        scrapQuantity = round((baseRequired * component.scrapPercentage) / 100);
        requiredQuantity = round(baseRequired) + scrapQuantity;
      } else {
        requiredQuantity = round(baseRequired);
        scrapQuantity = 0;
      }

      return {
        materialId: component.materialId,
        requiredQuantity,
        unit: component.unit,
        includesScrap: includeScrap && component.scrapPercentage > 0,
        scrapQuantity,
      };
    });
}

// ---------------------------------------------------------------------------
// Multi-level explosion
// ---------------------------------------------------------------------------

export type FlattenedComponent = {
  materialId: string;
  requiredQuantity: number;
  unit: string;
  level: number;
  parentMaterialId: string;
};

/**
 * Multi-level BOM explosion (recursive).
 * Explodes the parent BOM, then for each component that has its own BOM,
 * explodes that too (recursively), flattening everything to raw materials.
 */
export function explodeBOMMultiLevel(
  parentMaterialId: string,
  orderQuantity: number,
  bomLookup: (materialId: string) => BOM | undefined,
  options?: { includeScrap?: boolean; maxDepth?: number },
): FlattenedComponent[] {
  const maxDepth = options?.maxDepth ?? 10;
  const visited = new Set<string>();
  const results: FlattenedComponent[] = [];

  function recurse(
    materialId: string,
    quantity: number,
    level: number,
    parent: string,
  ): void {
    if (visited.has(materialId)) {
      throw new Error(
        `Circular reference detected: ${materialId} already visited`,
      );
    }
    if (level > maxDepth) return;

    const bom = bomLookup(materialId);
    if (!bom) {
      // Raw material — add to results
      results.push({
        materialId,
        requiredQuantity: round(quantity),
        unit: '', // Will be filled from component
        level,
        parentMaterialId: parent,
      });
      return;
    }

    visited.add(materialId);

    const requirements = explodeBOM(bom, quantity, {
      includeScrap: options?.includeScrap,
    });

    for (const req of requirements) {
      const childBom = bomLookup(req.materialId);
      if (childBom) {
        // Has sub-BOM — recurse deeper
        recurse(req.materialId, req.requiredQuantity, level + 1, materialId);
      } else {
        // Raw material
        results.push({
          materialId: req.materialId,
          requiredQuantity: req.requiredQuantity,
          unit: req.unit,
          level,
          parentMaterialId: materialId,
        });
      }
    }

    visited.delete(materialId);
  }

  recurse(parentMaterialId, orderQuantity, 0, parentMaterialId);
  return results;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a BOM structure.
 */
export function validateBOM(
  bom: BOM,
  bomLookup?: (materialId: string) => BOM | undefined,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Must have at least one component
  if (bom.components.length === 0) {
    errors.push('BOM must have at least one component');
  }

  // baseQuantity > 0
  if (bom.baseQuantity <= 0) {
    errors.push('baseQuantity must be greater than 0');
  }

  // Check for duplicate materialIds
  const materialIds = bom.components.map((c) => c.materialId);
  const uniqueIds = new Set(materialIds);
  if (uniqueIds.size !== materialIds.length) {
    errors.push('Duplicate materialIds found in components');
  }

  // All quantities > 0
  for (const component of bom.components) {
    if (component.quantity <= 0) {
      errors.push(
        `Component ${component.materialId} has quantity <= 0`,
      );
    }
  }

  // Self-reference check
  for (const component of bom.components) {
    if (component.materialId === bom.parentMaterialId) {
      errors.push(
        `Component ${component.materialId} references the parent material (self-reference)`,
      );
    }
  }

  // Circular reference check (if bomLookup provided)
  if (bomLookup) {
    const lookup = bomLookup;
    const visited = new Set<string>();

    function checkCircular(materialId: string): boolean {
      if (visited.has(materialId)) return true;
      visited.add(materialId);

      const childBom = lookup(materialId);
      if (!childBom) return false;

      for (const component of childBom.components) {
        if (component.materialId === bom.parentMaterialId) return true;
        if (checkCircular(component.materialId)) return true;
      }

      visited.delete(materialId);
      return false;
    }

    for (const component of bom.components) {
      if (checkCircular(component.materialId)) {
        errors.push('Circular reference detected in multi-level BOM structure');
        break;
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
