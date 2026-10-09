/** Turning domain refusals into the three-part messages of DESIGN §12: what happened, why, what to do. */
import { DateString } from '@/domain/calendar';
import { LedgerErrorCode, LedgerValidation } from '@/domain/ledger-types';
import { formatDate, formatMoney } from '@/lib/format';

export interface ExplainedError {
  title: string;
  /** What happened, and why. */
  what: string;
  /** What the user can do. */
  next?: string;
}

type Refusal = Extract<LedgerValidation, { ok: false }>;

const SIMPLE: Partial<Record<LedgerErrorCode, ExplainedError>> = {
  INVALID_AMOUNT: { title: 'Check the amount', what: 'The amount has to be a whole number of rupiah above zero.', next: 'Enter the amount again.' },
  INVALID_DATE: { title: 'Check the date', what: 'That date does not make sense for this record.', next: 'Pick another date.' },
  DATE_IN_FUTURE: { title: "That date hasn't come yet", what: 'Records can only be dated today or earlier.', next: 'Pick today or an earlier date.' },
  DATE_BEFORE_ONBOARDING: {
    title: 'That is before you started', what: 'Vanea only keeps records from the day you set it up.',
    next: 'Older income belongs in Income history, in Settings.',
  },
  MISSING_FIELD: { title: 'Something is missing', what: 'A detail this record needs was left empty.', next: 'Fill in the missing detail and try again.' },
  ORIGINAL_NOT_FOUND: { title: 'That record is gone', what: 'The record you want to change no longer exists.', next: 'Go back and refresh the list.' },
  NOT_REVERSIBLE: { title: "That can't be removed", what: 'A removal cannot itself be removed.', next: 'Record the transaction again instead.' },
  ALREADY_REVERSED: { title: 'Already removed', what: 'This record was already removed or corrected.', next: 'Check the history for the corrected record.' },
  REVERSAL_AMOUNT_MISMATCH: { title: 'Amounts do not match', what: 'A removal has to match the amount of the record it removes.', next: 'Try again from the record.' },
};

function shortBy(refusal: Refusal): string {
  const date: DateString = refusal.date ?? '';
  return `${formatMoney(refusal.shortfall ?? 0)} on ${formatDate(date)}`;
}

const SHORTFALL: Record<string, (refusal: Refusal) => ExplainedError> = {
  pool: (r) => ({
    title: 'Not enough in your Pool',
    what: `This would leave your Pool short by ${shortBy(r)}.`,
    next: 'Record the income that paid for it first, or use a smaller amount.',
  }),
  savings: (r) => ({
    title: 'Not enough in Savings',
    what: `This would take ${formatMoney(r.shortfall ?? 0)} more than your Savings hold.`,
    next: 'Use a smaller amount.',
  }),
  debt: (r) => ({
    title: "That's more than you owe",
    what: `This payment is ${formatMoney(r.shortfall ?? 0)} above what is owed.`,
    next: 'Pay up to the amount owed.',
  }),
  bill_reserve: (r) => ({
    title: 'Not enough set aside for this bill',
    what: `This needs ${formatMoney(r.shortfall ?? 0)} more than is set aside for it.`,
    next: 'Pay the rest from Available Spending.',
  }),
};

const FALLBACK_SHORTFALL = (r: Refusal): ExplainedError => ({
  title: 'Not enough to do that',
  what: `This would take ${formatMoney(r.shortfall ?? 0)} more than there is.`,
  next: 'Use a smaller amount.',
});

export function explainLedgerError(refusal: Refusal): ExplainedError {
  if (refusal.code === 'INSUFFICIENT_BALANCE') {
    return (SHORTFALL[refusal.account ?? ''] ?? FALLBACK_SHORTFALL)(refusal);
  }
  return SIMPLE[refusal.code] ?? { title: 'That did not work', what: 'The record could not be saved.', next: 'Check the details and try again.' };
}

/** For failures that do not come from the ledger. */
export function problem(title: string, what: string, next?: string): ExplainedError {
  return next === undefined ? { title, what } : { title, what, next };
}
