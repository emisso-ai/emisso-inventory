/**
 * GS1-128 barcode encode/decode.
 *
 * Supports AIs: 01 (GTIN), 10 (Batch), 17 (Expiry), 21 (Serial),
 * 37 (Quantity), 3103 (Net weight kg, 3 decimal places).
 */

import { type GS1Data } from '../types.js';

/** Group Separator — delimits variable-length AI fields in raw GS1-128 strings. */
const GS = '\x1D';

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Format a Date as YYMMDD for AI 17. */
export function formatGS1Date(date: Date): string {
  const yy = String(date.getFullYear() % 100).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

/** Parse a YYMMDD string (AI 17) into a Date. Years 00-49 → 2000s, 50-99 → 1900s. */
export function parseGS1Date(yymmdd: string): Date {
  const yy = Number(yymmdd.slice(0, 2));
  const mm = Number(yymmdd.slice(2, 4));
  const dd = Number(yymmdd.slice(4, 6));
  const year = yy < 50 ? 2000 + yy : 1900 + yy;
  return new Date(year, mm - 1, dd);
}

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

/**
 * Encode GS1 data into a raw barcode string.
 *
 * Fixed-length fields (01, 17, 3103) do not require a trailing GS separator.
 * Variable-length fields (10, 21, 37) are followed by a GS separator unless
 * they are the last element in the string.
 *
 * Encoding order: 01, 17, 3103, 10, 21, 37
 * (fixed-length AIs first, then variable-length)
 */
export function encodeGS1(data: Partial<GS1Data>): string {
  const segments: Array<{ ai: string; value: string; fixed: boolean }> = [];

  if (data.gtin != null) {
    segments.push({ ai: '01', value: data.gtin.padStart(14, '0'), fixed: true });
  }
  if (data.expiryDate != null) {
    segments.push({ ai: '17', value: formatGS1Date(data.expiryDate), fixed: true });
  }
  if (data.weight != null) {
    // AI 3103: 6-digit integer representing weight × 1000 (3 implied decimal places)
    const raw = Math.round(data.weight * 1000);
    segments.push({ ai: '3103', value: String(raw).padStart(6, '0'), fixed: true });
  }

  // Variable-length AIs
  if (data.batchId != null) {
    segments.push({ ai: '10', value: data.batchId, fixed: false });
  }
  if (data.serialNumber != null) {
    segments.push({ ai: '21', value: data.serialNumber, fixed: false });
  }
  if (data.quantity != null) {
    segments.push({ ai: '37', value: String(data.quantity), fixed: false });
  }

  let result = '';
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    result += seg.ai + seg.value;
    // Add GS after variable-length fields, except the last segment
    if (!seg.fixed && i < segments.length - 1) {
      result += GS;
    }
  }
  return result;
}

/**
 * Encode GS1 data into human-readable format with parenthesized AIs.
 * Example: `(01)04012345678901(10)BATCH123(17)261231`
 */
export function encodeGS1HumanReadable(data: Partial<GS1Data>): string {
  const segments: Array<{ ai: string; value: string }> = [];

  if (data.gtin != null) {
    segments.push({ ai: '01', value: data.gtin.padStart(14, '0') });
  }
  if (data.expiryDate != null) {
    segments.push({ ai: '17', value: formatGS1Date(data.expiryDate) });
  }
  if (data.weight != null) {
    const raw = Math.round(data.weight * 1000);
    segments.push({ ai: '3103', value: String(raw).padStart(6, '0') });
  }
  if (data.batchId != null) {
    segments.push({ ai: '10', value: data.batchId });
  }
  if (data.serialNumber != null) {
    segments.push({ ai: '21', value: data.serialNumber });
  }
  if (data.quantity != null) {
    segments.push({ ai: '37', value: String(data.quantity) });
  }

  return segments.map((s) => `(${s.ai})${s.value}`).join('');
}

// ---------------------------------------------------------------------------
// Decoding
// ---------------------------------------------------------------------------

/** AI definitions: id → { length: fixed data length | null for variable } */
const AI_DEFS: Record<string, { length: number | null }> = {
  '01': { length: 14 },
  '10': { length: null },
  '17': { length: 6 },
  '21': { length: null },
  '37': { length: null },
  '3103': { length: 6 },
  '3100': { length: 6 },
  '3101': { length: 6 },
  '3102': { length: 6 },
  '3104': { length: 6 },
  '3105': { length: 6 },
};

/**
 * Try to match an AI at the current position in a raw barcode string.
 * Returns `{ ai, def }` or `null`.
 */
function matchAI(barcode: string, pos: number): { ai: string; def: { length: number | null } } | null {
  // Try 4-char AIs first (e.g. 3103), then 2-char
  for (const len of [4, 2]) {
    const candidate = barcode.slice(pos, pos + len);
    if (AI_DEFS[candidate]) {
      return { ai: candidate, def: AI_DEFS[candidate]! };
    }
  }
  return null;
}

/**
 * Decode a GS1-128 barcode string into structured data.
 * Handles both raw (GS-separated) and parenthesized human-readable formats.
 */
export function decodeGS1(barcode: string): GS1Data {
  const result: GS1Data = {
    gtin: null,
    batchId: null,
    serialNumber: null,
    expiryDate: null,
    quantity: null,
    weight: null,
  };

  // Detect parenthesized format and convert to raw
  if (barcode.includes('(')) {
    const re = /\((\d{2,4})\)([^(]*)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(barcode)) !== null) {
      applyAI(result, m[1]!, m[2]!);
    }
    return result;
  }

  // Raw format with GS separators
  let pos = 0;
  while (pos < barcode.length) {
    // Skip GS characters
    if (barcode[pos] === GS) {
      pos++;
      continue;
    }

    const matched = matchAI(barcode, pos);
    if (!matched) break;

    pos += matched.ai.length;

    let value: string;
    if (matched.def.length != null) {
      value = barcode.slice(pos, pos + matched.def.length);
      pos += matched.def.length;
    } else {
      // Variable-length: read until GS or end
      const gsIdx = barcode.indexOf(GS, pos);
      if (gsIdx === -1) {
        value = barcode.slice(pos);
        pos = barcode.length;
      } else {
        value = barcode.slice(pos, gsIdx);
        pos = gsIdx + 1; // skip the GS
      }
    }

    applyAI(result, matched.ai, value);
  }

  return result;
}

function applyAI(result: GS1Data, ai: string, value: string): void {
  switch (ai) {
    case '01':
      result.gtin = value;
      break;
    case '10':
      result.batchId = value;
      break;
    case '17':
      result.expiryDate = parseGS1Date(value);
      break;
    case '21':
      result.serialNumber = value;
      break;
    case '37':
      result.quantity = Number(value);
      break;
    default:
      // 310x weight AIs
      if (ai.startsWith('310')) {
        const decimals = Number(ai[3]);
        result.weight = Number(value) / Math.pow(10, decimals);
      }
      break;
  }
}
