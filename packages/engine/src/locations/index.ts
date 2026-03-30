// @emisso/inventory - Locations module
export {
  createLocation,
  createWarehouseLocations,
  findLocation,
  getChildLocations,
  getLocationPath,
  isChildOf,
  canHoldStock,
} from './location.js';

export {
  VIRTUAL_LOCATIONS,
  createVirtualLocations,
  getVirtualLocation,
  supplierLocation,
  customerLocation,
  location,
} from './virtual.js';
