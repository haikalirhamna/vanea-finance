/** Renders a screen inside the real AppProvider on a real (in-memory) SQLite database. */
import { render, screen, waitFor } from '@testing-library/react-native';
import { ReactElement } from 'react';
import { SqlDriver } from '@/data/driver';
import { openMemoryDriver } from '@/data/driver-memory';
import { prepareDatabase } from '@/data/database';
import { loadSnapshot } from '@/data/snapshot';
import { ActionContext } from '@/features/action-runtime';
import { BASIC_ONBOARDING } from '@/features/__tests__/helpers';
import { completeOnboarding } from '@/features/onboarding/onboarding-actions';
import { AppProvider } from '@/state/AppState';

export const TODAY = '2026-10-09';

/** Only the date is faked, so promises and timers behave normally. */
export function freezeToday(): void {
  jest.useFakeTimers({ now: new Date(`${TODAY}T10:00:00`), doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'queueMicrotask', 'performance'] });
}

export interface Rendered {
  driver: SqlDriver;
}

export async function renderApp(ui: ReactElement, options: { onboarded?: boolean } = {}): Promise<Rendered> {
  const driver = await prepareDatabase(await openMemoryDriver());
  if (options.onboarded !== false) {
    let counter = 0;
    const ctx: ActionContext = { driver, today: () => TODAY, now: () => `${TODAY}T10:00:00.000Z`, newId: () => `seed-${++counter}` };
    const seeded = await completeOnboarding(ctx, BASIC_ONBOARDING);
    if (!seeded.ok) throw new Error(seeded.error.title);
  }
  render(<AppProvider openDriver={async () => driver}>{ui}</AppProvider>);
  await waitFor(() => expect(screen.toJSON()).not.toBeNull(), { timeout: 15_000 });
  return { driver };
}

export async function transactionsOf(driver: SqlDriver) {
  return (await loadSnapshot(driver)).transactions;
}
