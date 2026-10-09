# Vanea — System Overview & Domain Specification

**Version:** 2.1
**Status:** Draft for review
**Last updated:** 2026-10-09

This document is the single source of truth for Vanea's architecture and for every financial algorithm. The PRD describes *what* the product does and *why*; this document defines *exactly how* the numbers are calculated. When the two disagree, fix the disagreement — do not pick one silently.

---

## 1. Architecture Goals

Vanea is a local-first personal finance app for Android.

Priorities, in order:

1. **Correct money.** Financial rules are deterministic, tested, and reproducible from source records.
2. **Privacy and local ownership.** No account, no server, no network access in release builds.
3. **Explainability.** Every computed number can be explained to the user in one or two sentences.
4. **Simplicity.** Use the default Expo / React Native structure. No heavyweight architecture frameworks.

---

## 2. Tech Stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | **Expo** (latest stable SDK at project start), React Native New Architecture, Hermes | The New Architecture is the only runtime since React Native 0.82. |
| Language | TypeScript, `strict: true` | |
| Navigation | Expo Router (default template) | |
| Platform | **Android first** | iOS is out of scope for v1. |
| Database | `expo-sqlite` with `useSQLCipher: true` | Encrypted SQLite. Requires a native build (development build / EAS), not Expo Go. |
| Data access | Drizzle ORM with its expo-sqlite driver *(recommended)*, or hand-written SQL repositories | Must support versioned migrations. |
| Secrets | `expo-secure-store` (Android Keystore) | Stores the database key. |
| App lock | `expo-local-authentication` | Biometric or device credential. |
| Local notifications | `expo-notifications` | Local scheduling only; no push server. |
| Backup | `expo-file-system`, `expo-sharing`, `expo-document-picker` | Export/import of an encrypted backup file. |
| Randomness | `expo-crypto` | Database key and backup salt/nonce generation. |
| Backup encryption | `@noble/ciphers` (XChaCha20-Poly1305) + `@noble/hashes` (scrypt) *(candidate)* | Pure JS; validate performance on a mid-range device in M5. |
| Tests | Jest with `ts-jest` for `src/domain` (plain Node, no Expo needed); `jest-expo` for UI tests from M1. `fast-check` for property tests | |
| Lint | ESLint (Expo config) + `no-restricted-imports` for `src/domain` | Enforces the domain boundary. |
| Builds | `npx expo run:android` / EAS Build | APK for personal use; AAB for Google Play. |

### 2.1 No network in release builds

Release builds remove the INTERNET permission through `android.blockedPermissions` in `app.config.js`, applied only to the production build profile (development builds need the network for Metro). Exporting a backup uses the Android share sheet; any upload is performed by the app the user chooses, not by Vanea.

### 2.2 Android Auto Backup is disabled

Set `android.allowBackup: false`. Android Auto Backup would copy the encrypted database but not the Keystore-held key, producing an unreadable restore. Backups are explicit, user-controlled exports (§11).

---

## 3. Project Structure & Code Organization

### 3.1 Structure

Files are grouped by **concern**, not one file per function (§3.3).

```text
app/                          Expo Router screens — render, navigate, call feature hooks
src/
  domain/                     Pure TypeScript — all financial rules (no React, no Expo, no SQLite)
    config.ts                 All tunable constants (§5.1)
    money.ts                  Integer rupiah arithmetic and rounding
    calendar.ts               Dates, months, salary periods, payday math
    statistics.ts             Median, mean, usual swing
    ledger.ts                 Accounts, transaction kinds, movements, balances, Pool invariant, reversals (§6.1, §6.2, §6.7)
    income-history.ts         Monthly net income series (§5.2)
    pool.ts                   Monthly commitment, runway, safe surplus (§5.6, §6.6)
    salary-recommendation.ts  Sustainable salary, recommendation, explanation, depletion month (§5.3)
    salary-review.ts          Five gates and evaluation result (§5.4)
    salary-change.ts          Initial, calibration, increase, decrease, restore rules (§5.5)
    salary-payment.ts         Entitlement, partial payment, top-up (§6.3)
    salary-advance.ts         Advance limits, installments, outstanding, income-reversal remainder (§6.4, §6.5)
    salary-pressure.ts        Pressure levels and safe salary (§5.6)
    spending.ts               Available Spending, daily allowance, pace (§7)
    reflection.ts             Highlights, set-aside, intention vs actual (§8)
    __tests__/                One test file per module (e.g. salary-review.test.ts), plus:
                                parity.test.ts      TypeScript vs the Python reference (fixtures/parity.json)
                                invariants.test.ts  property tests (fast-check)
                                helpers/builders.ts transaction and series builders
  data/
    database.ts               Open encrypted DB, key handling, migrations runner
    schema.ts                 Table definitions and migrations
    profile.ts                Profile and settings
    transactions.ts           Transactions and movements (append-only writes)
    salary.ts                 Salary settings, evaluations, advances
    recurring-costs.ts        Subscriptions
    planning.ts               Historical income months, intentions, reflections
    backup.ts                 Export and import
  features/<feature>/         One folder per feature (dashboard, income, salary, spending, reflection, settings)
    <feature>-hooks.ts        All hooks of the feature in one file
    components/               Feature-specific components, grouped by screen section
  components/                 Shared UI components
  lib/
    format.ts                 Money, number and date formatting
    notifications.ts          Local notification scheduling
    security.ts               App lock and key storage helpers
```

