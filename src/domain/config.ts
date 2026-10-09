/**
 * Every tunable constant of the domain (SYSTEM-OVERVIEW §5.1).
 * Re-run docs/simulation/salary_engine_simulation.py after changing salary values.
 */
export const CONFIG = {
  // Salary recommendation
  SAFETY_MARGIN: 0.05,
  ENGINE_WINDOW_MONTHS: 12,
  MIN_RECOMMENDATION_MONTHS: 3,
  RECOMMEND_ROUNDING: 50_000,

  // Raise review
  MAX_RAISE_PERCENT: 5,
  RAISE_ROUNDING: 10_000,
  MIN_SHIFT: 0.05,
  SWING_MULTIPLIER: 1.5,
  RECENT_MONTHS: 3,
  REFERENCE_MAX_MONTHS: 12,
  MIN_DATA_MONTHS: 6,

  // Salary changes
  CALIBRATION_PERIODS: 3,
  RESTORE_LOOKBACK_MONTHS: 12,
  PAYDAY_MIN: 1,
  PAYDAY_MAX: 28,

  // Salary pressure
  PRESSURE_ATTENTION_MONTHS: 6,
  PRESSURE_SERIOUS_MONTHS: 3,

  // Pool
  DEFAULT_BUFFER_MONTHS: 3,

  // Salary advance
  ADVANCE_MIN_TERM: 1,
  ADVANCE_MAX_TERM: 6,
  ADVANCE_REVERSAL_DEFAULT_TERM: 3,

  // Spending insights
  PACE_THRESHOLD: 0.15,

  // Subscriptions
  YEARLY_SPREAD_MONTHS: 12,

  // Debts
  DEBT_RATIO_THRESHOLD: 0.3,

  // Investments
  INVESTMENT_STALE_DAYS: 90,
  CONCENTRATION_SHARE: 0.5,

  // Reflection highlights
  HIGHLIGHT_LOOKBACK_MONTHS: 3,
  HIGHLIGHT_RELATIVE_CHANGE: 0.2,
  HIGHLIGHT_MIN_AMOUNT: 200_000,
  HIGHLIGHT_MAX_ITEMS: 2,
} as const;
