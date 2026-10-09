# Vanea

A local-first Android app for people with variable income. Income goes into a **Pool**; you pay yourself a steady **salary** from it; Vanea shows what you can spend each day, warns calmly when your salary outpaces your income, and guides a monthly Kakeibo reflection.

**Status:** M0 and M0.1 done — the financial engine (`src/domain`) is implemented and tested: salary engine, ledger, subscriptions, debts and investments. The app itself (Expo) starts in M1.

## Documents

| Document | Contents |
|---|---|
| [PRD](docs/PRD.md) | Problem, goals, principles, requirements, release plan |
| [System Overview](docs/SYSTEM-OVERVIEW.md) | Tech stack, architecture, and the exact financial algorithms |
| [Schema](docs/SCHEMA.md) | SQLite tables, derived values, integrity rules |
| [Design](docs/DESIGN.md) | UX direction, copy, screens, states |
| [User Flows](docs/USER-FLOWS.md) | Step-by-step flows and edge cases |

## Salary engine simulation

The salary rules were validated with a reference simulation (Python 3, standard library only):

```sh
python3 docs/simulation/salary_engine_simulation.py
```

Results are summarized in [System Overview §5.8](docs/SYSTEM-OVERVIEW.md#58-simulation-results).

## Develop

```sh
npm install
npm test               # 361 unit, property and parity tests
npm run test:coverage  # coverage for src/domain
npm run typecheck
npm run lint           # also enforces: src/domain imports nothing outside src/domain
```

`src/domain` is pure TypeScript (no React, Expo or SQLite). Code organization rules are in [System Overview §3.3](docs/SYSTEM-OVERVIEW.md).

To regenerate the Python parity fixtures after changing a rule or constant:

```sh
python3 docs/simulation/salary_engine_simulation.py --export-fixtures src/domain/__tests__/fixtures/parity.json
```

## Planned stack

Expo (React Native, New Architecture) · TypeScript · Android first · encrypted SQLite (SQLCipher) · no network access in release builds.