### 3.2 Dependency Rules

| Layer | May import |
|---|---|
| `app/`, `src/features/` | `src/domain`, `src/data`, `src/components`, `src/lib` |
| `src/data/` | `src/domain` (types and validation only) |
| `src/domain/` | Only `src/domain`. **No** `react`, `react-native`, `expo-*`, or database imports. |

Screens contain no financial rules. A screen asks a hook for a value; the hook reads records through `src/data` and computes with `src/domain`.

### 3.3 Code Organization Rules

These rules apply to every layer.

1. **One function, one job.** A function makes one decision or performs one transformation.
2. **Split instead of growing.** If a function handles several decisions, or grows beyond about 30 lines, extract each decision into a **private helper** (not exported) in the same file.
3. **Exports are the public API.** A module exports only what other modules or layers use. Everything else stays private.
4. **Group by concern, not by function.** Related functions live together in one file named after the concern — `authentication.ts` holding `login` and `logout`, not `login.ts` and `logout.ts`. A new file is created only for a new concern.
5. **Split a file only when it holds two concerns** or becomes hard to navigate (roughly 400 lines). Split by concern, never into one file per function.
6. **Tests mirror modules:** one test file per module, testing exported functions. Private helpers are covered through them.

Example — `salary-review.ts`:

```ts
// Public API: the only export.
export function evaluateRaise(input: RaiseInput): RaiseEvaluation {
  return (
    checkEnoughData(input) ??
    checkCooldown(input) ??
    checkRealShift(input) ??
    checkNotSeasonal(input) ??
    checkAffordable(input) ??
    eligible(input)
  );
}

// Private helpers: one gate or one calculation each.
function checkEnoughData(input: RaiseInput): RaiseEvaluation | null { … }
function checkCooldown(input: RaiseInput): RaiseEvaluation | null { … }
function checkRealShift(input: RaiseInput): RaiseEvaluation | null { … }
function checkNotSeasonal(input: RaiseInput): RaiseEvaluation | null { … }
function checkAffordable(input: RaiseInput): RaiseEvaluation | null { … }
function eligible(input: RaiseInput): RaiseEvaluation { … }
function referenceIncome(months: MonthlyIncome[]): number { … }
function shiftThreshold(referenceWindow: number[]): number { … }
```

Lint signals (warnings, reviewed by hand): ESLint `max-lines-per-function` (40), `complexity` (10), `max-lines` (400).

## 4. Conventions

| Topic | Rule |
|---|---|
| Currency | IDR only. Income received in other currencies is out of scope. |
| Money | **Integer rupiah** (`number`, always an integer). No floating-point money is stored. Intermediate ratios may be floats; results are rounded down to integer rupiah unless stated. |
| Dates | Local calendar dates as `YYYY-MM-DD`. The device time zone defines "today". |
| Months | `YYYY-MM`. A month is **completed** when today is in a later month. |
| Timestamps | ISO 8601 UTC, for audit only (`created_at`, `updated_at`). |
| IDs | Random unique text IDs (UUID v4 or ULID). |
| Display | Amounts render as `Rp 4.250.000` (dot thousands separator, no decimals). Negative: `−Rp 300.000`. Dates render as `25 Oct 2026`. |
| Future dates | Financial records cannot be dated after today. |
| Early dates | Financial records cannot be dated before the onboarding date (older income belongs in historical months). |

---

## 5. Salary Engine

### 5.1 Configuration

All thresholds live in `src/domain/config.ts`. Values below are the validated defaults (§5.8).

