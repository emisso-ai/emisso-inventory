/**
 * Internal barcode format for warehouse operations.
 *
 * Format: `INV:{materialId}:{locationId}` or `INV:{materialId}:{locationId}:{batchId}`
 */

import { type GS1Data } from '../types.js';
import { decodeGS1 } from './gs1.js';

const PREFIX = 'INV:';

// ---------------------------------------------------------------------------
// Encode / Decode
// ---------------------------------------------------------------------------

/** Encode material + location (+ optional batch) into an internal barcode string. */
export function encodeInternal(materialId: string, locationId: string, batchId?: string): string {
  const base = `${PREFIX}${materialId}:${locationId}`;
  return batchId != null ? `${base}:${batchId}` : base;
}

/** Decode an internal barcode string. */
export function decodeInternal(barcode: string): {
  materialId: string;
  locationId: string;
  batchId: string | null;
} {
  const body = barcode.slice(PREFIX.length);
  const parts = body.split(':');

  return {
    materialId: parts[0]!,
    locationId: parts[1]!,
    batchId: parts[2] ?? null,
  };
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/** Check if a string is an internal barcode (starts with `INV:`). */
export function isInternalBarcode(barcode: string): boolean {
  return barcode.startsWith(PREFIX);
}

/** Check if a string looks like a GS1 barcode (starts with a known AI). */
export function isGS1Barcode(barcode: string): boolean {
  // Parenthesized format
  if (barcode.startsWith('(')) return true;
  // Raw format — starts with a known 2- or 4-digit AI
  const knownPrefixes = ['01', '10', '17', '21', '37', '3100', '3101', '3102', '3103', '3104', '3105'];
  return knownPrefixes.some((p) => barcode.startsWith(p));
}

/** Auto-detect and decode any supported barcode format. */
export function decodeBarcode(
  barcode: string,
):
  | { format: 'gs1'; data: GS1Data }
  | { format: 'internal'; data: { materialId: string; locationId: string; batchId: string | null } } {
  if (isInternalBarcode(barcode)) {
    return { format: 'internal', data: decodeInternal(barcode) };
  }
  return { format: 'gs1', data: decodeGS1(barcode) };
}
