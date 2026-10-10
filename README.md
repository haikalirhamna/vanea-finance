# Vanea

A local-first Android app for people with variable income. Income goes into a **Pool**; you pay yourself a steady **salary** from it; Vanea shows what you can spend each day, warns calmly when your salary outpaces your income, and guides a monthly Kakeibo reflection.

**Status:** M0, M0.1, M1, M2 and M3 done. The financial engine (`src/domain`) and the core loop are implemented: onboarding, income, business costs, expenses, salary payment, PayLater/credit lines/loans, corrections, encrypted export/import, local reminders. Not yet verified on a real Android device (see below). M2 added the monthly salary review, raise decisions, decrease and restore, pressure card, intention and Kakeibo reflection. M3 added subscriptions with price changes, salary advance, savings, Pool surplus, investments by holding, net position, purchase-to-installment conversion, app lock and the full reminder set. Next: M4 (release readiness).

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
npm test               # 608 tests: domain, data (real SQLite), features, screens
npm run test:coverage  # coverage for src/domain
npm run typecheck
npm run lint           # also enforces: src/domain imports nothing outside src/domain
npm run web            # preview in a browser (data is in memory only)
npm run android        # development build on a device or emulator
```

`src/domain` is pure TypeScript (no React, Expo or SQLite). Code organization rules are in [System Overview §3.3](docs/SYSTEM-OVERVIEW.md).

### What is and isn't verified

Verified in the build environment: all tests, type check, lint, the web export (browser walkthrough of onboarding, expense, debts) and the Android bundle compiling to Hermes bytecode. **Not verified (no device or emulator was available):** SQLCipher encryption on a phone, the Android Keystore key, the share sheet and file picker, local notifications, and scrypt speed (N = 2^15) on Hermes. Check these first on a real device.

To regenerate the Python parity fixtures after changing a rule or constant:

```sh
python3 docs/simulation/salary_engine_simulation.py --export-fixtures src/domain/__tests__/fixtures/parity.json
```

## Planned stack

Expo (React Native, New Architecture) · TypeScript · Android first · encrypted SQLite (SQLCipher) · no network access in release builds.
