/**
 * Sample materials for integration tests.
 */
import type { Material } from '../../src/index.js';

export const FLOUR: Material = {
  id: 'FLOUR',
  description: 'Wheat flour',
  type: 'raw',
  baseUnit: 'KG',
  materialGroup: 'raw-materials',
  valuationMethod: 'avco',
  standardPrice: null,
  batchManaged: true,
  weight: 1,
  weightUnit: 'KG',
  active: true,
};

export const YEAST: Material = {
  id: 'YEAST',
  description: 'Dry yeast',
  type: 'raw',
  baseUnit: 'KG',
  materialGroup: 'raw-materials',
  valuationMethod: 'avco',
  standardPrice: null,
  batchManaged: false,
  weight: 1,
  weightUnit: 'KG',
  active: true,
};

export const WATER: Material = {
  id: 'WATER',
  description: 'Filtered water',
  type: 'raw',
  baseUnit: 'LT',
  materialGroup: 'raw-materials',
  valuationMethod: 'avco',
  standardPrice: null,
  batchManaged: false,
  weight: 1,
  weightUnit: 'KG',
  active: true,
};

export const BREAD: Material = {
  id: 'BREAD',
  description: 'Artisan bread loaf',
  type: 'finished',
  baseUnit: 'EA',
  materialGroup: 'finished-goods',
  valuationMethod: 'avco',
  standardPrice: null,
  batchManaged: false,
  weight: 0.5,
  weightUnit: 'KG',
  active: true,
};

export const PACKAGING_BOX: Material = {
  id: 'PACKAGING-BOX',
  description: 'Cardboard packaging box',
  type: 'packaging',
  baseUnit: 'EA',
  materialGroup: 'packaging',
  valuationMethod: 'standard',
  standardPrice: 200, // 200 cents = $2.00
  batchManaged: false,
  weight: 0.1,
  weightUnit: 'KG',
  active: true,
};

/** Lookup map for applyMove's material parameter. */
export const MATERIALS: Record<string, Material> = {
  FLOUR,
  YEAST,
  WATER,
  BREAD,
  'PACKAGING-BOX': PACKAGING_BOX,
};
