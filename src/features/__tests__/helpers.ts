import { DateString } from '@/domain/calendar';
import { HistoricalMonth } from '@/domain/income-history';
import { SqlDriver } from '@/data/driver';
import { openMemoryDriver } from '@/data/driver-memory';
import { prepareDatabase } from '@/data/database';
import { Snapshot, loadSnapshot } from '@/data/snapshot';
import { ActionContext } from '../action-runtime';
import { OnboardingInput, completeOnboarding } from '../onboarding/onboarding-actions';

export interface TestApp {
  ctx: ActionContext;
  driver: SqlDriver;
  /** Moves the clock. */
  setToday(date: DateString): void;
  snapshot(): Promise<Snapshot>;
}

export async function testApp(today: DateString = '2026-10-09'): Promise<TestApp> {
  const driver = await prepareDatabase(await openMemoryDriver());
  let current = today;
  let counter = 0;
  const ctx: ActionContext = {
    driver,
    today: () => current,
    now: () => `${current}T08:00:00.000Z`,
    newId: () => `id${++counter}`,
  };
  return { ctx, driver, setToday: (date) => { current = date; }, snapshot: () => loadSnapshot(driver) };
}

/** Twelve completed months before October 2026, Rp 5.000.000 each. */
export const STEADY_HISTORY: HistoricalMonth[] = Array.from({ length: 12 }, (_, i) => ({
  month: `${i < 3 ? 2025 : 2026}-${String(((i + 9) % 12) + 1).padStart(2, '0')}`,
  amount: 5_000_000,
}));

export const BASIC_ONBOARDING: OnboardingInput = {
  paydayDay: 25,
  historical: STEADY_HISTORY,
  openingBalances: { pool: 14_000_000, personal: 4_250_000, savings: 2_000_000 },
  debts: [],
  salary: 4_700_000,
};

/** A set-up app: payday 25, Pool Rp 14.000.000, Available Spending Rp 4.250.000, salary Rp 4.700.000. */
export async function onboardedApp(input: Partial<OnboardingInput> = {}, today?: DateString): Promise<TestApp> {
  const app = await testApp(today);
  const result = await completeOnboarding(app.ctx, { ...BASIC_ONBOARDING, ...input });
  if (!result.ok) throw new Error(`Test setup failed: ${result.error.title}`);
  return app;
}
