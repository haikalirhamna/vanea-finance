/** The words of the salary review (DESIGN §6.2): real amounts and months, never scores. */
import { Month, addMonths } from '@/domain/calendar';
import { CONFIG } from '@/domain/config';
import { MonthlyNetIncome } from '@/domain/income-history';
import { EvaluationRecord } from '@/data/salary-evaluations';
import { formatMoney, formatMonthName, formatPercent } from '@/lib/format';

export interface ReviewRow {
  label: string;
  value: string;
}

export interface ReviewView {
  /** Why the review looks the way it does, in one or two sentences. */
  message: string;
  /** Evidence rows; only for an eligible review. */
  rows: ReviewRow[];
}

const monthsOf = (json: string | undefined): MonthlyNetIncome[] => (json ? (JSON.parse(json) as MonthlyNetIncome[]) : []);
const amountsText = (months: readonly MonthlyNetIncome[]): string => months.map((m) => formatMoney(m.amount)).join(' · ');

/** The lowest amount each recent month had to reach. */
const neededOf = (record: EvaluationRecord): number =>
  Math.ceil(((record.referenceIncome ?? 0) * (10_000 + (record.thresholdBp ?? 0))) / 10_000);

function cooldownMessage(anchor: Month | null): string {
  const when = anchor ? ` — in ${formatMonthName(addMonths(anchor, CONFIG.RECENT_MONTHS))}` : '';
  return `Your salary changed recently. We'll review it after three full months at this level${when}.`;
}

function observingMessage(record: EvaluationRecord): string {
  const recent = monthsOf(record.recentMonthsJson);
  const lowest = Math.min(...recent.map((m) => m.amount));
  const needed = neededOf(record);
  const base = `Your income hasn't stayed clearly above its usual level yet. Each of the last ${CONFIG.RECENT_MONTHS} months needs to be at least ${formatMoney(needed)}. Your lowest was ${formatMoney(lowest)}.`;
  const swing = (record.swingBp ?? 0) / 10_000;
  const volatile = swing * CONFIG.SWING_MULTIPLIER > CONFIG.MIN_SHIFT;
  return volatile ? `${base} Your income usually moves about ${formatPercent(swing)} from month to month, so an increase needs to be larger than that to count.` : base;
}

function seasonalMessage(record: EvaluationRecord): string {
  const lastYear = monthsOf(record.lastYearMonthsJson).reduce((total, m) => total + m.amount, 0);
  return `This looks like last year's pattern. These same months last year brought ${formatMoney(lastYear)} — about the same as now.`;
}

function eligibleRows(record: EvaluationRecord): ReviewRow[] {
  const recent = monthsOf(record.recentMonthsJson);
  const needed = neededOf(record);
  const rows: ReviewRow[] = [
    { label: 'Typical income before', value: formatMoney(record.referenceIncome ?? 0) },
    { label: 'Last 3 months', value: amountsText(recent) },
    { label: 'Needed each month', value: `${formatMoney(needed)} or more` },
  ];
  const lastYear = monthsOf(record.lastYearMonthsJson);
  if (lastYear.length > 0) rows.push({ label: 'Same months last year', value: amountsText(lastYear) });
  rows.push({ label: 'Your Pool can support it', value: 'Yes, even if your weakest months return' });
  return rows;
}

export function describeReview(record: EvaluationRecord, anchor: Month | null): ReviewView {
  switch (record.status) {
    case 'INSUFFICIENT_DATA':
      return { message: `We need at least ${CONFIG.MIN_DATA_MONTHS} months of income to review your salary. You have ${record.dataMonths}.`, rows: [] };
    case 'COOLDOWN': return { message: cooldownMessage(anchor), rows: [] };
    case 'OBSERVING': return { message: observingMessage(record), rows: [] };
    case 'SEASONAL_PATTERN': return { message: seasonalMessage(record), rows: [] };
    case 'NOT_AFFORDABLE':
      return { message: "Your income is higher, but your Pool can't yet support a 5% raise if your weaker months return.", rows: [] };
    case 'ELIGIBLE':
      return { message: 'Your income has moved up and held there.', rows: eligibleRows(record) };
  }
}
