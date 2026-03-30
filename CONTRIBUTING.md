# Contributing to @emisso/inventory

Thanks for your interest in contributing!

## Getting Started

```bash
git clone https://github.com/emisso-ai/emisso-inventory.git
cd emisso-inventory
pnpm install
pnpm build
pnpm test:run
pnpm lint
```

## Project Structure

```
packages/
  engine/   @emisso/inventory  — Pure SDK: moves, quants, valuation, presets, BOM, production
```

## Development Workflow

1. **Fork** and create a branch from `main`
2. **Make changes** following the conventions below
3. **Add a changeset**: `pnpm changeset`
4. **Verify**: `pnpm build && pnpm lint && pnpm test:run`
5. **Open a PR**

## Conventions

- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) — `feat(moves):`, `fix(valuation):`, etc.
- **TypeScript strict**, Zod at boundaries
- **Engine is pure** — zero I/O side effects, no database, no framework
- **Integer arithmetic** for all monetary values (cents, not dollars)
- **Tests:** Vitest with hand-verified values

## Ideas Welcome

- New movement type presets
- Additional valuation methods
- Distribution extension (pick/pack/ship)
- Batch determination strategies (FEFO, FIFO)
- MRP (Material Requirements Planning)
- Documentation and examples

## Reporting Issues

- **Bugs:** Include steps to reproduce and your environment
- **Features:** Describe the use case
- **Security:** Email hello@emisso.ai (see [SECURITY.md](./SECURITY.md))

## License

By contributing, you agree your contributions are licensed under [MIT](./LICENSE).
