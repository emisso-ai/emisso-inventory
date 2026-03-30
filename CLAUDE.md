# @emisso/inventory

Pure TypeScript inventory engine with double-entry moves, SAP-compatible presets, and FIFO/AVCO/standard valuation.

## Structure

Monorepo with `packages/engine` (core SDK). Future: `packages/api`, `packages/cli`.

```
emisso-inventory/
├── packages/engine/
│   ├── src/
│   │   ├── index.ts              ← Main entry (@emisso/inventory)
│   │   ├── manufacturing.ts      ← Manufacturing entry (@emisso/inventory/manufacturing)
│   │   ├── types.ts              ← All Zod schemas + inferred types
│   │   ├── money.ts              ← Integer arithmetic helpers
│   │   ├── locations/            ← Warehouse hierarchy + virtual locations
│   │   ├── moves/                ← Move creation, state machine, validation, reversal
│   │   ├── quants/               ← Stock on hand, projections, reservations
│   │   ├── valuation/            ← FIFO, AVCO, standard price layers
│   │   ├── presets/              ← SAP movement type registry (101-702)
│   │   ├── routes/               ← Composable multi-step receipt/delivery
│   │   ├── physical-inventory/   ← PI documents, cycle counting, ABC
│   │   ├── barcode/              ← GS1-128 encode/decode + internal format
│   │   ├── reports/              ← Stock, move history, valuation reports
│   │   ├── manufacturing/        ← BOM, production orders, WIP, variance
│   │   └── materials/            ← Material definitions
│   └── tests/
│       ├── core/                 ← 12 test files, 312 total tests
│       │   ├── locations.test.ts     (34 tests)
│       │   ├── moves.test.ts         (32 tests)
│       │   ├── quants.test.ts        (24 tests)
│       │   ├── valuation.test.ts     (38 tests)
│       │   ├── presets.test.ts       (33 tests)
│       │   ├── routes.test.ts        (19 tests)
│       │   ├── physical-inventory.test.ts (23 tests)
│       │   ├── barcode.test.ts       (21 tests)
│       │   └── reports.test.ts       (14 tests)
│       └── manufacturing/
│           ├── bom.test.ts           (25 tests)
│           ├── production.test.ts    (26 tests)
│           └── wip.test.ts           (23 tests)
└── CLAUDE.md
```

## Commands

From `packages/engine/`:

```bash
pnpm run build        # tsup (CJS + ESM + DTS)
pnpm run test         # vitest (watch mode)
pnpm run test:run     # vitest (CI mode)
pnpm run lint         # tsc --noEmit
```

## Architecture

- **Double-entry location model** (Odoo-inspired): every move is `(from, to)`
- **SAP movement types as presets**: 101, 102, 103, 105, 201, 202, 261, 262, 301, 302, 311, 312, 551, 552, 601, 602, 701, 702
- **Valuation layers** (Odoo-inspired): immutable cost records, FIFO/AVCO/standard
- **Quants**: materialized stock on hand, derived from moves
- **Event-sourced**: moves are the source of truth, quants are projections
- **Move state machine**: draft → confirmed → assigned → done

## Code Style

- Pure functions, no side effects, no I/O
- Zod schemas for all types, infer TypeScript types
- Integer arithmetic for money (no floats)
- Files: kebab-case. Functions: camelCase. Types: PascalCase. Constants: UPPER_SNAKE_CASE
- Schemas: PascalCase + Schema suffix (e.g., `MaterialSchema`)

## Entry Points

- `@emisso/inventory` — Core: locations, moves, quants, valuation, presets, barcode, physical inventory, routes, reports
- `@emisso/inventory/manufacturing` — Extension: BOM explosion, production orders, WIP, variance, scrap, backflush

## Implemented Modules

### Core (`@emisso/inventory`)

| Module | Key Functions |
|--------|---------------|
| `locations` | `createLocation`, `createWarehouseLocations`, `findLocation`, `getChildLocations`, `getLocationPath`, `isChildOf`, `canHoldStock`, `VIRTUAL_LOCATIONS`, `createVirtualLocations`, `supplierLocation`, `customerLocation`, `location` |
| `moves` | `createMove`, `transitionMove`, `applyMove`, `validateMove`, `createReversalMove`, `generateId`, `isVirtualLocation` |
| `quants` | `findQuant`, `getAvailableStock`, `getTotalStock`, `getStockByLocation`, `applyMoveToQuants`, `projectQuants`, `reserveStock`, `unreserveStock`, `autoReserve` |
| `valuation` | `createValuationLayer`, `consumeFromLayer`, `consumeFIFO`, `calculateAverageCost`, `consumeAVCO`, `consumeStandard` |
| `presets` | `fromPreset`, `createDefaultRegistry`, `PresetRegistry` |
| `routes` | `defineRoute`, `applyRoute`, `findMatchingRoute`, `oneStepReceipt`, `twoStepReceipt`, `threeStepReceipt`, `oneStepDelivery`, `twoStepDelivery`, `threeStepDelivery` |
| `physical-inventory` | `createPIDocument`, `enterCount`, `isFullyCounted`, `finalizeCounting`, `postDifferences`, `calculateAdjustmentValue`, `classifyABC`, `generateCycleCountSchedule` |
| `barcode` | `encodeGS1`, `encodeGS1HumanReadable`, `decodeGS1`, `formatGS1Date`, `parseGS1Date`, `encodeInternal`, `decodeInternal`, `isInternalBarcode`, `isGS1Barcode`, `decodeBarcode` |
| `reports` | `generateStockReport`, `generateMoveHistory`, `generateValuationReport` |

### Manufacturing (`@emisso/inventory/manufacturing`)

| Module | Key Functions |
|--------|---------------|
| `bom` | `explodeBOM`, `explodeBOMMultiLevel`, `validateBOM` |
| `costing` | `calculateBOMCost`, `calculateBOMCostMultiLevel` |
| `order` | `createProductionOrder`, `transitionOrder`, `releaseOrder`, `getOrderCompletion` |
| `confirmation` | `confirmOperation`, `recordComponentIssue`, `recordGoodsReceipt` |
| `backflush` | `calculateBackflush`, `generateBackflushMoves` |
| `wip` | `calculateWIP` |
| `variance` | `calculateVariances` |
| `scrap` | `analyzeScrap` |
| `presets` | `MANUFACTURING_PRESETS`, `registerManufacturingPresets` |

## Test Coverage

- 12 test files, 312 tests, all passing
- Core: 238 tests across 9 files
- Manufacturing: 74 tests across 3 files
