// @emisso/inventory - Presets module
export {
  PresetRegistry,
  createDefaultRegistry,
  fromPreset,
  type PresetConfig,
  type PresetParams,
  type PresetResolver,
} from './registry.js';

export { registerGoodsReceiptPresets } from './goods-receipt.js';
export { registerGoodsIssuePresets } from './goods-issue.js';
export { registerTransferPresets } from './transfer.js';
export { registerScrapPresets } from './scrap.js';
export { registerSalesPresets } from './sales.js';
export { registerAdjustmentPresets } from './adjustment.js';
