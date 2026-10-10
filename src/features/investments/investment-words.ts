/** The words for asset classes and their general risk (a label for the class, never advice about a holding). */
import { AssetClass, RiskLevel } from '@/domain/investments';

export const CLASS_WORDS: Record<AssetClass, string> = {
  time_deposit: 'Time deposit', government_bond: 'Government bond', money_market_fund: 'Money market fund', fixed_income_fund: 'Fixed income fund',
  mixed_fund: 'Mixed fund', gold: 'Gold', equity_fund: 'Equity fund', stock: 'Stocks', crypto_digital: 'Crypto & digital assets', other: 'Other',
};

export const RISK_WORDS: Record<RiskLevel, string> = {
  low: 'Low risk', low_medium: 'Low to medium risk', medium: 'Medium risk', high: 'High risk', very_high: 'Very high risk',
};

export const CLASS_OPTIONS = (Object.keys(CLASS_WORDS) as AssetClass[]).map((value) => ({ value, label: CLASS_WORDS[value] }));