| Constant | Default | Used in |
|---|---|---|
| `SAFETY_MARGIN` | 0.05 | Recommendation never exceeds 95% of mean net income |
| `ENGINE_WINDOW_MONTHS` | 12 | Months used for recommendation and affordability |
| `MIN_RECOMMENDATION_MONTHS` | 3 | Minimum data for a recommendation |
| `RECOMMEND_ROUNDING` | 50.000 | Recommendation rounded down |
| `MAX_RAISE_PERCENT` | 5 | Maximum raise per adjustment (integer percent, computed with integer math) |
| `RAISE_ROUNDING` | 10.000 | Raise amount rounded down |
| `MIN_SHIFT` | 0.05 | Minimum required income shift |
| `SWING_MULTIPLIER` | 1.5 | Shift must exceed 1.5 × usual swing |
| `RECENT_MONTHS` | 3 | Evidence window |
| `REFERENCE_MAX_MONTHS` | 12 | Reference baseline window |
| `MIN_DATA_MONTHS` | 6 | Minimum data for a raise review |
| `CALIBRATION_PERIODS` | 3 | Free salary adjustment after onboarding |
| `RESTORE_LOOKBACK_MONTHS` | 12 | Restore ceiling lookback |
| `PRESSURE_ATTENTION_MONTHS` | 6 | Pressure level threshold |
| `PRESSURE_SERIOUS_MONTHS` | 3 | Pressure level threshold |
| `DEFAULT_BUFFER_MONTHS` | 3 | Safe surplus calculation (user-editable) |
| `PAYDAY_MIN` / `PAYDAY_MAX` | 1 / 28 | Allowed payday days |
| `ADVANCE_MIN_TERM` / `ADVANCE_MAX_TERM` | 1 / 6 | Salary advance term in periods |
| `ADVANCE_REVERSAL_DEFAULT_TERM` | 3 | Term of an advance created by an income reversal |
| `PACE_THRESHOLD` | 0.15 | Pace message appears when spending is this far ahead of time |
| `HIGHLIGHT_LOOKBACK_MONTHS` | 3 | Months compared for reflection highlights |
| `HIGHLIGHT_RELATIVE_CHANGE` | 0.20 | Minimum relative change to highlight |
| `HIGHLIGHT_MIN_AMOUNT` | 200.000 | Minimum absolute change to highlight |
| `HIGHLIGHT_MAX_ITEMS` | 2 | Highlights shown |

### 5.2 Monthly Net Income

The engine works on **monthly net income**: what the user's work produced in a month after business costs.

```text
net(m) = historical(m)
       + Σ income dated in m
       − Σ business costs dated in m
```

- Reversed transactions and their reversals are excluded (they cancel out).
- `historical(m)` comes from onboarding (SCHEMA §3.2). It exists only for months before onboarding and for the part of the onboarding month before the onboarding date.
- Only **completed** months are used.
- A reversed income or business cost is excluded together with its reversal, as if it never happened. A correction contributes through its replacement transaction.
- Net income can be negative in a month of heavy costs; it is not clamped. (A yearly subscription paid in one month makes that month look weak — see PRD §14.)
- The engine series runs from the earliest month with data to the last completed month. Months inside that span with no records count as **0**. A month with no income is real information for variable-income users.

### 5.3 Sustainable Salary & Recommendation ("worst-months test")

Question answered: *What is the highest salary that could still be paid if the user's weakest months arrived back-to-back, starting today?*

```text
window      = last min(n, 12) completed months of net(m)
cap         = (1 − SAFETY_MARGIN) × mean(window)
sorted      = window sorted ascending
worst_k     = (Pool_now + Σ sorted[1..k]) / k        for k = 1..len(window)
sustainable = max(0, min(cap, min_k worst_k))
recommended = floor(sustainable / 50.000) × 50.000
```

- Requires at least 3 months of data. With fewer, there is no recommendation (§5.5.1).
- `Pool_now` is the current Pool balance.
- The 5% safety margin keeps the Pool slowly growing. In simulation, a salary equal to 100% of mean income left 5% of stable-income users unable to pay their full salary at least once in two years. With 95% it dropped to 0%.

**Explanation shown to the user** uses the `k` that produced the minimum:

> If your 3 weakest months (Rp 3.000.000, Rp 4.000.000, Rp 4.000.000) came back-to-back, your Pool of Rp 5.000.000 plus that income could still pay Rp 5.300.000 for 3 months.

If the cap is the binding constraint:

