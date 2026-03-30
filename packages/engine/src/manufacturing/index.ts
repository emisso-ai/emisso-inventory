// @emisso/inventory - Manufacturing extension
export { explodeBOM, explodeBOMMultiLevel, validateBOM } from './bom.js';
export type { FlattenedComponent } from './bom.js';
export { calculateBOMCost, calculateBOMCostMultiLevel } from './costing.js';
export type { ComponentCost } from './costing.js';
export { calculateWIP } from './wip.js';
export { calculateVariances } from './variance.js';
export type { PlannedCosts, ActualCosts } from './variance.js';
export { analyzeScrap } from './scrap.js';

// Production order lifecycle
export {
  createProductionOrder,
  transitionOrder,
  releaseOrder,
  getOrderCompletion,
} from './order.js';

// Operation confirmation
export {
  confirmOperation,
  recordComponentIssue,
  recordGoodsReceipt,
} from './confirmation.js';

// Backflush
export {
  calculateBackflush,
  generateBackflushMoves,
} from './backflush.js';

// Manufacturing presets
export {
  MANUFACTURING_PRESETS,
  registerManufacturingPresets,
} from './presets.js';
