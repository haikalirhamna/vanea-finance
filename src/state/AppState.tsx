/** Opens the database once, keeps the snapshot in memory and refreshes it after every action. */
import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DateString } from '@/domain/calendar';
import { SqlDriver } from '@/data/driver';
import { Snapshot, loadSnapshot } from '@/data/snapshot';
import { ActionContext, ActionResult } from '@/features/action-runtime';
import { DashboardSummary, buildDashboard } from '@/features/dashboard/dashboard-summary';
import { ensureMonthlyReview } from '@/features/salary/salary-review-actions';
import { planNotifications } from '@/features/dashboard/notification-plan';
import { newId, openAppDatabase } from '@/platform/database';
import { scheduleReminders } from '@/platform/reminders';

export interface AppState {
  ctx: ActionContext;
  snapshot: Snapshot;
  /** Null until onboarding is done. */
  dashboard: DashboardSummary | null;
  today: DateString;
  /** Runs an action; when it succeeds the snapshot is refreshed. */
  act<T>(action: (ctx: ActionContext) => Promise<ActionResult<T>>): Promise<ActionResult<T>>;
  reload(): Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const state = useContext(AppContext);
  if (!state) throw new Error('useApp must be used inside AppProvider');
  return state;
}

function localDate(date = new Date()): DateString {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function contextFor(driver: SqlDriver): ActionContext {
  return { driver, today: () => localDate(), now: () => new Date().toISOString(), newId };
}

interface Props {
  children: ReactNode;
  /** Tests and previews pass their own database. */
  openDriver?: () => Promise<SqlDriver>;
  /** Rendered while the database opens. */
  loading?: ReactNode;
}

export function AppProvider({ children, openDriver = openAppDatabase, loading = null }: Props) {
  const [ctx, setCtx] = useState<ActionContext | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [failed, setFailed] = useState<Error | null>(null);
  const ctxRef = useRef<ActionContext | null>(null);

  const reload = useCallback(async () => {
    if (!ctxRef.current) return;
    const next = await loadSnapshot(ctxRef.current.driver);
    setSnapshot(next);
    void scheduleReminders(planNotifications(next, ctxRef.current.today())).catch(() => undefined);
  }, []);

  useEffect(() => {
    openDriver()
      .then(async (driver) => {
        ctxRef.current = contextFor(driver);
        await ensureMonthlyReview(ctxRef.current);
        setCtx(ctxRef.current);
        setSnapshot(await loadSnapshot(driver));
      })
      .catch((error: unknown) => setFailed(error instanceof Error ? error : new Error(String(error))));
  }, [openDriver]);

  const value = useMemo<AppState | null>(() => {
    if (!ctx || !snapshot) return null;
    const today = ctx.today();
    const act: AppState['act'] = async (action) => {
      const result = await action(ctx);
      if (result.ok) await reload();
      return result;
    };
    return { ctx, snapshot, today, dashboard: snapshot.profile ? buildDashboard(snapshot, today) : null, act, reload };
  }, [ctx, snapshot, reload]);

  if (failed) throw failed;
  if (!value) return <>{loading}</>;
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
