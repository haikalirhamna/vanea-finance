# Vanea — Data Schema

**Version:** 2.0
**Status:** Draft for review
**Last updated:** 2026-10-09

Storage: encrypted SQLite (`expo-sqlite` + SQLCipher). One user per device. Rules for how records move money are in SYSTEM-OVERVIEW §6; this document defines what is stored.

---

## 1. Conventions

| Topic | Rule |
|---|---|
| Table names | Plural `snake_case` |
| IDs | `TEXT` primary keys (UUID v4 or ULID) |
| Money | `INTEGER` rupiah, never floating point. Transaction amounts are always `> 0`; direction comes from movements. |
| Dates | `TEXT` `YYYY-MM-DD` (local date) |
| Months / periods | `TEXT` `YYYY-MM` |
| Timestamps | `TEXT` ISO 8601 UTC (`created_at`, `updated_at`) |
| Enums | `TEXT` with a `CHECK` constraint |
| Ratios in snapshots | `INTEGER` basis points (1% = 100) |
| Foreign keys | `PRAGMA foreign_keys = ON` |
| Migrations | Versioned, forward-only, run in a transaction at startup |

---

## 2. Entity Overview

```text
profile (1 row)
historical_income_months        evidence only — never moves money
transactions ──< movements      the ledger: immutable financial events
recurring_costs ─┐
salary_advances ─┼──< transactions (by reference)
salary_settings ─┘
salary_evaluations              monthly review snapshots
monthly_intentions
reflections
```

---

## 3. Tables

### 3.1 `profile`

Single row.

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| display_name | TEXT NULL | Optional |
| currency | TEXT | `'IDR'` only in v1 |
| payday_day | INTEGER | 1–28 |
| onboarded_on | TEXT | Date; earliest allowed date for financial records |
| calibration_until_period | TEXT | `YYYY-MM`, last period of calibration |
| buffer_months | INTEGER | Default 3 |
| app_lock_enabled | INTEGER | 0/1, default 1 |
| notify_payday / notify_recurring / notify_month / notify_pressure / notify_backup | INTEGER | 0/1, default 1 |
| last_export_at | TEXT NULL | Timestamp |
| created_at, updated_at | TEXT | |

### 3.2 `historical_income_months`

Net income (after business costs) before Vanea was used. **Never creates movements and never affects the Pool.**

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| month | TEXT UNIQUE | `YYYY-MM`. Months before the onboarding month, or the onboarding month itself (the part before the onboarding date). |
| amount | INTEGER | ≥ 0 |
| note | TEXT NULL | |
| created_at, updated_at | TEXT | Editable in place; edits trigger re-evaluation |

Onboarding collects a contiguous range of months ending at the last completed month. Months inside the range are explicit, including 0.

### 3.3 `transactions`

Every financial event. Immutable except for descriptive fields (SYSTEM-OVERVIEW §6.7).

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| kind | TEXT | See §4 |
| date | TEXT | Economic date, ≥ `profile.onboarded_on`, ≤ today |
| amount | INTEGER | > 0. Exceptions: `reversal` ≥ 0 (an income reversal when the Pool is empty), and `salary_payment` ≥ 0 when `advance_installment` > 0 (a fully withheld period) |
| account | TEXT NULL | `opening_balance`: `pool`/`personal`/`savings`/`investment`. `surplus_allocation`: `savings`/`investment`. |
| expense_category | TEXT NULL | `expense`: `needs`/`wants`/`growth`/`unexpected` (editable) |
| business_cost_category | TEXT NULL | `business_cost`: `subscription`/`tools`/`tax`/`other` (editable) |
| source | TEXT NULL | `income`: who paid (editable) |
| asset | TEXT NULL | Investment label (editable) |
| note | TEXT NULL | Editable |
| salary_period | TEXT NULL | `salary_payment`: `YYYY-MM` |
| advance_installment | INTEGER NULL | `salary_payment`: amount withheld for an advance in this payment (≥ 0) |
| advance_id | TEXT NULL FK → salary_advances | `salary_payment` with installment, `advance_disbursement`, `advance_early_repayment` |
| recurring_cost_id | TEXT NULL FK → recurring_costs | `business_cost` created from a subscription reminder |
| reverses_id | TEXT NULL UNIQUE FK → transactions | `reversal` only. `UNIQUE`: a transaction is reversed at most once. |
| replaced_by_id | TEXT NULL FK → transactions | Set on a reversed original when an "Edit" created a replacement |
| created_at, updated_at | TEXT | |

