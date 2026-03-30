# @emisso/inventory

Pure TypeScript inventory engine with double-entry moves, SAP-compatible presets, and FIFO/AVCO/standard valuation.

## When to Use This

- You're building inventory management for a client and need stock tracking, valuation, and movement logic
- You're replacing SAP inventory modules with a modern, lightweight alternative
- You need barcode (GS1-128) encoding/decoding for warehouse operations
- You're building a manufacturing system that needs BOM explosion, production orders, and WIP tracking
- You want an SDK, not a monolith — pure functions, no framework, no database

## Packages

| Package | Description | Install |
|---------|-------------|---------|
| `@emisso/inventory` | Core inventory engine | `npm i @emisso/inventory` |

## Quick Start

```bash
npm install @emisso/inventory
```

### Goods Receipt (101)

```typescript
import { fromPreset, transitionMove, applyMoveToQuants } from "@emisso/inventory";

// Receive 100 units from supplier into warehouse
const move = fromPreset("101", {
  materialId: "MAT-001",
  quantity: 100,
  unitCost: 5000,
  storageLocation: "WH01/A1",
  reference: "PO-2026-001",
});

// Advance through state machine: draft → confirmed → assigned → done
const confirmed = transitionMove(move, "confirmed");
const assigned = transitionMove(confirmed, "assigned");
const done = transitionMove(assigned, "done");

// Update stock on hand
const quants = applyMoveToQuants([], done);
// → [{ locationId: "WH01/A1", materialId: "MAT-001", quantity: 100 }]
```

### Transfer Between Locations (311)

```typescript
import { fromPreset } from "@emisso/inventory";

// Transfer 20 units between storage locations
const transfer = fromPreset("311", {
  materialId: "MAT-001",
  quantity: 20,
  storageLocation: "WH01/A1",
  toStorageLocation: "WH01/B2",
});
```

### Sales Delivery (601)

```typescript
import { fromPreset } from "@emisso/inventory";

// Issue 5 units for sales delivery
const sale = fromPreset("601", {
  materialId: "MAT-001",
  quantity: 5,
  storageLocation: "WH01/A1",
  reference: "SO-2026-050",
});
```

## Architecture

Hybrid Odoo + SAP model: Odoo's double-entry location model for flexibility, SAP's movement type codes for familiarity.

- **Double-entry location model** — every move is `(from, to)`. Receiving is `supplier → warehouse`, selling is `warehouse → customer`. Virtual locations (supplier, customer, production, scrap, inventory) represent external boundaries.
- **SAP movement types as presets** — codes like 101 (goods receipt), 261 (production issue), 601 (sales delivery) resolve to the correct `from → to` locations automatically.
- **Valuation layers** — immutable cost records. FIFO consumes oldest layers first, AVCO maintains running average, standard price uses fixed cost.
- **Quants** — materialized stock on hand, derived by projecting all done moves.
- **Move state machine** — `draft → confirmed → assigned → done`. Each transition is a pure function.
- **Event-sourced** — moves are the source of truth, quants and valuations are projections.

## Core Modules

| Module | Description | Key Exports |
|--------|-------------|-------------|
| `locations` | Warehouse hierarchy + virtual locations | `createLocation`, `createWarehouseLocations`, `VIRTUAL_LOCATIONS` |
| `moves` | Move creation, state machine, validation, reversal | `createMove`, `transitionMove`, `applyMove`, `validateMove`, `createReversalMove` |
| `quants` | Stock on hand, projections, reservations | `applyMoveToQuants`, `projectQuants`, `reserveStock`, `autoReserve` |
| `valuation` | FIFO, AVCO, standard price cost layers | `createValuationLayer`, `consumeFIFO`, `consumeAVCO`, `consumeStandard` |
| `presets` | SAP movement type registry | `fromPreset`, `createDefaultRegistry`, `PresetRegistry` |
| `routes` | Composable multi-step receipt/delivery | `defineRoute`, `applyRoute`, `oneStepReceipt`, `threeStepDelivery` |
| `physical-inventory` | PI documents, cycle counting, ABC classification | `createPIDocument`, `enterCount`, `postDifferences`, `classifyABC` |
| `barcode` | GS1-128 encode/decode + internal barcodes | `encodeGS1`, `decodeGS1`, `encodeInternal`, `decodeBarcode` |
| `reports` | Stock, move history, and valuation reports | `generateStockReport`, `generateMoveHistory`, `generateValuationReport` |

## Manufacturing Extension

```typescript
import {
  explodeBOM,
  createProductionOrder,
  releaseOrder,
  confirmOperation,
  calculateBackflush,
  generateBackflushMoves,
  calculateWIP,
  calculateVariances,
} from "@emisso/inventory/manufacturing";
```

The manufacturing extension adds BOM management, production orders, and cost analysis:

### BOM Explosion