> This keeps your salary at 95% of your average income, so your Pool keeps growing slowly.

**Worked example.** History 4, 10, 3, 9, 4, 11 (Rp million), Pool 5:

| k | Weakest months | (Pool + sum) / k |
|---|---|---|
| 1 | 3 | 8.00 |
| 2 | 3, 4 | 6.00 |
| 3 | 3, 4, 4 | **5.33** |
| 4 | 3, 4, 4, 9 | 6.25 |
| 5 | … 10 | 7.00 |
| 6 | … 11 | 7.67 |

Cap = 0.95 × 6.83 = 6.49. Sustainable = 5.33. Recommended = **Rp 5.300.000**.

**Worst-case depletion month** (used when the user picks a salary above the recommendation): the smallest `k` where `Pool_now + Σ sorted[1..k] < k × salary`.

> If your weakest months repeat, your Pool would run out in month 3.

### 5.4 Raise Eligibility ("five gates")

Evaluated once per completed month (on the first app open in a new month) and again whenever records in completed months change. All five gates must pass, in order. The first failing gate determines the status and the message.

Definitions:

```text
recent      = net income of the last 3 completed months
reference   = median of up to 12 completed months before `recent`
swing       = median(|x − reference| for x in reference window) / reference
threshold   = max(MIN_SHIFT, SWING_MULTIPLIER × swing)
anchor      = effective period of the latest salary setting of type
              initial, calibration or increase
```

| # | Gate | Passes when | Status if it fails |
|---|---|---|---|
| 1 | Enough data | Engine series has ≥ 6 completed months | `INSUFFICIENT_DATA` |
| 2 | Cooldown | All 3 `recent` months are ≥ `anchor` (three full months at the current salary) | `COOLDOWN` |
| 3 | Real shift | **Every** month in `recent` ≥ `reference × (1 + threshold)` | `OBSERVING` |
| 4 | Not seasonal | If the same 3 calendar months of last year exist in the series: `median(recent) ≥ 1.05 × median(same months last year)`. Skipped when they do not exist. | `SEASONAL_PATTERN` |
| 5 | Affordable | `sustainable ≥ current salary × 1.05` (§5.3, using the current Pool) | `NOT_AFFORDABLE` |

All gates pass → `ELIGIBLE`, with:

```text
max_raise      = floor(current salary × 0.05 / 10.000) × 10.000
max_new_salary = current salary + max_raise
```

Known limitation: the usual swing is a median-based measure, so it reads as 0 when most months are identical (for example 4, 7, 4, 7, 4). The threshold then falls back to 5%. Real income rarely repeats exactly; re-check with real data in the validation period.

Why each gate exists:

- **Gate 3 uses the minimum, not the median.** A single strong month cannot carry the evidence. "Every month" means the higher level actually held.
- **The threshold scales with the user's usual swing.** If income normally moves ±30%, a 10% "increase" is noise. The user sees: *"Your income usually moves about 30% month to month, so an increase has to be larger than that to count."*
- **The reference window is up to 12 months.** A longer reference includes both high and low seasons, so a seasonal peak does not look like growth.
- **Gate 4** catches seasonal earners once a year of data exists.
- **Gate 5** guarantees that every raise is one the Pool can sustain through the user's weakest months. In simulation, raises granted by these gates **never** increased the number of users unable to pay their salary (§5.8).
- **All-or-nothing affordability.** If the Pool cannot support the full 5%, the review waits. Allowing partial raises let ordinary fluctuations trigger small raises for 24% of stable-income users in simulation, which contradicts "stability alone does not raise salary".

Worked example: salary Rp 5.000.000, reference Rp 5.300.000, swing 4% → threshold = max(5%, 6%) = 6% → bar Rp 5.618.000. Recent months 6.0 / 6.2 / 6.4 million → lowest Rp 6.000.000 ≥ bar ✓. Not seasonal ✓. Sustainable Rp 5.400.000 ≥ Rp 5.250.000 ✓. **Eligible: up to Rp 5.250.000.**

### 5.5 Salary Changes

A salary change applies to the **first salary period with no payment recorded yet**.

| Change | Allowed when | Limit | Resets cooldown anchor |
|---|---|---|---|
| `initial` | Onboarding | None (recommendation shown; above-recommendation requires the depletion disclosure) | Yes |
| `calibration` | Within the first 3 salary periods after onboarding | None (same disclosure if above the current recommendation) | Yes |
| `increase` | Latest evaluation is `ELIGIBLE` and undecided | ≤ `max_new_salary`; the user may choose less | Yes |
| `decrease` | Anytime | Must be > 0 | No |
| `restore` | Current salary < restore ceiling | ≤ restore ceiling (same disclosure if above the current recommendation) | No |

