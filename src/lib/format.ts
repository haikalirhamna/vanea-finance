/** Formatting for display (DESIGN §3.3): rupiah with dot grouping, comma decimals, short dates. */
import { DateString, Month } from '@/domain/calendar';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const LONG_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
] as const;
const MINUS = '−';

function groupThousands(value: number): string {
  return Math.abs(Math.trunc(value)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** `Rp 4.250.000`; negative amounts put the minus before `Rp`: `−Rp 300.000`. */
export function formatMoney(amount: number): string {
  const sign = amount < 0 ? MINUS : '';
  return `${sign}Rp ${groupThousands(amount)}`;
}

/** The digits only, for the large hero figure (the `Rp` prefix is styled apart). */
export function formatMoneyDigits(amount: number): string {
  return `${amount < 0 ? MINUS : ''}${groupThousands(amount)}`;
}

/** One decimal at most, comma decimal: `2,8`. Whole numbers have no decimal. */
export function formatDecimal(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',');
}

export function formatMonthsCount(months: number): string {
  const text = formatDecimal(months);
  return text === '1' ? '1 month' : `${text} months`;
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

function monthIndex(value: string): number {
  return Number(value.slice(5, 7)) - 1;
}

/** `25 Oct`, or `25 Oct 2026` when `withYear`. */
export function formatDate(date: DateString, withYear = false): string {
  const base = `${Number(date.slice(8, 10))} ${MONTH_NAMES[monthIndex(date)]}`;
  return withYear ? `${base} ${date.slice(0, 4)}` : base;
}

/** `Oct 2026`. */
export function formatMonth(month: Month): string {
  return `${MONTH_NAMES[monthIndex(month)]} ${month.slice(0, 4)}`;
}

/** `October`. */
export function formatMonthName(month: Month): string {
  return LONG_MONTH_NAMES[monthIndex(month)]!;
}

/** Digits typed in an amount field (any separators) → whole rupiah; null when empty. */
export function parseMoneyInput(text: string): number | null {
  const digits = text.replace(/\D/g, '');
  return digits === '' ? null : Number(digits);
}

/** Live formatting while typing: `4250000` → `4.250.000`. */
export function formatMoneyInput(text: string): string {
  const value = parseMoneyInput(text);
  return value === null ? '' : groupThousands(value);
}

/** What a screen reader says: "4 million 250 thousand rupiah". */
export function speakMoney(amount: number): string {
  const sign = amount < 0 ? 'minus ' : '';
  const whole = Math.abs(Math.trunc(amount));
  const parts: string[] = [];
  const millions = Math.floor(whole / 1_000_000);
  const thousands = Math.floor((whole % 1_000_000) / 1_000);
  const rest = whole % 1_000;
  if (millions) parts.push(`${millions} million`);
  if (thousands) parts.push(`${thousands} thousand`);
  if (rest || parts.length === 0) parts.push(String(rest));
  return `${sign}${parts.join(' ')} rupiah`;
}
