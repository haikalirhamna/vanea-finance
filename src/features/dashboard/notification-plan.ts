/**
 * The local reminders Vanea schedules (SYSTEM-OVERVIEW §9): what to say and when. Pure: lib/notifications.ts
 * hands the plan to the phone. Raise eligibility is never a notification.
 */
import { DateString, addMonths, daysBetween, dateInMonth, dayOfMonth, monthOf, nextPayday, paydayOf } from '@/domain/calendar';
import { dueList } from '@/domain/debts';
import { salaryFor } from '@/domain/salary-change';
import { Snapshot } from '@/data/snapshot';
import { formatMoney, formatMonthName } from '@/lib/format';
import { priceAt } from '@/domain/subscriptions';
import { billReserveOf } from '@/domain/credit-lines';
import { buildDashboard, debtBookOf } from './dashboard-summary';

export interface PlannedNotification {
  id: string;
  /** Local date and time, `YYYY-MM-DDTHH:MM`. */
  at: string;
  title: string;
  body: string;
}

const REMINDER_TIME = '09:00';
const PAYDAYS_AHEAD = 2;

function atNine(date: DateString): string {
  return `${date}T${REMINDER_TIME}`;
}

function paydayReminders(snapshot: Snapshot, today: DateString): PlannedNotification[] {
  const { profile, salarySettings } = snapshot;
  if (!profile?.notify.payday) return [];
  const reminders: PlannedNotification[] = [];
  let date = nextPayday(today, profile.paydayDay);
  for (let count = 0; count < PAYDAYS_AHEAD; count++) {
    const salary = salaryFor(salarySettings, monthOf(date));
    if (salary !== null) {
      reminders.push({
        id: `payday:${date}`, at: atNine(date), title: 'Payday',
        body: `Payday. Pay yourself ${formatMoney(salary)} when you're ready.`,
      });
    }
    date = paydayOf(addMonths(monthOf(date), 1), profile.paydayDay);
  }
  return reminders;
}

function debtReminders(snapshot: Snapshot, today: DateString): PlannedNotification[] {
  if (!snapshot.profile?.notify.debts) return [];
  const book = debtBookOf(snapshot);
  const names = new Map(snapshot.debts.map((d) => [d.id, d.name]));
  return dueList(book, today)
    .filter((due) => due.date >= today)
    .map((due) => {
      const name = names.get(due.debtId) ?? 'A debt';
      const reserved = due.kind === 'credit_line' ? Math.min(due.amount, billReserveOf(snapshot.transactions, due.debtId)) : 0;
      const body = due.kind === 'credit_line'
        ? `Your ${name} bill is due today: ${formatMoney(due.amount)}.${reserved > 0 ? ` ${formatMoney(reserved)} is already set aside.` : ''}`
        : `Your ${name} installment of ${formatMoney(due.amount)} is due today.`;
      return { id: `debt:${due.debtId}:${due.date}`, at: atNine(due.date), title: due.kind === 'credit_line' ? 'Bill due' : 'Installment due', body };
    });
}

function subscriptionReminders(snapshot: Snapshot, today: DateString): PlannedNotification[] {
  if (!snapshot.profile?.notify.subscriptions) return [];
  return snapshot.subscriptions
    .filter((s) => s.nextBillingDate >= today)
    .flatMap((s) => {
      const price = priceAt(s.prices, s.nextBillingDate);
      if (price === null) return [];
      return [{ id: `subscription:${s.id}:${s.nextBillingDate}`, at: atNine(s.nextBillingDate), title: 'Subscription renews', body: `${s.name} renews today: ${formatMoney(price)}.` }];
    });
}

/** The first of next month: a prompt to reflect and set an intention (PRD NOT-4). Never a badge or a score. */
function monthReminders(snapshot: Snapshot, today: DateString): PlannedNotification[] {
  if (!snapshot.profile?.notify.month) return [];
  const next = addMonths(monthOf(today), 1);
  return [{
    id: `month:${next}`, at: atNine(dateInMonth(next, 1)), title: 'A new month',
    body: `Look back on ${formatMonthName(monthOf(today))} and say what you want to set aside this month.`,
  }];
}

const BACKUP_STALE_DAYS = 30;
const BACKUP_DAY = 5;

/** A gentle backup reminder, once a month, only when the last backup is old or missing. */
function backupReminders(snapshot: Snapshot, today: DateString): PlannedNotification[] {
  const { profile } = snapshot;
  if (!profile?.notify.backup) return [];
  const days = profile.lastExportAt ? daysBetween(profile.lastExportAt.slice(0, 10), today) : null;
  if (days !== null && days <= BACKUP_STALE_DAYS) return [];
  const month = dayOfMonth(today) <= BACKUP_DAY ? monthOf(today) : addMonths(monthOf(today), 1);
  return [{
    id: `backup:${month}`, at: atNine(dateInMonth(month, BACKUP_DAY)), title: 'Back up your data',
    body: 'Your data lives only on this phone. Make an encrypted backup so you never lose it.',
  }];
}

const PRESSURE_DAY = 15;

/**
 * A serious salary-pressure level earns at most one notification a month (PRD SAL-8): on the 15th, which keeps the
 * plan deterministic, so re-planning on every app open never sends it twice.
 */
function pressureReminders(snapshot: Snapshot, today: DateString): PlannedNotification[] {
  const { profile } = snapshot;
  if (!profile?.notify.pressure || snapshot.salarySettings.length === 0) return [];
  if (buildDashboard(snapshot, today).pressure.level !== 'SERIOUS') return [];
  const month = dayOfMonth(today) <= PRESSURE_DAY ? monthOf(today) : addMonths(monthOf(today), 1);
  return [{
    id: `pressure:${month}`, at: atNine(dateInMonth(month, PRESSURE_DAY)), title: 'Your salary and your Pool',
    body: 'Your Pool may run out sooner than you planned. Open Vanea to see a salary that would last.',
  }];
}

/** Upcoming reminders, soonest first. Anything already in the past is left out. */
export function planNotifications(snapshot: Snapshot, today: DateString): PlannedNotification[] {
  return [...paydayReminders(snapshot, today), ...debtReminders(snapshot, today), ...pressureReminders(snapshot, today), ...subscriptionReminders(snapshot, today), ...monthReminders(snapshot, today), ...backupReminders(snapshot, today)].sort((a, b) => (a.at < b.at ? -1 : 1));
}
