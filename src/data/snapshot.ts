/** Everything the app computes from, loaded once and kept in memory (a few thousand rows at most). */
import { HistoricalMonth } from '@/domain/income-history';
import { Transaction } from '@/domain/ledger-types';
import { DebtRecord, loadDebts } from './debts';
import { SqlDriver } from './driver';
import { loadHistoricalMonths } from './planning';
import { Profile, getProfile } from './profile';
import { HoldingRecord, loadHoldings } from './investments';
import { IntentionRecord, ReflectionRecord, loadIntentions, loadReflections } from './reflections';
import { EvaluationRecord, loadEvaluations } from './salary-evaluations';
import { AdvanceRecord, SalarySettingRecord, loadAdvances, loadSalarySettings } from './salary';
import { SubscriptionRecord, loadSubscriptions } from './subscriptions';
import { loadTransactions } from './transactions';

export interface Snapshot {
  profile: Profile | null;
  transactions: Transaction[];
  historicalMonths: HistoricalMonth[];
  salarySettings: SalarySettingRecord[];
  evaluations: EvaluationRecord[];
  intentions: IntentionRecord[];
  reflections: ReflectionRecord[];
  advances: AdvanceRecord[];
  subscriptions: SubscriptionRecord[];
  debts: DebtRecord[];
  holdings: HoldingRecord[];
}

export async function loadSnapshot(driver: SqlDriver): Promise<Snapshot> {
  return {
    profile: await getProfile(driver),
    transactions: await loadTransactions(driver),
    historicalMonths: await loadHistoricalMonths(driver),
    salarySettings: await loadSalarySettings(driver),
    evaluations: await loadEvaluations(driver),
    intentions: await loadIntentions(driver),
    reflections: await loadReflections(driver),
    advances: await loadAdvances(driver),
    subscriptions: await loadSubscriptions(driver),
    debts: await loadDebts(driver),
    holdings: await loadHoldings(driver),
  };
}
