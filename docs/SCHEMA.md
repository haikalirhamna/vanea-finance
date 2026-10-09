# Vanea — Data Schema

**Version:** 2.1
**Status:** Draft for review
**Last updated:** 2026-10-09

Storage: encrypted SQLite (`expo-sqlite` + SQLCipher). One user per device. Rules for how records move money are in SYSTEM-OVERVIEW §6; this document defines what is stored.

Items marked **(M0.1)** belong to subscriptions, debts and investments: specified, not implemented yet.

---

## 1. Conventions

| Topic | Rule |
|---|---|
| Table names | Plural `snake_case` |
| IDs | `TEXT` primary keys (UUID v4 or ULID) |
| Money | `INTEGER` rupiah, never floating point. Transaction amounts are positive (exceptions in §3.3); direction comes from movements. |
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
subscriptions ──< subscription_prices                 (M0.1)
debts                                                 (M0.1) credit lines and installment loans
holdings ──< holding_valuations                       (M0.1) valuations never move money
subscriptions, debts, holdings, salary_advances, salary_settings ──< transactions (by reference)
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
| notify_payday / notify_subscriptions / notify_debts / notify_month / notify_pressure / notify_backup | INTEGER | 0/1, default 1 |
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
| amount | INTEGER | > 0. Exceptions: `reversal` ≥ 0 (an income reversal when the Pool is empty), `salary_payment` ≥ 0 when `advance_installment` > 0 (a fully withheld period), and `investment_sale` ≥ 0 when `cost_removed` > 0 (a sale at a total loss) |
| account | TEXT NULL | `opening_balance`: `pool`/`personal`/`savings`/`investment`/`debt`. `surplus_allocation`: `savings`/`investment`. |
| expense_category | TEXT NULL | `expense`: `needs`/`wants`/`growth`/`unexpected` (editable) |
| business_cost_category | TEXT NULL | `business_cost`: `subscription`/`tools`/`tax`/`other` (editable) |
| source | TEXT NULL | `income`: who paid (editable) |
| asset | — | Removed in M0.1: investments are identified by `holding_id` |
| note | TEXT NULL | Editable |
| salary_period | TEXT NULL | `salary_payment`: `YYYY-MM` |
| advance_installment | INTEGER NULL | `salary_payment`: amount withheld for an advance in this payment (≥ 0) |
| advance_id | TEXT NULL FK → salary_advances | `salary_payment` with installment, `advance_disbursement`, `advance_early_repayment` |
| subscription_id | TEXT NULL FK → subscriptions `ON DELETE SET NULL` | `business_cost` of a subscription (M0.1) |
| label | TEXT NULL | Name snapshot (subscription, lender, holding) so history survives deletion (M0.1) |
| billing_cycle | TEXT NULL | `monthly` / `yearly`. **Required** when `business_cost_category = 'subscription'` (M0.1) |
| payment_method | TEXT NULL | `expense`: `available` (default) / `credit_line` / `installment`. `debt_cost`, `debt_payment`, `debt_payoff`: the kind of debt touched, `credit_line` or `installment` (M0.1) |
| debt_id | TEXT NULL FK → debts | Credit-line expenses, `debt_cost`, `debt_payment`, `debt_payoff`, `loan_start`, `credit_conversion` (source line), `bill_reserve_set_aside`, `opening_balance` on a debt (M0.1) |
| target_debt_id | TEXT NULL FK → debts | `credit_conversion`: the new installment loan (M0.1) |
| holding_id | TEXT NULL FK → holdings | `investment_*`, `surplus_allocation` to an investment, `opening_balance` on a holding (M0.1) |
| source_account | TEXT NULL | `debt_payment`, `debt_payoff`: `personal` / `pool` (M0.1) |
| destination_account | TEXT NULL | `investment_sale`, `investment_cash_withdrawal`: `personal` / `savings` — no default (M0.1) |
| reserve_part | INTEGER NULL | Credit-line `debt_payment` and `credit_conversion`: the part taken from the bill reserve (M0.1) |
| cost_removed | INTEGER NULL | `investment_sale`: put in removed (M0.1) |
| cleared_amount | INTEGER NULL | `debt_payoff`: owed amount cleared (M0.1) |
| debt_cost_type | TEXT NULL | `debt_cost`: `interest` / `fee` / `late_fee` (M0.1) |
| total_owed | INTEGER NULL | `loan_start`: installment × count; `credit_conversion`: the new loan's total (M0.1) |
| reverses_id | TEXT NULL UNIQUE FK → transactions | `reversal` only. `UNIQUE`: a transaction is reversed at most once. |
| replaced_by_id | TEXT NULL FK → transactions | Set on a reversed original when an "Edit" created a replacement |
| created_at, updated_at | TEXT | |

### 3.4 `movements`

