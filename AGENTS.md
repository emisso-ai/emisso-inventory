# @emisso/inventory

> Pure TypeScript inventory engine with double-entry location model, SAP-compatible movement type presets, and FIFO/AVCO/standard valuation.

## Architecture

Hybrid Odoo + SAP model:

- **Double-entry locations** (Odoo): every move is `(fromLocation, toLocation)`. Virtual locations represent suppliers, customers, production, scrap.
- **SAP movement types as presets**: codes like 101, 261, 601 map to preconfigured `(from, to)` tuples via `fromPreset()`.
- **Valuation layers** (Odoo): immutable cost records per receipt, consumed via FIFO/AVCO/standard.
- **Quants** (Odoo): materialized stock on hand derived from completed moves.
- **Move state machine**: `draft -> confirmed -> assigned -> done`.

## Monorepo Structure

- `packages/engine/` — `@emisso/inventory`: Pure SDK, no database. Moves, quants, valuation, presets, barcode, BOM, production.

## Entry Points

- `@emisso/inventory` — Core: locations, moves, quants, valuation, presets, physical inventory, barcode, routes, reports.
- `@emisso/inventory/manufacturing` — Extension: BOM, production orders, WIP, variance analysis, scrap.

## Development

```bash
pnpm install
pnpm build          # tsup (CJS + ESM + DTS)
pnpm test:run       # vitest CI mode
pnpm lint           # tsc --noEmit
```

## Code Style

- TypeScript strict mode, ESM-first (CJS compat via tsup)
- Zod for all type schemas, infer TypeScript types
- Integer arithmetic for money (`money.ts`) — never floating point
- Engine is pure — zero I/O, no side effects, no database
- Conventional Commits: `feat(moves): add batch reservation`
- Files: kebab-case. Functions: camelCase. Types: PascalCase. Constants: UPPER_SNAKE_CASE.

## Key Invariants

- Virtual location IDs always start with `virtual/` — use `isVirtualLocation()` from `locations/virtual.ts`
- Virtual location constants in `VIRTUAL_LOCATIONS` — never hardcode strings
- Quants only exist at physical locations, never virtual
- Valuation layers are immutable — consumption creates new layer records
- All monetary values are integers (cents) — use `money.ts` utilities
