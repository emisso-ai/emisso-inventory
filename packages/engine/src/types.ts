/**
 * @emisso/inventory — Type contract
 *
 * Single source of truth for every schema in the SDK.
 * All Zod schemas with inferred TypeScript types.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------

export const LocationTypeSchema = z.enum(['physical', 'virtual', 'view']);
export type LocationType = z.infer<typeof LocationTypeSchema>;

export const VirtualTypeSchema = z.enum([
  'supplier',        // Source for goods receipts
  'customer',        // Destination for sales deliveries
  'production',      // Source/sink for manufacturing
  'scrap',           // Destination for scrapped material
  'inventory-loss',  // Destination for inventory adjustments
  'transit',         // Intermediate for inter-warehouse transfers
  'cost-center',     // Destination for cost center consumption
]);
export type VirtualType = z.infer<typeof VirtualTypeSchema>;

export const LocationSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: LocationTypeSchema,
  parentId: z.string().nullable().default(null),
  virtualType: VirtualTypeSchema.nullable().default(null),
  active: z.boolean().default(true),
});
export type Location = z.infer<typeof LocationSchema>;

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

export const MaterialTypeSchema = z.enum([
  'raw',             // Raw materials (SAP ROH)
  'semi-finished',   // Semi-finished goods (SAP HALB)
  'finished',        // Finished goods (SAP FERT)
  'packaging',       // Packaging materials (SAP VERP)
  'consumable',      // Operating supplies (SAP HIBE)
]);
export type MaterialType = z.infer<typeof MaterialTypeSchema>;

export const ValuationMethodSchema = z.enum(['fifo', 'avco', 'standard']);
export type ValuationMethod = z.infer<typeof ValuationMethodSchema>;

export const MaterialSchema = z.object({
  id: z.string(),
  description: z.string(),
  type: MaterialTypeSchema,
  baseUnit: z.string(),                              // EA, KG, LT, MT, etc.
  materialGroup: z.string().nullable().default(null), // Family/category
  valuationMethod: ValuationMethodSchema,
  standardPrice: z.number().nullable().default(null), // Only if valuationMethod = 'standard'
  batchManaged: z.boolean().default(false),
  weight: z.number().nullable().default(null),
  weightUnit: z.string().nullable().default(null),
  active: z.boolean().default(true),
});
export type Material = z.infer<typeof MaterialSchema>;

// ---------------------------------------------------------------------------
// Moves
// ---------------------------------------------------------------------------

export const MoveStateSchema = z.enum(['draft', 'confirmed', 'assigned', 'done', 'cancelled']);
export type MoveState = z.infer<typeof MoveStateSchema>;

export const MoveSchema = z.object({
  id: z.string(),
  materialId: z.string(),
  fromLocationId: z.string(),
  toLocationId: z.string(),
  quantity: z.number().positive(),
  unit: z.string(),
  unitCost: z.number().nullable().default(null),     // For receipts (value in integer cents)
  state: MoveStateSchema,
  reference: z.string().nullable().default(null),     // PO, SO, production order, PI doc
  batchId: z.string().nullable().default(null),
  presetCode: z.string().nullable().default(null),    // SAP movement type if created via preset
  reversalOfId: z.string().nullable().default(null),  // If this is a reversal move
  routeId: z.string().nullable().default(null),       // If part of a multi-step route
  timestamp: z.date(),
  createdAt: z.date(),
});
export type Move = z.infer<typeof MoveSchema>;

// ---------------------------------------------------------------------------
// Quants
// ---------------------------------------------------------------------------

export const QuantSchema = z.object({
  materialId: z.string(),
  locationId: z.string(),
  batchId: z.string().nullable().default(null),
  quantity: z.number(),                    // Total on-hand
  reservedQuantity: z.number().default(0), // Reserved by confirmed moves
});
// Note: availableQuantity = quantity - reservedQuantity (computed, not stored)
export type Quant = z.infer<typeof QuantSchema>;

// ---------------------------------------------------------------------------
// Valuation
// ---------------------------------------------------------------------------

export const ValuationLayerSchema = z.object({
  id: z.string(),
  moveId: z.string(),
  materialId: z.string(),
  quantity: z.number(),            // Original quantity received
  remainingQty: z.number(),        // Not yet consumed
  unitCost: z.number(),            // Cost per unit (integer cents)
  totalValue: z.number(),          // quantity * unitCost
  remainingValue: z.number(),      // remainingQty * unitCost
  timestamp: z.date(),
});
export type ValuationLayer = z.infer<typeof ValuationLayerSchema>;

export const ConsumedLayerSchema = z.object({
  layerId: z.string(),             // Which layer was consumed
  quantity: z.number(),            // How much was consumed from this layer
  unitCost: z.number(),            // At what cost
  totalValue: z.number(),          // quantity * unitCost
});
export type ConsumedLayer = z.infer<typeof ConsumedLayerSchema>;

// ---------------------------------------------------------------------------
// Presets (SAP movement types)
// ---------------------------------------------------------------------------

export const PresetCodeSchema = z.enum([
  // Core presets
  '101', '102', '103', '105',     // Goods receipt
  '201', '202',                    // Goods issue to cost center
  '301', '302', '311', '312',     // Transfers
  '551', '552',                    // Scrap
  '601', '602',                    // Sales delivery
  '701', '702',                    // Physical inventory adjustments
  // Manufacturing presets
  '261', '262',                    // Production consumption
]);
export type PresetCode = z.infer<typeof PresetCodeSchema>;

export const PresetDefinitionSchema = z.object({
  code: PresetCodeSchema,
  name: z.string(),
  description: z.string(),
  reversalCode: PresetCodeSchema.nullable().default(null),
  createsValuationLayer: z.boolean(),
  consumesValuationLayer: z.boolean(),
  requiresReference: z.boolean().default(false),
  requiresUnitCost: z.boolean().default(false),
});
export type PresetDefinition = z.infer<typeof PresetDefinitionSchema>;

// ---------------------------------------------------------------------------
// Accounting
// ---------------------------------------------------------------------------

export const AccountingEntryTypeSchema = z.enum([
  'inventory-debit',       // Stock value increase
  'inventory-credit',      // Stock value decrease
  'cogs',                  // Cost of goods sold
  'grn-clearing',          // Goods receipt note clearing (GR/IR)
  'scrap-expense',         // Scrap/waste expense
  'inventory-adjustment',  // Physical inventory difference
  'wip-debit',             // Work in process increase
  'wip-credit',            // Work in process decrease
  'price-difference',      // Standard price variance
  'production-variance',   // Production cost variance
]);
export type AccountingEntryType = z.infer<typeof AccountingEntryTypeSchema>;

export const AccountingEntrySchema = z.object({
  type: AccountingEntryTypeSchema,
  amount: z.number(),              // Positive = debit, negative = credit
  materialId: z.string(),
  moveId: z.string(),
  reference: z.string().nullable().default(null),
});
export type AccountingEntry = z.infer<typeof AccountingEntrySchema>;

// ---------------------------------------------------------------------------
// Physical Inventory
// ---------------------------------------------------------------------------

export const PIDocumentStateSchema = z.enum(['open', 'counting', 'counted', 'posted']);
export type PIDocumentState = z.infer<typeof PIDocumentStateSchema>;

export const PIItemSchema = z.object({
  materialId: z.string(),
  locationId: z.string(),
  bookQuantity: z.number(),
  countedQuantity: z.number().nullable().default(null),
  difference: z.number().nullable().default(null),
  batchId: z.string().nullable().default(null),
});
export type PIItem = z.infer<typeof PIItemSchema>;

export const PIDocumentSchema = z.object({
  id: z.string(),
  state: PIDocumentStateSchema,
  items: z.array(PIItemSchema),
  createdAt: z.date(),
  countedAt: z.date().nullable().default(null),
  postedAt: z.date().nullable().default(null),
});
export type PIDocument = z.infer<typeof PIDocumentSchema>;

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export const RuleTriggerSchema = z.enum(['push', 'pull']);
export type RuleTrigger = z.infer<typeof RuleTriggerSchema>;

export const RouteStepSchema = z.object({
  fromLocationId: z.string(),
  toLocationId: z.string(),
  trigger: RuleTriggerSchema,
});
export type RouteStep = z.infer<typeof RouteStepSchema>;

export const RouteSchema = z.object({
  id: z.string(),
  name: z.string(),
  steps: z.array(RouteStepSchema).min(1),
  active: z.boolean().default(true),
});
export type Route = z.infer<typeof RouteSchema>;

// ---------------------------------------------------------------------------
// Barcode (GS1)
// ---------------------------------------------------------------------------

export const GS1DataSchema = z.object({
  gtin: z.string().nullable().default(null),         // AI 01 — Global Trade Item Number
  batchId: z.string().nullable().default(null),       // AI 10 — Batch/Lot number
  serialNumber: z.string().nullable().default(null),  // AI 21 — Serial number
  expiryDate: z.date().nullable().default(null),      // AI 17 — Expiration date
  quantity: z.number().nullable().default(null),       // AI 37 — Quantity
  weight: z.number().nullable().default(null),         // AI 310x — Net weight (kg)
});
export type GS1Data = z.infer<typeof GS1DataSchema>;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export const ValidationResultSchema = z.discriminatedUnion('valid', [
  z.object({ valid: z.literal(true) }),
  z.object({ valid: z.literal(false), errors: z.array(z.string()) }),
]);
export type ValidationResult = z.infer<typeof ValidationResultSchema>;

// ---------------------------------------------------------------------------
// Move Events
// ---------------------------------------------------------------------------

export const MoveEventSchema = z.object({
  id: z.string(),
  moveId: z.string(),
  materialId: z.string(),
  fromLocationId: z.string(),
  toLocationId: z.string(),
  quantity: z.number(),
  unitCost: z.number().nullable(),
  presetCode: z.string().nullable(),
  reference: z.string().nullable(),
  batchId: z.string().nullable(),
  valuationLayerId: z.string().nullable(),   // Layer created or consumed
  accountingEntries: z.array(AccountingEntrySchema),
  timestamp: z.date(),
});
export type MoveEvent = z.infer<typeof MoveEventSchema>;

// ---------------------------------------------------------------------------
// Manufacturing: BOM
// ---------------------------------------------------------------------------

export const BOMComponentSchema = z.object({
  materialId: z.string(),
  quantity: z.number().positive(),
  unit: z.string(),
  itemCategory: z.enum(['stock', 'non-stock', 'text']),
  scrapPercentage: z.number().min(0).max(100).default(0),
  backflush: z.boolean().default(false),
  position: z.number().int().positive(),      // Sort order / line number
});
export type BOMComponent = z.infer<typeof BOMComponentSchema>;

export const BOMSchema = z.object({
  id: z.string(),
  parentMaterialId: z.string(),
  baseQuantity: z.number().positive(),        // BOM is "for X units of parent"
  baseUnit: z.string(),
  usage: z.enum(['production', 'engineering', 'sales']),
  validFrom: z.date(),
  validTo: z.date().nullable().default(null),
  components: z.array(BOMComponentSchema),
  active: z.boolean().default(true),
});
export type BOM = z.infer<typeof BOMSchema>;

// ---------------------------------------------------------------------------
// Manufacturing: Production Orders
// ---------------------------------------------------------------------------

export const ProductionOrderStatusSchema = z.enum([
  'created',
  'released',
  'partially-confirmed',
  'confirmed',
  'technically-complete',
  'closed',
]);
export type ProductionOrderStatus = z.infer<typeof ProductionOrderStatusSchema>;

export const ProductionOrderComponentSchema = z.object({
  materialId: z.string(),
  plannedQuantity: z.number(),
  issuedQuantity: z.number().default(0),
  unit: z.string(),
  backflush: z.boolean().default(false),
});
export type ProductionOrderComponent = z.infer<typeof ProductionOrderComponentSchema>;

export const ProductionOrderOperationSchema = z.object({
  id: z.string(),
  sequence: z.number().int().positive(),
  description: z.string(),
  workCenterId: z.string().nullable().default(null),
  plannedTime: z.number(),            // Minutes
  confirmedTime: z.number().default(0),
  confirmedYield: z.number().default(0),
  confirmedScrap: z.number().default(0),
});
export type ProductionOrderOperation = z.infer<typeof ProductionOrderOperationSchema>;

export const ProductionOrderSchema = z.object({
  id: z.string(),
  materialId: z.string(),               // What we're producing
  plantLocationId: z.string(),           // Which physical location
  plannedQuantity: z.number().positive(),
  unit: z.string(),
  status: ProductionOrderStatusSchema,
  bomId: z.string(),
  components: z.array(ProductionOrderComponentSchema),
  operations: z.array(ProductionOrderOperationSchema),
  receivedQuantity: z.number().default(0),
  scrapQuantity: z.number().default(0),
  startDate: z.date().nullable().default(null),
  endDate: z.date().nullable().default(null),
  createdAt: z.date(),
});
export type ProductionOrder = z.infer<typeof ProductionOrderSchema>;

// ---------------------------------------------------------------------------
// Manufacturing: WIP & Variance
// ---------------------------------------------------------------------------

export const WIPResultSchema = z.object({
  orderId: z.string(),
  materialCost: z.number(),
  activityCost: z.number(),
  overheadCost: z.number(),
  totalWIP: z.number(),
  deliveredValue: z.number(),
  balance: z.number(),               // totalWIP - deliveredValue
});
export type WIPResult = z.infer<typeof WIPResultSchema>;

export const VarianceBreakdownSchema = z.object({
  orderId: z.string(),
  inputPriceVariance: z.number(),
  usageVariance: z.number(),
  scrapVariance: z.number(),
  lotSizeVariance: z.number(),
  mixVariance: z.number(),
  totalVariance: z.number(),
});
export type VarianceBreakdown = z.infer<typeof VarianceBreakdownSchema>;

// ---------------------------------------------------------------------------
// Manufacturing: Scrap
// ---------------------------------------------------------------------------

export const ScrapAnalysisSchema = z.object({
  key: z.string(),                   // Group by key (material ID, order ID, etc.)
  totalScrap: z.number(),
  scrapRate: z.number(),             // Percentage
  plannedScrap: z.number(),
  variance: z.number(),              // actual - planned
});
export type ScrapAnalysis = z.infer<typeof ScrapAnalysisSchema>;

// ---------------------------------------------------------------------------
// Manufacturing: Component Requirement & Consumption
// ---------------------------------------------------------------------------

export const ComponentRequirementSchema = z.object({
  materialId: z.string(),
  requiredQuantity: z.number(),
  unit: z.string(),
  includesScrap: z.boolean(),
  scrapQuantity: z.number(),
});
export type ComponentRequirement = z.infer<typeof ComponentRequirementSchema>;

export const ComponentConsumptionSchema = z.object({
  materialId: z.string(),
  quantity: z.number(),
  unit: z.string(),
  locationId: z.string(),
});
export type ComponentConsumption = z.infer<typeof ComponentConsumptionSchema>;
