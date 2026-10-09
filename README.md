# Vanea

A local-first Android app for people with variable income. Income goes into a **Pool**; you pay yourself a steady **salary** from it; Vanea shows what you can spend each day, warns calmly when your salary outpaces your income, and guides a monthly Kakeibo reflection.

**Status:** specification — development has not started.

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

## Planned stack

Expo (React Native, New Architecture) · TypeScript · Android first · encrypted SQLite (SQLCipher) · no network access in release builds.