### 3.4 `movements`

Signed effects of a transaction on accounts. Written together with their transaction, never edited.

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| transaction_id | TEXT FK → transactions | |
| account | TEXT | `pool` / `personal` / `savings` / `investment` |
| amount | INTEGER | Signed, non-zero |
| date | TEXT | Copied from the transaction, for balance-by-date queries |

### 3.5 `recurring_costs`

Subscriptions and other recurring business costs.

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| name | TEXT | e.g. "Figma" |
| amount | INTEGER | > 0 |
| cadence | TEXT | `monthly` / `yearly` |
| next_due_date | TEXT | Advanced by one cadence when the cost is recorded or skipped |
| category | TEXT | Default `subscription` |
| active | INTEGER | 0/1 |
| note | TEXT NULL | |
| created_at, updated_at | TEXT | |

### 3.6 `salary_settings`

Salary history. Append-only; the current salary is the latest row whose `effective_period` ≤ the first unpaid period.

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| amount | INTEGER | > 0 |
| effective_period | TEXT | `YYYY-MM` — first period it applies to |
| change_type | TEXT | `initial` / `calibration` / `increase` / `decrease` / `restore` |
| evaluation_id | TEXT NULL FK → salary_evaluations | Required for `increase` |
| recommended_amount | INTEGER NULL | The recommendation shown at the time (for `initial`, `calibration`) |
| note | TEXT NULL | |
| created_at | TEXT | |

### 3.7 `salary_advances`

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| amount | INTEGER | > 0 |
| term_periods | INTEGER | 1–6 |
| installment_amount | INTEGER | `ceil(amount / term)`; recalculated when a reversal remainder is added |
| first_period | TEXT | `YYYY-MM` of the first withheld installment |
| origin | TEXT | `manual` / `income_reversal` |
| origin_transaction_id | TEXT NULL FK → transactions | The reversal that created or increased it |
| status | TEXT | `active` / `repaid` |
| note | TEXT NULL | |
| created_at, updated_at | TEXT | |

Outstanding is derived, not stored (§5).

### 3.8 `monthly_intentions`

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| month | TEXT UNIQUE | `YYYY-MM` |
| set_aside_amount | INTEGER | ≥ 0 |
| wants_limit | INTEGER NULL | |
| note | TEXT NULL | |
| created_at, updated_at | TEXT | |

### 3.9 `salary_evaluations`

One snapshot per evaluated month (SYSTEM-OVERVIEW §5.4). Re-evaluating the same month after a correction replaces an undecided snapshot; a decided snapshot is kept and a new one is added.

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| evaluated_month | TEXT | Last completed month at evaluation |
| status | TEXT | `INSUFFICIENT_DATA` / `COOLDOWN` / `OBSERVING` / `SEASONAL_PATTERN` / `NOT_AFFORDABLE` / `ELIGIBLE` |
| current_salary | INTEGER | |
| data_months | INTEGER | Months in the engine series |
| reference_income | INTEGER NULL | Median of the reference window |
| swing_bp | INTEGER NULL | Usual swing, basis points |
| threshold_bp | INTEGER NULL | Applied threshold, basis points |
| recent_months_json | TEXT NULL | `[{"month":"2026-07","amount":6000000}, …]` |
| last_year_months_json | TEXT NULL | Same shape, if gate 4 applied |
| pool_at_evaluation | INTEGER | |
| sustainable_salary | INTEGER NULL | |
| max_new_salary | INTEGER NULL | `ELIGIBLE` only |
| decision | TEXT | `none` / `accepted` / `accepted_smaller` / `declined` / `expired` |
| final_salary | INTEGER NULL | |
| decided_at | TEXT NULL | |
| created_at | TEXT | |

### 3.10 `reflections`

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| month | TEXT UNIQUE | `YYYY-MM` |
| improve_note | TEXT NULL | "How can I improve?" |
| needs_note, wants_note, growth_note, unexpected_note | TEXT NULL | |
| overall_note | TEXT NULL | |
| summary_snapshot_json | TEXT | Received, intended, spent per category, set aside and highlights — as shown at completion |
| completed_at | TEXT NULL | |
| created_at, updated_at | TEXT | |

---

## 4. Transaction Kinds

