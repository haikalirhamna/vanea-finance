/** The database schema as forward-only migrations (SCHEMA.md). Each runs in one transaction. */

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

const TRANSACTION_KINDS = [
  'opening_balance', 'bill_reserve_set_aside', 'income', 'business_cost', 'salary_payment', 'expense',
  'debt_cost', 'debt_payment', 'debt_payoff', 'loan_start', 'credit_conversion', 'savings_deposit',
  'savings_withdrawal', 'investment_contribution', 'investment_sale', 'investment_income',
  'investment_cash_withdrawal', 'surplus_allocation', 'advance_disbursement', 'advance_early_repayment', 'reversal',
];

const ACCOUNTS = ['pool', 'personal', 'savings', 'investment', 'investment_cash', 'bill_reserve', 'debt'];

const list = (values: readonly string[]) => values.map((v) => `'${v}'`).join(', ');

const V1 = `
CREATE TABLE profile (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  currency TEXT NOT NULL DEFAULT 'IDR' CHECK (currency = 'IDR'),
  payday_day INTEGER NOT NULL CHECK (payday_day BETWEEN 1 AND 28),
  onboarded_on TEXT NOT NULL,
  calibration_until_period TEXT NOT NULL,
  buffer_months INTEGER NOT NULL DEFAULT 3 CHECK (buffer_months >= 0),
  app_lock_enabled INTEGER NOT NULL DEFAULT 1 CHECK (app_lock_enabled IN (0, 1)),
  notify_payday INTEGER NOT NULL DEFAULT 1 CHECK (notify_payday IN (0, 1)),
  notify_subscriptions INTEGER NOT NULL DEFAULT 1 CHECK (notify_subscriptions IN (0, 1)),
  notify_debts INTEGER NOT NULL DEFAULT 1 CHECK (notify_debts IN (0, 1)),
  notify_month INTEGER NOT NULL DEFAULT 1 CHECK (notify_month IN (0, 1)),
  notify_pressure INTEGER NOT NULL DEFAULT 1 CHECK (notify_pressure IN (0, 1)),
  notify_backup INTEGER NOT NULL DEFAULT 1 CHECK (notify_backup IN (0, 1)),
  last_export_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE historical_income_months (
  id TEXT PRIMARY KEY,
  month TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  next_billing_date TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE subscription_prices (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  price INTEGER NOT NULL CHECK (price > 0),
  effective_from TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (subscription_id, effective_from)
);

CREATE TABLE debts (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('credit_line', 'installment_loan')),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('personal', 'business')),
  credit_limit INTEGER CHECK (credit_limit IS NULL OR credit_limit > 0),
  statement_day INTEGER CHECK (statement_day IS NULL OR statement_day BETWEEN 1 AND 31),
  due_day INTEGER CHECK (due_day IS NULL OR due_day BETWEEN 1 AND 31),
  amount_received INTEGER CHECK (amount_received IS NULL OR amount_received > 0),
  installment_amount INTEGER CHECK (installment_amount IS NULL OR installment_amount > 0),
  installment_count INTEGER CHECK (installment_count IS NULL OR installment_count >= 1),
  frequency TEXT CHECK (frequency IS NULL OR frequency IN ('monthly', 'single')),
  start_date TEXT,
  first_due_date TEXT,
  ojk_registered TEXT CHECK (ojk_registered IS NULL OR ojk_registered IN ('yes', 'no', 'unknown')),
  origin TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual', 'onboarding', 'conversion')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (kind = 'credit_line' OR (amount_received IS NOT NULL AND installment_amount IS NOT NULL
         AND installment_count IS NOT NULL AND frequency IS NOT NULL AND first_due_date IS NOT NULL))
);

CREATE TABLE holdings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  asset_class TEXT NOT NULL CHECK (asset_class IN ('time_deposit', 'government_bond', 'money_market_fund',
    'fixed_income_fund', 'mixed_fund', 'gold', 'equity_fund', 'stock', 'crypto_digital', 'other')),
  risk_override TEXT CHECK (risk_override IS NULL OR risk_override IN ('low', 'low_medium', 'medium', 'high', 'very_high')),
  platform TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE holding_valuations (
  id TEXT PRIMARY KEY,
  holding_id TEXT NOT NULL REFERENCES holdings(id) ON DELETE CASCADE,
  value INTEGER NOT NULL CHECK (value >= 0),
  as_of TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (holding_id, as_of)
);

CREATE TABLE salary_evaluations (
  id TEXT PRIMARY KEY,
  evaluated_month TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('INSUFFICIENT_DATA', 'COOLDOWN', 'OBSERVING', 'SEASONAL_PATTERN', 'NOT_AFFORDABLE', 'ELIGIBLE')),
  current_salary INTEGER NOT NULL,
  data_months INTEGER NOT NULL,
  reference_income INTEGER,
  swing_bp INTEGER,
  threshold_bp INTEGER,
  recent_months_json TEXT,
  last_year_months_json TEXT,
  pool_at_evaluation INTEGER NOT NULL,
  sustainable_salary INTEGER,
  max_new_salary INTEGER,
  decision TEXT NOT NULL DEFAULT 'none' CHECK (decision IN ('none', 'accepted', 'accepted_smaller', 'declined', 'expired')),
  final_salary INTEGER,
  decided_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE salary_settings (
  id TEXT PRIMARY KEY,
  amount INTEGER NOT NULL CHECK (amount > 0),
  effective_period TEXT NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('initial', 'calibration', 'increase', 'decrease', 'restore')),
  evaluation_id TEXT REFERENCES salary_evaluations(id),
  recommended_amount INTEGER,
  note TEXT,
  created_at TEXT NOT NULL,
  CHECK (change_type <> 'increase' OR evaluation_id IS NOT NULL)
);

CREATE TABLE salary_advances (
  id TEXT PRIMARY KEY,
  amount INTEGER NOT NULL CHECK (amount > 0),
  term_periods INTEGER NOT NULL CHECK (term_periods BETWEEN 1 AND 6),
  installment_amount INTEGER NOT NULL CHECK (installment_amount > 0),
  first_period TEXT NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('manual', 'income_reversal')),
  origin_transaction_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'repaid')),
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN (${list(TRANSACTION_KINDS)})),
  date TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (
    amount > 0
    OR (kind = 'reversal' AND amount = 0)
    OR (kind = 'salary_payment' AND amount = 0 AND COALESCE(advance_installment, 0) > 0)
    OR (kind = 'investment_sale' AND amount = 0 AND COALESCE(cost_removed, 0) > 0)
  ),
  account TEXT CHECK (account IS NULL OR account IN (${list(ACCOUNTS)})),
  expense_category TEXT CHECK (expense_category IS NULL OR expense_category IN ('needs', 'wants', 'growth', 'unexpected')),
  business_cost_category TEXT CHECK (business_cost_category IS NULL OR business_cost_category IN ('subscription', 'tools', 'tax', 'other')),
  billing_cycle TEXT CHECK (billing_cycle IS NULL OR billing_cycle IN ('monthly', 'yearly')),
  payment_method TEXT CHECK (payment_method IS NULL OR payment_method IN ('available', 'credit_line', 'installment')),
  source TEXT,
  note TEXT,
  label TEXT,
  salary_period TEXT,
  advance_installment INTEGER CHECK (advance_installment IS NULL OR advance_installment >= 0),
  advance_id TEXT REFERENCES salary_advances(id),
  subscription_id TEXT REFERENCES subscriptions(id) ON DELETE SET NULL,
  debt_id TEXT REFERENCES debts(id),
  target_debt_id TEXT REFERENCES debts(id),
  holding_id TEXT REFERENCES holdings(id),
  source_account TEXT CHECK (source_account IS NULL OR source_account IN ('personal', 'pool')),
  destination_account TEXT CHECK (destination_account IS NULL OR destination_account IN ('personal', 'savings', 'pool')),
  reserve_part INTEGER CHECK (reserve_part IS NULL OR reserve_part >= 0),
  cost_removed INTEGER CHECK (cost_removed IS NULL OR cost_removed >= 0),
  cleared_amount INTEGER CHECK (cleared_amount IS NULL OR cleared_amount >= 0),
  total_owed INTEGER CHECK (total_owed IS NULL OR total_owed >= 0),
  debt_cost_type TEXT CHECK (debt_cost_type IS NULL OR debt_cost_type IN ('interest', 'fee', 'late_fee')),
  reverses_id TEXT UNIQUE REFERENCES transactions(id),
  replaced_by_id TEXT REFERENCES transactions(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (kind <> 'reversal' OR reverses_id IS NOT NULL),
  CHECK (kind <> 'business_cost' OR business_cost_category IS NOT NULL),
  CHECK (business_cost_category IS NOT 'subscription' OR billing_cycle IS NOT NULL),
  CHECK (kind <> 'expense' OR expense_category IS NOT NULL),
  CHECK (kind NOT IN ('investment_sale', 'investment_cash_withdrawal') OR COALESCE(destination_account, '') IN ('personal', 'savings'))
);

CREATE TABLE movements (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions(id),
  account TEXT NOT NULL CHECK (account IN (${list(ACCOUNTS)})),
  ref_id TEXT,
  amount INTEGER NOT NULL CHECK (amount <> 0),
  date TEXT NOT NULL
);

CREATE TABLE monthly_intentions (
  id TEXT PRIMARY KEY,
  month TEXT NOT NULL UNIQUE,
  set_aside_amount INTEGER NOT NULL CHECK (set_aside_amount >= 0),
  wants_limit INTEGER CHECK (wants_limit IS NULL OR wants_limit >= 0),
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE reflections (
  id TEXT PRIMARY KEY,
  month TEXT NOT NULL UNIQUE,
  improve_note TEXT,
  needs_note TEXT,
  wants_note TEXT,
  growth_note TEXT,
  unexpected_note TEXT,
  overall_note TEXT,
  summary_snapshot_json TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_movements_account_date ON movements(account, ref_id, date);
CREATE INDEX idx_movements_transaction ON movements(transaction_id);
CREATE INDEX idx_transactions_kind_date ON transactions(kind, date);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_advance ON transactions(advance_id);
CREATE INDEX idx_transactions_debt ON transactions(debt_id);
CREATE INDEX idx_transactions_holding ON transactions(holding_id);
CREATE INDEX idx_prices_subscription ON subscription_prices(subscription_id, effective_from);
CREATE INDEX idx_valuations_holding ON holding_valuations(holding_id, as_of);
CREATE UNIQUE INDEX idx_one_active_advance ON salary_advances(status) WHERE status = 'active';
`;

export const MIGRATIONS: readonly Migration[] = [{ version: 1, name: 'initial schema', sql: V1 }];

/** Every table a backup includes, parents before children. */
export const TABLES_IN_RESTORE_ORDER = [
  'profile', 'historical_income_months', 'subscriptions', 'subscription_prices', 'debts', 'holdings',
  'holding_valuations', 'salary_evaluations', 'salary_settings', 'salary_advances', 'transactions', 'movements',
  'monthly_intentions', 'reflections',
] as const;

export type TableName = (typeof TABLES_IN_RESTORE_ORDER)[number];

export const CURRENT_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]!.version;
