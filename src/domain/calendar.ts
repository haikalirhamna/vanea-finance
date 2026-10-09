/** Local calendar dates `YYYY-MM-DD` and months `YYYY-MM` (SYSTEM-OVERVIEW §4). */
export type DateString = string;
export type Month = string;

const MS_PER_DAY = 86_400_000;

function yearOf(value: string): number {
  return Number(value.slice(0, 4));
}

function monthNumberOf(value: string): number {
  return Number(value.slice(5, 7));
}

export function dayOfMonth(date: DateString): number {
  return Number(date.slice(8, 10));
}

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0');
}

function toUtcMs(date: DateString): number {
  return Date.UTC(yearOf(date), monthNumberOf(date) - 1, dayOfMonth(date));
}

export function isDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return new Date(toUtcMs(value)).toISOString().slice(0, 10) === value;
}

export function isMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function monthOf(date: DateString): Month {
  return date.slice(0, 7);
}

export function addMonths(month: Month, count: number): Month {
  const index = yearOf(month) * 12 + (monthNumberOf(month) - 1) + count;
  return `${pad(Math.floor(index / 12), 4)}-${pad((index % 12) + 1)}`;
}

/** Whole months from `from` to `to` (negative when `to` is earlier). */
export function monthsBetween(from: Month, to: Month): number {
  return (yearOf(to) - yearOf(from)) * 12 + (monthNumberOf(to) - monthNumberOf(from));
}

/** Every month from `from` to `to`, inclusive; empty when `to` is before `from`. */
export function monthRange(from: Month, to: Month): Month[] {
  const length = monthsBetween(from, to) + 1;
  return Array.from({ length: Math.max(0, length) }, (_, offset) => addMonths(from, offset));
}

export function daysInMonth(month: Month): number {
  return new Date(Date.UTC(yearOf(month), monthNumberOf(month), 0)).getUTCDate();
}

export function dateFor(month: Month, day: number): DateString {
  return `${month}-${pad(day)}`;
}

export function addDays(date: DateString, count: number): DateString {
  return new Date(toUtcMs(date) + count * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: DateString, to: DateString): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}

/** A month is completed once today falls in a later month. */
export function lastCompletedMonth(today: DateString): Month {
  return addMonths(monthOf(today), -1);
}

export function isCompletedMonth(month: Month, today: DateString): boolean {
  return month < monthOf(today);
}

export function paydayOf(period: Month, paydayDay: number): DateString {
  return dateFor(period, paydayDay);
}

/** The salary period whose payday is the most recent one on or before today. */
export function currentPeriod(today: DateString, paydayDay: number): Month {
  const month = monthOf(today);
  return dayOfMonth(today) >= paydayDay ? month : addMonths(month, -1);
}

export function periodStart(today: DateString, paydayDay: number): DateString {
  return paydayOf(currentPeriod(today, paydayDay), paydayDay);
}

/** The next payday strictly after today. */
export function nextPayday(today: DateString, paydayDay: number): DateString {
  return paydayOf(addMonths(currentPeriod(today, paydayDay), 1), paydayDay);
}