| Kind | Required columns | Movements |
|---|---|---|
| `opening_balance` | `account` | `+amount` on `account` |
| `income` | `source` optional | pool `+` |
| `business_cost` | `business_cost_category` | pool `−` |
| `salary_payment` | `salary_period`, `advance_installment` | pool `−`, personal `+` |
| `expense` | `expense_category` | personal `−` |
| `savings_deposit` | — | personal `−`, savings `+` |
| `savings_withdrawal` | — | savings `−`, personal `+` |
| `investment_contribution` | `asset` optional | personal `−`, investment `+` |
| `investment_withdrawal` | `asset` optional | investment `−`, personal `+` |
| `surplus_allocation` | `account` | pool `−`, savings or investment `+` |
| `advance_disbursement` | `advance_id` | pool `−`, personal `+` |
| `advance_early_repayment` | `advance_id` | personal `−`, pool `+` |
| `reversal` | `reverses_id` | Negated movements of the original (income exception: SYSTEM-OVERVIEW §6.5) |

---

## 5. Derived Values

Never stored as the source of truth.

```text
balance(account)        = Σ movements.amount WHERE account = ?
Pool                    = balance('pool')
Available Spending      = balance('personal')
net_income(month)       = historical(month) + Σ income − Σ business_cost        (non-reversed, dated in month)
entitlement(period)     = salary(period) − installment(period)
advance outstanding     = amount − Σ salary_payment.advance_installment − Σ advance_early_repayment.amount
                          (non-reversed, same advance_id)
restore_ceiling         = max salary_settings.amount effective in the last 12 months
monthly_commitment      = salary + Σ active recurring_costs (monthly, or yearly / 12)
runway_months           = Pool / monthly_commitment
```

All salary-engine formulas: SYSTEM-OVERVIEW §5.

---

## 6. Data Integrity

| # | Rule | Enforced in |
|---|---|---|
| 1 | Pool running balance ≥ 0 on every date | Domain validation before write |
| 2 | Savings and investment balances ≥ 0 | Domain validation |
| 3 | `transactions.amount > 0` (exceptions: reversal ≥ 0; salary_payment ≥ 0 with an installment); `movements.amount ≠ 0` | `CHECK` |
| 4 | Kind-specific required columns present | Domain validation + `CHECK` where practical |
| 5 | A transaction is reversed at most once; reversals are never reversed | `UNIQUE(reverses_id)` + domain |
| 6 | Salary payments per period ≤ entitlement | Domain |
| 7 | `increase` settings reference an `ELIGIBLE` evaluation and are ≤ its `max_new_salary` | Domain |
| 8 | `restore` ≤ restore ceiling | Domain |
| 9 | At most one `active` salary advance | Domain + partial unique index |
| 10 | Historical income months never create movements | Domain (separate table) |
| 11 | Financial fields are never updated in place | Repository layer exposes no update for them |
| 12 | Each user action is written in a single database transaction | Repository layer |

---

## 7. Indexes

```sql
CREATE INDEX idx_movements_account_date ON movements(account, date);
CREATE INDEX idx_movements_transaction  ON movements(transaction_id);
CREATE INDEX idx_transactions_kind_date ON transactions(kind, date);
CREATE INDEX idx_transactions_date      ON transactions(date);
CREATE INDEX idx_transactions_advance   ON transactions(advance_id);
CREATE UNIQUE INDEX idx_one_active_advance ON salary_advances(status) WHERE status = 'active';
```

---

## 8. Backup Format

Plaintext payload (before encryption, SYSTEM-OVERVIEW §11):

```json
{
  "format": "vanea-backup",
  "version": 1,
  "schema_version": 1,
  "exported_at": "2026-10-09T12:00:00Z",
  "app_version": "1.0.0",
  "data": {
    "profile": [ … ],
    "historical_income_months": [ … ],
    "transactions": [ … ],
    "movements": [ … ],
    "recurring_costs": [ … ],
    "salary_settings": [ … ],
    "salary_advances": [ … ],
    "salary_evaluations": [ … ],
    "monthly_intentions": [ … ],
    "reflections": [ … ]
  }
}
```

Import validates `format`, `version` and `schema_version`, runs migrations for older schema versions, verifies every balance from movements, and replaces all data in one transaction.

---

## 9. Auditability

- Financial records keep stable IDs and timestamps.
- Corrections leave both the original and the reversal visible.
- Every balance and every salary-engine output can be recomputed from `transactions`, `movements`, `historical_income_months` and `salary_settings`.
- Salary evaluations and reflections keep snapshots of what the user saw.
