// @emisso/inventory/manufacturing - Manufacturing extension
// Re-export manufacturing types from core types
export {
  BOMSchema,
  BOMComponentSchema,
  type BOM,
  type BOMComponent,
  ProductionOrderSchema,
  ProductionOrderStatusSchema,
  ProductionOrderComponentSchema,
  ProductionOrderOperationSchema,
  type ProductionOrder,
  type ProductionOrderStatus,
  type ProductionOrderComponent,
  type ProductionOrderOperation,
  WIPResultSchema,
  type WIPResult,
  VarianceBreakdownSchema,
  type VarianceBreakdown,
  ScrapAnalysisSchema,
  type ScrapAnalysis,
  ComponentRequirementSchema,
  type ComponentRequirement,
  ComponentConsumptionSchema,
  type ComponentConsumption,
} from './types.js';

// Re-export BOM explosion, validation, and costing functions
export * from './manufacturing/index.js';