Signed effects of a transaction on accounts. Written together with their transaction, never edited.

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| transaction_id | TEXT FK → transactions | |
| account | TEXT | `pool` / `personal` / `savings` / `investment` / `investment_cash` / `bill_reserve` / `debt` |
| ref_id | TEXT NULL | Holding id (`investment`, `investment_cash`), credit line id (`bill_reserve`) or debt id (`debt`); NULL for the others (M0.1) |
| amount | INTEGER | Signed, non-zero |
| date | TEXT | Copied from the transaction, for balance-by-date queries |

### 3.5 `subscriptions` (M0.1; replaces `recurring_costs`)

Added, edited and deleted freely. Deleting removes the row; costs already recorded keep their `label`, and shares of a paid yearly charge keep counting.

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| name | TEXT | e.g. "Figma" |
| billing_cycle | TEXT | `monthly` / `yearly` — required, no default |
| next_billing_date | TEXT | Advanced by one cycle when a billing is recorded or skipped |
| note | TEXT NULL | |
| created_at, updated_at | TEXT | |

The price lives in `subscription_prices` (§3.11).

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

### 3.11 `subscription_prices` (M0.1)

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| subscription_id | TEXT FK → subscriptions `ON DELETE CASCADE` | |
| price | INTEGER | > 0 |
| effective_from | TEXT | Date; may be in the future (an announced change). `UNIQUE(subscription_id, effective_from)` |
| created_at | TEXT | |

### 3.12 `debts` (M0.1)

Credit lines and installment loans in one table.

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| kind | TEXT | `credit_line` / `installment_loan` |
| name | TEXT | Lender or card name |
| type | TEXT | credit line: `credit_card` / `paylater`; loan: `online_loan` / `bank_loan` / `installment_purchase` / `paylater_installments` / `card_installment_plan` / `personal` / `other` |
| purpose | TEXT | `personal` / `business` (credit lines are always `personal`) |
| credit_limit | INTEGER NULL | Credit line, optional |
| statement_day, due_day | INTEGER NULL | Credit line, 1–31 (clamped to month end) |
| amount_received | INTEGER NULL | Loan |
| installment_amount | INTEGER NULL | Loan |
| installment_count | INTEGER NULL | Loan, ≥ 1 |
| frequency | TEXT NULL | Loan: `monthly` / `single` |
| first_due_date | TEXT NULL | Loan |
| ojk_registered | TEXT NULL | Online loan: `yes` / `no` / `unknown` |
| origin | TEXT | `manual` / `onboarding` / `conversion` |
| status | TEXT | `open` / `closed` (closed when owed reaches 0, or by the user for a credit line with nothing owed) |
| note | TEXT NULL | |
| created_at, updated_at | TEXT | |

Owed, bill reserve, installments paid and next due date are derived (§5).

### 3.13 `holdings` (M0.1)

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| name | TEXT | e.g. "BBCA", "BTC", a fund name |
| asset_class | TEXT | `time_deposit` / `government_bond` / `money_market_fund` / `fixed_income_fund` / `mixed_fund` / `gold` / `equity_fund` / `stock` / `crypto_digital` / `other` |
| risk_override | TEXT NULL | Only for `other`: `low` / `low_medium` / `medium` / `high` / `very_high` |
| platform | TEXT NULL | e.g. Bibit, Ajaib, Indodax, Pluang |
| status | TEXT | `open` / `closed` |
| note | TEXT NULL | |
| created_at, updated_at | TEXT | |

### 3.14 `holding_valuations` (M0.1)

The user's estimate of a holding's value. **Never creates movements.**

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| holding_id | TEXT FK → holdings `ON DELETE CASCADE` | |
| value | INTEGER | ≥ 0 |
| as_of | TEXT | Date. `UNIQUE(holding_id, as_of)` |
| created_at | TEXT | |

---

## 4. Transaction Kinds

Movements per kind: SYSTEM-OVERVIEW §6.2. Required columns:

| Kind | Required columns |
|---|---|
| `opening_balance` | `account` (+ `debt_id` or `holding_id` for scoped accounts) |
| `bill_reserve_set_aside` | `debt_id` (M0.1) |
| `income` | `source` optional |
| `business_cost` | `business_cost_category`; `billing_cycle` when the category is `subscription` |
| `salary_payment` | `salary_period`, `advance_installment` |
| `expense` | `expense_category`; `payment_method`; `debt_id` unless paid from Available Spending |
| `debt_cost` | `debt_id`, `debt_cost_type`, `payment_method` (M0.1) |
| `debt_payment` | `debt_id`, `payment_method`, `source_account`; `reserve_part` for credit lines (0 for loans) (M0.1) |
| `debt_payoff` | `debt_id`, `payment_method`, `source_account`, `cleared_amount` (M0.1) |
| `loan_start` | `debt_id`, `total_owed` (≥ amount); `destination_account` `personal` or `pool`, none for an installment purchase (M0.1) |
| `credit_conversion` | `debt_id`, `target_debt_id` (a different debt), `reserve_part` ≤ amount, `total_owed` (M0.1) |
| `savings_deposit`, `savings_withdrawal` | — |
| `investment_contribution` | `holding_id` |
| `investment_sale` | `holding_id`, `cost_removed`, `destination_account` (M0.1) |
| `investment_income` | `holding_id` (M0.1) |
| `investment_cash_withdrawal` | `holding_id`, `destination_account` (M0.1) |
| `surplus_allocation` | `account`; `holding_id` when the account is `investment` |
| `advance_disbursement`, `advance_early_repayment` | `advance_id` |
| `reversal` | `reverses_id` |

