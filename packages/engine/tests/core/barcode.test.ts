import { describe, expect, it } from 'vitest';
import {
  encodeGS1,
  encodeGS1HumanReadable,
  decodeGS1,
  formatGS1Date,
  parseGS1Date,
  encodeInternal,
  decodeInternal,
  isInternalBarcode,
  isGS1Barcode,
  decodeBarcode,
} from '../../src/index.js';

const GS = '\x1D';

// ---------------------------------------------------------------------------
// GS1 Encoding
// ---------------------------------------------------------------------------

describe('encodeGS1', () => {
  it('encodes GTIN only with correct 14-digit output', () => {
    const result = encodeGS1({ gtin: '4012345678901' });
    expect(result).toBe('0104012345678901');
  });

  it('encodes GTIN + batch with GS separator', () => {
    const result = encodeGS1({ gtin: '04012345678901', batchId: 'BATCH123' });
    expect(result).toBe('010401234567890110BATCH123');
  });

  it('encodes GTIN + batch + expiry', () => {
    const result = encodeGS1({
      gtin: '04012345678901',
      batchId: 'LOT42',
      expiryDate: new Date(2026, 11, 31), // Dec 31, 2026
    });
    // Fixed-length first (01, 17), then variable (10)
    expect(result).toBe('01040123456789011726123110LOT42');
  });

  it('encodes all fields', () => {
    const result = encodeGS1({
      gtin: '04012345678901',
      batchId: 'LOT42',
      expiryDate: new Date(2026, 11, 31),
      serialNumber: 'SN001',
      quantity: 100,
      weight: 1.5,
    });
    // Order: 01 (fixed), 17 (fixed), 3103 (fixed), 10 (var+GS), 21 (var+GS), 37 (var, last)
    expect(result).toBe(
      '0104012345678901172612313103001500' +
        '10LOT42' + GS +
        '21SN001' + GS +
        '37100',
    );
  });

  it('encodes human-readable format with parenthesized AIs', () => {
    const result = encodeGS1HumanReadable({
      gtin: '04012345678901',
      batchId: 'BATCH123',
      expiryDate: new Date(2026, 11, 31),
    });
    expect(result).toBe('(01)04012345678901(17)261231(10)BATCH123');
  });

  it('zero-pads GTIN to 14 digits', () => {
    const result = encodeGS1({ gtin: '123' });
    expect(result).toBe('0100000000000123');
  });
});

// ---------------------------------------------------------------------------
// GS1 Decoding
// ---------------------------------------------------------------------------

describe('decodeGS1', () => {
  it('parses GTIN-only barcode', () => {
    const data = decodeGS1('0104012345678901');
    expect(data.gtin).toBe('04012345678901');
    expect(data.batchId).toBeNull();
  });

  it('parses GTIN + batch', () => {
    const data = decodeGS1('010401234567890110BATCH123');
    expect(data.gtin).toBe('04012345678901');
    expect(data.batchId).toBe('BATCH123');
  });

  it('parses full barcode with all AIs', () => {
    const raw =
      '0104012345678901172612313103001500' +
      '10LOT42' + GS +
      '21SN001' + GS +
      '37100';
    const data = decodeGS1(raw);
    expect(data.gtin).toBe('04012345678901');
    expect(data.expiryDate).toEqual(new Date(2026, 11, 31));
    expect(data.weight).toBe(1.5);
    expect(data.batchId).toBe('LOT42');
    expect(data.serialNumber).toBe('SN001');
    expect(data.quantity).toBe(100);
  });

  it('handles parenthesized format', () => {
    const data = decodeGS1('(01)04012345678901(10)BATCH123(17)261231');
    expect(data.gtin).toBe('04012345678901');
    expect(data.batchId).toBe('BATCH123');
    expect(data.expiryDate).toEqual(new Date(2026, 11, 31));
  });

  it('round-trips: encode then decode returns original data', () => {
    const original = {
      gtin: '04012345678901',
      batchId: 'LOT42',
      expiryDate: new Date(2026, 11, 31),
      serialNumber: 'SN001',
      quantity: 100,
      weight: 1.5,
    };
    const encoded = encodeGS1(original);
    const decoded = decodeGS1(encoded);
    expect(decoded.gtin).toBe(original.gtin);
    expect(decoded.batchId).toBe(original.batchId);
    expect(decoded.expiryDate).toEqual(original.expiryDate);
    expect(decoded.serialNumber).toBe(original.serialNumber);
    expect(decoded.quantity).toBe(original.quantity);
    expect(decoded.weight).toBe(original.weight);
  });
});

// ---------------------------------------------------------------------------
// Date handling
// ---------------------------------------------------------------------------

describe('GS1 date helpers', () => {
  it('formatGS1Date converts Date to YYMMDD', () => {
    expect(formatGS1Date(new Date(2026, 0, 5))).toBe('260105');
    expect(formatGS1Date(new Date(2026, 11, 31))).toBe('261231');
  });

  it('parseGS1Date converts YYMMDD to Date', () => {
    expect(parseGS1Date('261231')).toEqual(new Date(2026, 11, 31));
    expect(parseGS1Date('000101')).toEqual(new Date(2000, 0, 1));
  });
});

// ---------------------------------------------------------------------------
// Internal format
// ---------------------------------------------------------------------------

describe('internal barcode', () => {
  it('encodeInternal creates correct format', () => {
    expect(encodeInternal('MAT001', 'LOC01')).toBe('INV:MAT001:LOC01');
  });

  it('encodeInternal includes batch when provided', () => {
    expect(encodeInternal('MAT001', 'LOC01', 'B42')).toBe('INV:MAT001:LOC01:B42');
  });

  it('decodeInternal parses correctly', () => {
    const result = decodeInternal('INV:MAT001:LOC01');
    expect(result).toEqual({ materialId: 'MAT001', locationId: 'LOC01', batchId: null });
  });

  it('decodeInternal round-trips', () => {
    const encoded = encodeInternal('MAT001', 'LOC01', 'B42');
    const decoded = decodeInternal(encoded);
    expect(decoded).toEqual({ materialId: 'MAT001', locationId: 'LOC01', batchId: 'B42' });
  });

  it('isInternalBarcode detects internal format', () => {
    expect(isInternalBarcode('INV:MAT001:LOC01')).toBe(true);
    expect(isInternalBarcode('0104012345678901')).toBe(false);
  });

  it('isGS1Barcode detects GS1 format', () => {
    expect(isGS1Barcode('0104012345678901')).toBe(true);
    expect(isGS1Barcode('(01)04012345678901')).toBe(true);
    expect(isGS1Barcode('INV:MAT001:LOC01')).toBe(false);
  });

  it('decodeBarcode auto-detects internal format', () => {
    const result = decodeBarcode('INV:MAT001:LOC01:B42');
    expect(result.format).toBe('internal');
    if (result.format === 'internal') {
      expect(result.data.materialId).toBe('MAT001');
      expect(result.data.batchId).toBe('B42');
    }
  });

  it('decodeBarcode auto-detects GS1 format', () => {
    const result = decodeBarcode('0104012345678901');
    expect(result.format).toBe('gs1');
    if (result.format === 'gs1') {
      expect(result.data.gtin).toBe('04012345678901');
    }
  });
});