#### 5.5.1 With fewer than 3 months of data

No recommendation is produced. The user chooses a salary, guided by: *"Start no higher than your weakest recent month."* Calibration (above) lets them adjust freely once data arrives.

#### 5.5.2 Restore ceiling

```text
restore_ceiling = max salary amount in effect for any period within the last 12 months
```

A user who lowered their salary during a hard month can return to it without passing the gates. Without this rule, lowering salary would become a trap (returning from Rp 4M to Rp 5M would be a +25% "raise"). When `restore_ceiling` > current salary, the Salary screen offers Restore before any raise review.

#### 5.5.3 Decisions on an eligible review

| Decision | Result |
|---|---|
| Accept full | New salary = `max_new_salary` |
| Accept smaller | New salary = user amount, `current < amount ≤ max_new_salary` |
| Decline | Salary unchanged. The next monthly evaluation runs normally; there is no penalty. |
| No decision | When the next evaluation is created, the undecided one is marked `expired`. |

Vanea never changes salary automatically, in either direction.

### 5.6 Salary Pressure (income decline warning)

Requires ≥ 3 completed months. Computed whenever the dashboard loads.

```text
typical            = median(net income of last 3 completed months)
monthly_commitment = salary + Σ active recurring costs per month
                     (monthly amount, or yearly amount / 12)
runway_months      = Pool / monthly_commitment
if salary > typical:
    months_to_empty = Pool / (salary − typical)
```

| Level | Condition | Shown |
|---|---|---|
| `NONE` | salary ≤ typical and runway ≥ 1 | Runway line only |
| `THIN_BUFFER` | salary ≤ typical and runway < 1 | Quiet note: Pool covers less than a month |
| `INFO` | salary > typical and months_to_empty > 6 | Quiet note |
| `ATTENTION` | salary > typical and 3 < months_to_empty ≤ 6 | Card with explanation and the current safe salary (§5.3) |
| `SERIOUS` | salary > typical and months_to_empty ≤ 3 | Card + one local notification per month |

The safe salary is shown only when it is lower than the current salary. Vanea never lowers salary for the user.

In simulation, users with declining income who ignored warnings were all unable to pay their full salary at some point. Users who lowered their salary to the suggested safe level at `ATTENTION` dropped to 17%. For volatile income, the rate dropped from 14% to 1% (§5.8).

### 5.7 Evaluation Statuses

```text
INSUFFICIENT_DATA → COOLDOWN → OBSERVING → SEASONAL_PATTERN → NOT_AFFORDABLE → ELIGIBLE
                                                                                 ↓
                                                    accepted | accepted_smaller | declined | expired
```

Each monthly evaluation is stored as a snapshot (SCHEMA §3.9) so the user can see why a status was given, even if later corrections change the inputs.

### 5.8 Simulation Results

Source: `docs/simulation/salary_engine_simulation.py` (reference implementation of §5.3–§5.6). Each scenario has 2.000 synthetic histories: 12 months of history at onboarding, then 24 live months. The opening Pool is one typical month. Each month: income enters the Pool, salary is paid, the raise rule is evaluated, and **the user always accepts the maximum raise** (worst case).

"Shortfall" = share of histories where the Pool could not pay the full salary at least once.

#### Fixed examples

| Series (Rp million) | Original v1 rule | Vanea gates 3–4 |
|---|---|---|
| Growth 5, 5.3, 5.7, 6, 6.2, 6.4 | eligible | eligible ✓ |
| One-off spike 5, 5.2, 5.1, 15, 5.3, 5.2 | not eligible | observing ✓ |
| Volatile 4, 10, 3, 9, 4, 11 | **eligible ✗** | observing ✓ |
| Seasonal, 6 months 4, 4, 5, 10, 11, 5 | eligible ✗ | eligible ✗ (not detectable with 6 months; gate 5 limits harm) |
| Seasonal, 12 months (pattern repeats) | **eligible ✗** | observing ✓ |
| Declining 8, 7.5, 7, 6.5, 6, 5.5 | not eligible | observing ✓ |

#### Lifecycle simulation

