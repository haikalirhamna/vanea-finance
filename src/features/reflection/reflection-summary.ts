/** Everything a month's reflection shows, computed from the records (PRD REF-2..7). Pure. */
import { DateString, Month, addMonths, monthOf } from '@/domain/calendar';
import {
  DebtInvestmentLines, Highlight, IntentionComparison, MonthSummary, compareIntention, debtAndInvestmentLines, findHighlights, summarizeMonth,
} from '@/domain/reflection';
import { loansOf } from '@/data/debts';
import { Snapshot } from '@/data/snapshot';

export interface ReflectionFigures {
  summary: MonthSummary;
  highlights: Highlight[];
  /** Null when no intention was set for the month. */
  intention: IntentionComparison | null;
  lines: DebtInvestmentLines;
}

export function figuresFor(snapshot: Snapshot, month: Month): ReflectionFigures {
  const summary = summarizeMonth(snapshot.transactions, month);
  const intention = snapshot.intentions.find((i) => i.month === month);
  return {
    summary,
    highlights: findHighlights(snapshot.transactions, month, snapshot.profile!.onboardedOn),
    intention: intention ? compareIntention({ setAsideAmount: intention.setAsideAmount, wantsLimit: intention.wantsLimit ?? null }, summary) : null,
    lines: debtAndInvestmentLines(snapshot.transactions, month, loansOf(snapshot.debts)),
  };
}

/** The figures as they were when the reflection was saved. */
export function savedFigures(json: string): ReflectionFigures {
  return JSON.parse(json) as ReflectionFigures;
}

export interface MonthPrompts {
  /** The month to reflect on (last month), when it is after onboarding and not yet reflected. */
  reflectOn: Month | null;
  /** True when this month has no intention yet. */
  needsIntention: boolean;
}

/** What Home should invite the user to do this month. Reflection can always be done later from More. */
export function monthPrompts(snapshot: Snapshot, today: DateString): MonthPrompts {
  const month = monthOf(today);
  const last = addMonths(month, -1);
  const onboardedMonth = monthOf(snapshot.profile!.onboardedOn);
  const done = snapshot.reflections.some((r) => r.month === last && r.completedAt !== undefined);
  return {
    reflectOn: last >= onboardedMonth && !done ? last : null,
    needsIntention: !snapshot.intentions.some((i) => i.month === month),
  };
}

/** Months that can still be reflected on, newest first (completed ones are history). */
export function pastMonths(snapshot: Snapshot, today: DateString): Month[] {
  const onboardedMonth = monthOf(snapshot.profile!.onboardedOn);
  const months: Month[] = [];
  for (let month = addMonths(monthOf(today), -1); month >= onboardedMonth; month = addMonths(month, -1)) months.push(month);
  return months;
}
