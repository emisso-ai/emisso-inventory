/**
 * Standard test location tree.
 *
 * Creates a warehouse with five storage zones plus all virtual locations.
 */
import {
  createWarehouseLocations,
  createVirtualLocations,
  type Location,
} from '../../src/index.js';

// Warehouse storage zones
export const STORAGE = {
  RECEIVING: 'warehouse/receiving',
  RAW_MATERIALS: 'warehouse/raw-materials',
  PRODUCTION_FLOOR: 'warehouse/production-floor',
  FINISHED_GOODS: 'warehouse/finished-goods',
  SHIPPING: 'warehouse/shipping',
} as const;

/** Build the full location tree (warehouse + virtual). */
export function buildLocationTree(): Location[] {
  const warehouseLocations = createWarehouseLocations(
    'warehouse',
    'Main Warehouse',
    ['receiving', 'raw-materials', 'production-floor', 'finished-goods', 'shipping'],
  );
  const virtualLocations = createVirtualLocations();
  return [...warehouseLocations, ...virtualLocations];
}