| Scenario | Should raise? | No raises: shortfall | v1: any raise | v1: shortfall | **Vanea: any raise** | **Vanea: salary change** | **Vanea: shortfall** |
|---|---|---|---|---|---|---|---|
| Stable | no | 0% | 100% | 80% | 4% | +0% | **0%** |
| One-off spike | no | 0% | 100% | 46% | 16% | +1% | **0%** |
| Seasonal | no | 0% | 100% | 100% | 14% | +1% | **0%** |
| Volatile | no | 16% | 100% | 57% | 30% | +2% | **16%** |
| Declining | no | 100% | 91% | 100% | 0% | +0% | **100%** |
| Step +20% | yes | 0% | 100% | 43% | 92% | +7% | **0%** |
| Step +8% | yes | 0% | 100% | 72% | 39% | +2% | **0%** |
| Gradual growth | yes | 0% | 100% | 37% | 99% | +12% | **0%** |
| Step +20%, volatile | yes | 4% | 100% | 55% | 50% | +3% | **4%** |

Conclusions:

1. The original rule granted raises in almost every history — on average 6 to 11 raises in two years even for stable, seasonal and volatile income — and caused salary shortfalls in 37–100% of histories.
2. **Vanea's shortfall rate equals the no-raise baseline in every scenario.** Raises never cause shortfalls.
3. Remaining false positives are small (≤ +2% total over two years) and affordable by construction.
4. The volatile (16%) and declining (100%) shortfalls exist even without raises. They are handled by salary pressure warnings (§5.6), not the raise rule.

#### Salary pressure warning

| Scenario | Ignores warnings: shortfall | Lowers salary at `ATTENTION`: shortfall |
|---|---|---|
| Declining | 100% | 17% |
| Volatile | 14% | 1% |
| Stable | 0% | 0% |

Re-run the simulation whenever a constant in §5.1 changes, and after three months of real personal use (PRD §12).

---

## 6. Ledger Engine

### 6.1 Accounts

| Account | Meaning | Can be negative? |
|---|---|---|
| `pool` | Income not yet paid as salary or used for business costs | **Never** |
| `personal` | **Available Spending** — the user's personal money | Yes (shown as overspent) |
| `savings` | Money set aside | Never |
| `investment` | Money invested (cost basis; no market value tracking in v1) | Never |

```text
balance(account) = Σ movements(account)
```

All balances are derived from movements. Cached balances, if any, must be reproducible from movements.

### 6.2 Transaction Kinds

Every financial event is one immutable `transaction` with one or more `movements`. `amount` is always positive.

| Kind | Movements | Notes |
|---|---|---|
| `opening_balance` | `+amount` on its `account` | Onboarding only |
| `income` | pool `+amount` | |
| `business_cost` | pool `−amount` | Subscriptions, tools, tax, other |
| `salary_payment` | pool `−amount`, personal `+amount` | `amount` = net paid (§6.3) |
| `expense` | personal `−amount` | Needs / Wants / Growth / Unexpected |
| `savings_deposit` | personal `−amount`, savings `+amount` | |
| `savings_withdrawal` | savings `−amount`, personal `+amount` | |
| `investment_contribution` | personal `−amount`, investment `+amount` | |
| `investment_withdrawal` | investment `−amount`, personal `+amount` | |
| `surplus_allocation` | pool `−amount`, savings or investment `+amount` | §6.6 |
| `advance_disbursement` | pool `−amount`, personal `+amount` | §6.4 |
| `advance_early_repayment` | personal `−amount`, pool `+amount` | §6.4 |
| `reversal` | Negates the movements of `reverses_id` | §6.5, §6.7 |

**Pool invariant.** A transaction that debits the Pool is valid only if the Pool's running balance, ordered by date, stays ≥ 0 on the transaction date and every later date. Equivalently, for a Pool debit `a` on date `d`: `min(balance(t) for t ≥ d) ≥ a`. Violations return a domain validation result with the maximum allowed amount.

### 6.3 Salary Payments

- **Payday:** the user picks a day of month, 1–28. Each salary period is identified by the `YYYY-MM` of its payday.
- **Entitlement** for a period:

  ```text
  entitlement = salary in effect for the period − advance installment (if an advance is active)
  ```