```typescript
import { explodeBOM, explodeBOMMultiLevel, calculateBOMCost } from "@emisso/inventory/manufacturing";

const bom = {
  id: "BOM-001",
  materialId: "FINISHED-001",
  quantity: 1,
  unit: "EA",
  components: [
    { materialId: "COMP-A", quantity: 2, unit: "EA" },
    { materialId: "COMP-B", quantity: 5, unit: "KG" },
  ],
};

// Single-level explosion
const requirements = explodeBOM(bom, 100);
// → [{ materialId: "COMP-A", quantity: 200 }, { materialId: "COMP-B", quantity: 500 }]

// Multi-level explosion (resolves sub-BOMs)
const allBOMs = [bom, subBOM1, subBOM2];
const flat = explodeBOMMultiLevel(bom, 100, allBOMs);

// Cost rollup
const cost = calculateBOMCost(bom, { "COMP-A": 1000, "COMP-B": 500 });
```

### Production Orders

```typescript
import { createProductionOrder, releaseOrder, confirmOperation } from "@emisso/inventory/manufacturing";

const order = createProductionOrder({
  bom,
  quantity: 100,
  plannedStart: new Date("2026-04-01"),
  plannedEnd: new Date("2026-04-05"),
});

const released = releaseOrder(order);
```

### WIP and Variance Analysis

```typescript
import { calculateWIP, calculateVariances } from "@emisso/inventory/manufacturing";

const wip = calculateWIP(order);
// → { materialCost, laborCost, overheadCost, totalWIP }

const variances = calculateVariances(
  { material: 50000, labor: 20000, overhead: 10000 }, // planned
  { material: 52000, labor: 19000, overhead: 11000 }, // actual
);
// → { material, labor, overhead, volume, mix, total }
```

## SAP Movement Type Presets

| Code | Name | Description |
|------|------|-------------|
| `101` | GR from Purchase Order | Goods receipt from supplier against PO |
| `102` | Reversal of GR from PO | Reversal of 101 |
| `103` | GR into Blocked Stock | Goods receipt into quality inspection |
| `105` | Release from Blocked Stock | Release blocked stock to unrestricted |
| `201` | GI to Cost Center | Goods issue for internal consumption |
| `202` | Reversal of GI to Cost Center | Reversal of 201 |
| `261` | GI for Production Order | Component issue to production (manufacturing) |
| `262` | Reversal of GI for Production | Reversal of 261 (manufacturing) |
| `301` | Plant-to-Plant Transfer | Transfer between plants/warehouses |
| `302` | Reversal of Plant-to-Plant | Reversal of 301 |
| `311` | Storage Location Transfer | Transfer within same plant |
| `312` | Reversal of Storage Location Transfer | Reversal of 311 |
| `551` | Scrapping | Write-off to scrap location |
| `552` | Reversal of Scrapping | Reversal of 551 |
| `601` | GI for Sales Delivery | Goods issue for customer delivery |
| `602` | Reversal of GI for Sales | Reversal of 601 |
| `701` | PI Increase | Physical inventory surplus adjustment |
| `702` | PI Decrease | Physical inventory deficit adjustment |

## Development

```bash
pnpm install
pnpm build          # Build all packages
pnpm test           # Run all tests (watch mode)
pnpm test:run       # Run all tests (CI mode)
pnpm lint           # Typecheck all packages
```

## FAQ

**What is the best TypeScript library for inventory management?**
[@emisso/inventory](https://github.com/emisso-ai/emisso-inventory) is an MIT-licensed TypeScript engine that implements double-entry inventory moves, SAP-compatible movement types, FIFO/AVCO/standard valuation, BOM explosion, production orders, and WIP tracking. Pure functions, no database, no framework.

**How do I track stock movements in TypeScript?**
Install `@emisso/inventory` and use `fromPreset("101", params)` to create moves from SAP movement type codes. Advance moves through the state machine with `transitionMove()`, then project stock on hand with `applyMoveToQuants()`.

**How do I calculate inventory valuation in TypeScript?**
Use `createValuationLayer()` on receipt, then `consumeFIFO()`, `consumeAVCO()`, or `consumeStandard()` on issue. Generate a full report with `generateValuationReport()`.

**Does this support manufacturing / BOM explosion?**
Yes. Import from `@emisso/inventory/manufacturing` for `explodeBOM()`, `createProductionOrder()`, `calculateWIP()`, and `calculateVariances()`. Supports single and multi-level BOM explosion, cost rollup, backflushing, and 5-category variance analysis.

**Can I use this with SAP movement type codes?**
Yes. The preset registry maps SAP codes (101, 261, 601, etc.) to double-entry moves. Use `fromPreset(code, params)` or build a custom registry with `PresetRegistry`.

## Alternatives

| Library | Language | Double-Entry | Valuation | Manufacturing | Open Source |
|---------|----------|:---:|:---:|:---:|:---:|
| **@emisso/inventory** | TypeScript | Yes | FIFO/AVCO/Std | Yes | MIT |
| SAP MM | ABAP | Yes | Yes | Yes | No |
| Odoo Inventory | Python | Yes | FIFO/AVCO | Yes | LGPL |
| ERPNext Stock | Python | Yes | FIFO/Moving Avg | Yes | GPL |
| InvenTree | Python | No | No | Partial | MIT |

## License

MIT — [Emisso](https://emisso.ai)
