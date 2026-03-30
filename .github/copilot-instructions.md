# @emisso/inventory — Copilot Instructions

Pure TypeScript inventory engine with double-entry location model, SAP-compatible presets, and FIFO/AVCO/standard valuation.

## Monorepo Structure

- `packages/engine/` — `@emisso/inventory`: Pure SDK, no database. Moves, quants, valuation, presets, barcode, BOM, production.

## Code Style

- TypeScript strict mode, ESM-first (CJS compat via tsup)
- Zod for all external data validation
- Engine has zero side effects — pure functions only
- Integer arithmetic for money (`money.ts`) — never floating point
- Tests: vitest with hand-verified values
- Conventional Commits: `feat(valuation): add LIFO method`

## Testing

```bash
pnpm test:run     # CI mode
pnpm test         # Watch mode
```

## Key Patterns

- Moves are double-entry: every move has `fromLocationId` and `toLocationId`
- Virtual locations start with `virtual/` — use `isVirtualLocation()` and `VIRTUAL_LOCATIONS`
- SAP presets via `fromPreset('101', params)` map to double-entry moves
- Valuation layers are immutable records created on receipt, consumed on issue
- Quants are projections derived from completed moves