- The user records payments manually. Vanea never moves real money.
- **Partial payment:** if the Pool is smaller than the remaining entitlement, the maximum payment is the available Pool (error pattern in DESIGN §12).
- **Top-up:** further payments in the same period are allowed until the entitlement is fully paid.
- **Installment lock:** the advance installment is withheld on the period's **first** payment and recorded on it. Once any payment exists, the period's entitlement is fixed, even if the advance changes later. Top-ups withhold nothing.
- **Fully withheld period:** if the whole salary is withheld (for example, a one-period advance equal to the salary), the user records a zero-amount payment that only settles the installment.
- **No arrears:** unpaid entitlement does not carry into the next period. Low income lowers that period's pay instead of creating a debt to oneself.
- Total payments in a period can never exceed the entitlement.

### 6.4 Salary Advance

A salary advance moves money from the Pool to Available Spending now and is repaid by withholding part of future salary.

| Rule | Value |
|---|---|
| Amount | ≤ current salary and ≤ what the Pool invariant allows |
| Term | 1–6 salary periods, no interest |
| Installment | `ceil(amount / term)`; the final installment is the remainder |
| Active advances | At most one. A new advance requires the previous one to be repaid. |
| Repayment | In each period, the installment is withheld from the entitlement (§6.3). The withheld amount simply stays in the Pool. |
| Period without payment | If no salary payment is recorded in a period, no installment is applied, and the schedule extends by one period. |
| Early repayment | `advance_early_repayment` from Available Spending, any amount ≤ outstanding. The installment amount stays the same, so the advance finishes sooner. |
| Outstanding | `amount − Σ installments applied − Σ early repayments` (non-reversed) |
| Repaid | When outstanding reaches 0, status becomes `repaid` |

Small overspending does not need an advance. Available Spending may go negative and the next salary covers it. Advances are for large, planned costs (for example, replacing a broken laptop).

### 6.5 Income Reversal (refund or chargeback)

Reversing an income transaction normally debits the Pool by its amount. If that would break the Pool invariant:

```text
pool_part      = what the invariant allows (normally the current Pool)
remainder      = income amount − pool_part
reversal       → pool −pool_part
advance        → created automatically for `remainder`, origin = income_reversal,
                 no disbursement movement, default term 3 periods (user may change 1–6)
```

Rationale: salary already paid was funded by money that turned out not to exist. The remainder is recovered from future salary instead of making the Pool negative.

If the Pool is empty, `pool_part` is 0 and the reversal is recorded with amount 0 (so it still marks the income as reversed).

If an advance is already active, the remainder is added to it. The installment stays the same, so the advance simply runs longer; only if that would exceed 6 remaining periods does the installment grow to `ceil(new outstanding / 6)`.

### 6.6 Surplus Allocation

```text
safe_surplus = max(0, Pool − buffer_months × monthly_commitment)
```

`buffer_months` defaults to 3 and is user-editable. Allocations above `safe_surplus` are allowed after showing the resulting runway. Only the Pool invariant is enforced.

### 6.7 Corrections

| Field type | Examples | How it changes |
|---|---|---|
| Financial | amount, date, kind, account | **Reversal + replacement.** The UI calls this "Edit", and the history shows both. |
| Descriptive | note, source label, asset label, expense category, business cost category | Edited in place (`updated_at` changes) |

- A transaction can be reversed at most once. A reversal cannot be reversed.
- Reversing a transaction that would break the Pool invariant is rejected, except income (§6.5).
- Historical income months are evidence, not ledger records. They are edited in place, and an edit triggers re-evaluation.

---

## 7. Spending Insights

### 7.1 Available Spending

```text
Available Spending = balance(personal)
```

It rolls over between periods. It is not reset monthly: unspent salary stays the user's, and a reset would encourage spending everything.

### 7.2 Daily Allowance

```text
next_payday = next date with day = payday_day strictly after today
days_left   = days from today until next_payday (minimum 1)
daily       = floor(max(Available Spending, 0) / days_left)
```

States:

- Available Spending ≤ 0 → overspent state (DESIGN §4.2), no daily figure.
- Today is payday and the current period's entitlement is unpaid → "Salary due today" state.

### 7.3 Pace

```text
period_start = most recent payday ≤ today
base         = balance(personal) just before period_start + net salary paid in this period
spent        = Σ expenses in [period_start, today]
spent_pct    = spent / base
elapsed_pct  = (days since period_start + 1) / days in period     (today counts as elapsed)
show when base > 0 and spent_pct − elapsed_pct > 0.15
```

> You've used 62% of this period's money, and 40% of the period has passed.

---

## 8. Reflection Highlights

For a completed month `m`. The 3 previous months must all be **full months after the onboarding month** (the onboarding month itself is partial):

