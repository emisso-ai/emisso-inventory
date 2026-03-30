# Security Policy

## Reporting a Vulnerability

**Do not open a public issue.** Email **hello@emisso.ai** with:

- Description of the vulnerability
- Steps to reproduce
- Potential impact

We will acknowledge within 48 hours and aim to fix critical issues within 7 days.

## Sensitive Areas

This SDK handles inventory valuation and financial calculations. Issues in these areas are treated with highest priority:

- Valuation layer consumption and cost calculation (`packages/engine/src/valuation/`)
- Accounting entry generation (`packages/engine/src/moves/move.ts`)
- Integer arithmetic and rounding (`packages/engine/src/money.ts`)

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | Yes       |

## Scope

- `@emisso/inventory`
