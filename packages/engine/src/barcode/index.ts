// @emisso/inventory - Barcode module
export { encodeGS1, encodeGS1HumanReadable, decodeGS1, formatGS1Date, parseGS1Date } from './gs1.js';
export {
  encodeInternal,
  decodeInternal,
  isInternalBarcode,
  isGS1Barcode,
  decodeBarcode,
} from './internal.js';