```text
for each category c in {needs, wants, growth, unexpected}:
    current = Σ expenses(c, m)
    avg     = mean of Σ expenses(c) over the 3 previous months
    delta   = current − avg
    flag if |delta| > 0.20 × avg and |delta| > 200.000
            (if avg = 0: flag if current > 200.000, phrased as new spending)
highlights = flagged categories sorted by |delta| descending, top 2
```

Requires 3 previous observed months (a month without spending still counts as observed). Before that, there are no highlights.

**Received** (pre-filled in the reflection) is the sum of `salary_payment` amounts dated in the month.

**Intention vs actual:**

```text
set_aside(m) = Σ savings_deposit + Σ investment_contribution
             − Σ savings_withdrawal − Σ investment_withdrawal     (personal-sourced, month m)
```

The reflection compares it to the month's savings intention, and Wants spending to the optional Wants limit. No scores.

---

## 9. Notifications (local only)

| Notification | When | Default |
|---|---|---|
| Payday | Payday at 09:00, if the entitlement is unpaid | On |
| Recurring cost due | Due date at 09:00 | On |
| New month | 1st of month at 19:00: reflect on last month, set this month's intention | On |
| Salary pressure | `SERIOUS` level, at most once per month | On |
| Backup | Last export > 30 days ago, at most once per month | On |
| Raise eligibility | **Never sent as a notification** | — |

Raise eligibility is shown quietly on the Salary screen. The product must not pressure users to raise their salary.

---

## 10. Security & Privacy

- The database is encrypted with SQLCipher. A 256-bit random key is generated on first launch and stored in SecureStore.
- The key is **not** bound to biometrics. Biometric changes must never make data unreadable. The app lock (`expo-local-authentication`) is a separate gate, optional and on by default.
- No account, no server, no analytics, no crash reporting SDKs, no INTERNET permission in release builds.
- Uninstalling the app deletes the data and the key. The user is told this during onboarding and in backup reminders.
- These are local-first protections, not absolute security guarantees (a rooted or compromised device is out of scope).

---

## 11. Backup: Export & Import

**Export**

1. The user enters a backup passphrase (minimum 8 characters, confirmed twice).
2. Serialize all tables to JSON: `{ format: "vanea-backup", version: 1, exported_at, app_version, data: { … } }`.
3. Derive a key with scrypt (random 16-byte salt) and encrypt with XChaCha20-Poly1305 (random nonce).
4. Write the envelope `{ format, version, kdf, salt, nonce, ciphertext }` to a `.vanea` file and open the Android share sheet.
5. Record `last_export_at`.

**Import**

1. Pick a file, enter the passphrase, decrypt, and validate format, version and schema.
2. Show a summary (date range, record counts, current balances).
3. On confirmation, **replace** all current data in one database transaction. Merging is out of scope for v1.
4. Re-run all evaluations.

---

## 12. Testing Strategy

| Level | Scope | Target |
|---|---|---|
| Unit | Every exported function in `src/domain`, one test file per module | ≥ 95% line coverage on `src/domain` |
| Property / invariant | Random transaction sequences (`fast-check`) | All invariants below hold |
| Scenario | Fixed examples and lifecycle scenarios from §5.8 | Same statuses as the reference implementation |
| Parity | TypeScript engine vs `salary_engine_simulation.py` on shared fixture files | Identical outputs |
| UI | Critical flows: onboarding, pay salary, salary review, edit/reverse | React Native Testing Library |

**Invariants**

1. Pool running balance ≥ 0 on every date.
2. Every balance equals the sum of its movements.
3. A gated increase only comes from an `ELIGIBLE` evaluation, and is ≤ `max_new_salary`.
4. A salary set by a gated increase ≤ the sustainable salary at evaluation time.
5. A restore ≤ the restore ceiling.
6. Salary payments in a period ≤ that period's entitlement.
7. Advance outstanding ≥ 0, and at most one advance is active.
8. Historical income months never create movements.
9. A transaction is reversed at most once, and reversals are never reversed.
10. Same inputs → same outputs (no hidden clock or randomness in `src/domain`; "today" is passed in).

---

## 13. Non-functional Targets

| Area | Target |
|---|---|
| Offline | 100% of features work offline. |
| Performance | Dashboard renders in < 1.5 s from cold start on a mid-range Android device with 5 years of data (~20.000 transactions). Domain calculations for the dashboard < 100 ms. |
| Reliability | User-perceived crash rate < 0.5% (Google Play Android vitals, public phase). |
| Data safety | No financial write is partially applied: each user action is one database transaction. |
