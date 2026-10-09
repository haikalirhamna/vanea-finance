/** What a loan costs, shown before it is saved (PRD DEBT-4). Pure: the form calls it as the user types. */
import { DateString } from '@/domain/calendar';
import {
  InstallmentLoan, LoanFrequency, LoanTermsError, approximateYearlyRate, costOfBorrowing, totalToRepay, validateLoanTerms,
} from '@/domain/installment-loans';
import { ExplainedError, problem } from '../errors';

export interface LoanTerms {
  received: number;
  installmentAmount: number;
  installmentCount: number;
  frequency: LoanFrequency;
  startDate: DateString;
  firstDueDate: DateString;
}

export interface LoanPreview {
  totalToRepay: number;
  cost: number;
  /** A ratio: 3.65 means about 365% a year. */
  yearlyRate: number;
}

const EXPLANATIONS: Record<LoanTermsError, ExplainedError> = {
  INVALID_AMOUNT: problem('Check the amount received', 'The amount you receive has to be a whole number of rupiah above zero.', 'Enter the amount again.'),
  INVALID_INSTALLMENT: problem('Check the installment', 'Each installment has to be a whole number of rupiah above zero.', 'Enter the installment again.'),
  INVALID_COUNT: problem('Check the number of installments', 'A loan has at least one installment.', 'Enter a whole number, 1 or more.'),
  REPAYS_LESS_THAN_RECEIVED: problem(
    'You would repay less than you receive',
    'The installments add up to less than the amount received.',
    'Check the installment and the number of installments.',
  ),
  SINGLE_NEEDS_ONE_INSTALLMENT: problem('A single payment is one installment', 'A loan repaid in one go has exactly one installment.', 'Set the number of installments to 1, or choose monthly.'),
  DUE_BEFORE_START: problem('The first payment is before the loan starts', 'The first due date cannot be earlier than the day you receive the money.', 'Pick a later due date.'),
};

export function asLoan(terms: LoanTerms, id = 'preview'): InstallmentLoan {
  return { id, purpose: 'personal', ...terms };
}

/** The cost of the loan, or the reason its terms cannot be right. */
export function previewLoan(terms: LoanTerms): { ok: true; preview: LoanPreview } | { ok: false; error: ExplainedError } {
  const loan = asLoan(terms);
  const verdict = validateLoanTerms(loan);
  if (!verdict.ok) return { ok: false, error: EXPLANATIONS[verdict.code] };
  return { ok: true, preview: { totalToRepay: totalToRepay(loan), cost: costOfBorrowing(loan), yearlyRate: approximateYearlyRate(loan) } };
}
