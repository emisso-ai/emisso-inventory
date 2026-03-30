# Roadmap

## Current State (v0.1.0)

### Core (Phase 1-2) — Done

- Double-entry location model with virtual locations (supplier, customer, production, scrap, inventory)
- Warehouse hierarchy (plant/zone/bin) with path-based lookups
- Move engine with state machine (draft → confirmed → assigned → done)
- Move validation (negative stock, same-location, virtual-to-virtual)
- Move reversal
- SAP movement type presets (101, 102, 103, 105, 201, 202, 261, 262, 301, 302, 311, 312, 551, 552, 601, 602, 701, 702)
- Valuation layers with FIFO, AVCO, and standard price consumption
- Quant projection and stock reservation (manual + auto-reserve)
- Composable routes (1/2/3-step receipt and delivery)
- Physical inventory (PI documents, counting, difference posting, ABC classification, cycle count scheduling)
- GS1-128 barcode encode/decode + internal barcode format
- Reports: stock on hand, move history, valuation

### Manufacturing Extension (Phase 3) — Done

- BOM explosion (single-level + multi-level with sub-BOM resolution)
- BOM cost rollup (single + multi-level)
- BOM validation
- Production order state machine (created → released → in_progress → completed/closed)
- Operation confirmation with yield/scrap tracking
- Component issue and goods receipt recording
- Backflush calculation + move generation
- WIP calculation (SAP-grade: material + labor + overhead)
- 5-category variance analysis (material, labor, overhead, volume, mix)
- Scrap analysis
- Manufacturing presets (261, 262)

## Planned

### Phase 4: API + CLI

- `packages/api` — Effect TS repos + services, Drizzle schema, Next.js adapter
- `packages/cli` — Effect CLI for inventory operations
- Event store implementation (PostgreSQL)
- Multi-tenant support (RLS)

### Phase 5: Distribution Extension

- `@emisso/inventory/distribution` entry point
- Pick list generation
- Packing confirmation
- Shipping + delivery posting
- Returns handling

### Future

- Batch determination (FEFO, FIFO, characteristic matching)
- Material Ledger / multi-level actual costing
- Bin-level warehouse management
- MRP (Material Requirements Planning)
- Consignment stock