`investment_withdrawal` (v2.0) is replaced by `investment_sale` in M0.1; a migration converts existing rows with `cost_removed = amount`.

---

## 5. Derived Values

Never stored as the source of truth.

```text
balance(account[, ref]) = Σ movements.amount WHERE account = ? [AND ref_id = ?]
Pool                    = balance('pool')
own_pool                = max(0, Pool − business principal still owed)               (M0.1)
Available Spending      = balance('personal')
net_income(month)       = historical(month) + Σ income − Σ business cost shares − Σ business-loan interest parts
                          (non-reversed; yearly subscription charges spread over 12 months)
entitlement(period)     = salary(period) − installment(period)
advance outstanding     = amount − Σ salary_payment.advance_installment − Σ advance_early_repayment.amount
                          (non-reversed, same advance_id)
restore_ceiling         = max salary_settings.amount effective in the last 12 months
monthly_commitment      = salary + Σ subscriptions' monthly equivalent at today's price
                          + Σ business-loan installments per month
runway_months           = own_pool / monthly_commitment
price_at(sub, date)     = latest subscription_prices.price with effective_from ≤ date   (M0.1)
owed(debt)              = balance('debt', debt.id)                                     (M0.1)
bill_reserve(line)      = balance('bill_reserve', line.id)                             (M0.1)
put_in(holding)         = balance('investment', holding.id)                            (M0.1)
estimated_value(holding)= latest holding_valuations row                                (M0.1)
```

All salary-engine formulas: SYSTEM-OVERVIEW §5. Subscriptions, debts and investments: SYSTEM-OVERVIEW sections 6.8 to 6.11.

---

## 6. Data Integrity

| # | Rule | Enforced in |
|---|---|---|
| 1 | Pool running balance ≥ 0 on every date | Domain validation before write |
| 2 | Savings, every holding's put in and cash, every bill reserve and every debt's owed amount ≥ 0 on every date | Domain validation |
| 3 | `transactions.amount > 0` (exceptions: reversal ≥ 0; salary_payment ≥ 0 with an installment; investment_sale ≥ 0 with a cost removed); `movements.amount ≠ 0` | `CHECK` |
| 4 | Kind-specific required columns present | Domain validation + `CHECK` where practical |
| 5 | A transaction is reversed at most once; reversals are never reversed | `UNIQUE(reverses_id)` + domain |
| 6 | Salary payments per period ≤ entitlement | Domain |
| 7 | `increase` settings reference an `ELIGIBLE` evaluation and are ≤ its `max_new_salary` | Domain |
| 8 | `restore` ≤ restore ceiling | Domain |
| 9 | At most one `active` salary advance | Domain + partial unique index |
| 10 | Historical income months never create movements | Domain (separate table) |
| 11 | Financial fields are never updated in place | Repository layer exposes no update for them |
| 12 | Each user action is written in a single database transaction | Repository layer |
| 13 | A subscription business cost has a `billing_cycle` | `CHECK` + domain (M0.1) |
| 14 | Valuations never create movements; nothing that computes cash, Pool, runway or salary reads them | Domain (separate table) (M0.1) |
| 15 | `investment_sale` and `investment_cash_withdrawal` always have an explicit `destination_account` | `CHECK` (M0.1) |

---

## 7. Indexes

```sql
CREATE INDEX idx_movements_account_date ON movements(account, ref_id, date);
CREATE INDEX idx_movements_transaction  ON movements(transaction_id);
CREATE INDEX idx_transactions_kind_date ON transactions(kind, date);
CREATE INDEX idx_transactions_date      ON transactions(date);
CREATE INDEX idx_transactions_advance   ON transactions(advance_id);
CREATE UNIQUE INDEX idx_one_active_advance ON salary_advances(status) WHERE status = 'active';
CREATE INDEX idx_transactions_debt     ON transactions(debt_id);
CREATE INDEX idx_transactions_holding  ON transactions(holding_id);
CREATE INDEX idx_prices_subscription   ON subscription_prices(subscription_id, effective_from);
CREATE INDEX idx_valuations_holding    ON holding_valuations(holding_id, as_of);
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
    "subscriptions": [ … ],
    "subscription_prices": [ … ],
    "debts": [ … ],
    "holdings": [ … ],
    "holding_valuations": [ … ],
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
- Every balance and every salary-engine output can be recomputed from `transactions`, `movements`, `historical_income_months`, `salary_settings`, `subscription_prices` and `debts`.
- Salary evaluations and reflections keep snapshots of what the user saw.
