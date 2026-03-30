/**
 * Location tree builder and helpers
 *
 * Locations form a tree: warehouse -> zones -> bins.
 * Virtual locations represent external parties (supplier, customer, etc.).
 * View locations are aggregations that cannot hold stock.
 */

import type { Location, LocationType, VirtualType } from '../types.js';

/**
 * Create a single location.
 */
export function createLocation(params: {
  id: string;
  name: string;
  type: LocationType;
  parentId?: string;
  virtualType?: VirtualType;
}): Location {
  return {
    id: params.id,
    name: params.name,
    type: params.type,
    parentId: params.parentId ?? null,
    virtualType: params.virtualType ?? null,
    active: true,
  };
}

/**
 * Build a standard location tree for a warehouse.
 *
 * Creates a root warehouse location and one child storage location per entry
 * in `storageLocations`. Returns a flat array with parent relationships set.
 */
export function createWarehouseLocations(
  warehouseId: string,
  warehouseName: string,
  storageLocations: string[],
): Location[] {
  const root = createLocation({
    id: warehouseId,
    name: warehouseName,
    type: 'physical',
  });

  const children = storageLocations.map((name) =>
    createLocation({
      id: `${warehouseId}/${name}`,
      name,
      type: 'physical',
      parentId: warehouseId,
    }),
  );

  return [root, ...children];
}

/**
 * Find a location by ID in a flat array.
 */
export function findLocation(locations: Location[], id: string): Location | undefined {
  return locations.find((loc) => loc.id === id);
}

/**
 * Get all children of a location (direct + nested).
 */
export function getChildLocations(locations: Location[], parentId: string): Location[] {
  const result: Location[] = [];
  const directChildren = locations.filter((loc) => loc.parentId === parentId);

  for (const child of directChildren) {
    result.push(child);
    result.push(...getChildLocations(locations, child.id));
  }

  return result;
}

/**
 * Get the path from root to a location (array of location IDs).
 * Returns the path starting from the root, ending with the given location.
 */
export function getLocationPath(locations: Location[], locationId: string): string[] {
  const path: string[] = [];
  let currentId: string | null = locationId;

  while (currentId !== null) {
    path.unshift(currentId);
    const loc = findLocation(locations, currentId);
    currentId = loc?.parentId ?? null;
  }

  return path;
}

/**
 * Check if a location is a descendant of another.
 */
export function isChildOf(locations: Location[], locationId: string, parentId: string): boolean {
  let currentId: string | null = findLocation(locations, locationId)?.parentId ?? null;

  while (currentId !== null) {
    if (currentId === parentId) return true;
    const loc = findLocation(locations, currentId);
    currentId = loc?.parentId ?? null;
  }

  return false;
}

/**
 * Check if a location can hold stock (physical only, not view or virtual).
 */
export function canHoldStock(location: Location): boolean {
  return location.type === 'physical';
}
