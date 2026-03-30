/**
 * Sample BOMs for integration tests.
 */
import type { BOM } from '../../src/index.js';

/**
 * Bread BOM — base quantity 100 EA.
 *
 * Components:
 *   FLOUR: 30 KG (backflush, 2% scrap)
 *   YEAST:  2 KG (backflush)
 *   WATER: 20 LT (manual issue)
 */
export const BREAD_BOM: BOM = {
  id: 'BOM-BREAD-001',
  parentMaterialId: 'BREAD',
  baseQuantity: 100,
  baseUnit: 'EA',
  usage: 'production',
  validFrom: new Date('2025-01-01'),
  validTo: null,
  components: [
    {
      materialId: 'FLOUR',
      quantity: 30,
      unit: 'KG',
      itemCategory: 'stock',
      scrapPercentage: 2,
      backflush: true,
      position: 10,
    },
    {
      materialId: 'YEAST',
      quantity: 2,
      unit: 'KG',
      itemCategory: 'stock',
      scrapPercentage: 0,
      backflush: true,
      position: 20,
    },
    {
      materialId: 'WATER',
      quantity: 20,
      unit: 'LT',
      itemCategory: 'stock',
      scrapPercentage: 0,
      backflush: false,
      position: 30,
    },
  ],
  active: true,
};
