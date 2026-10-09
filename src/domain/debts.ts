/** Across all debts: owed totals, what falls due and the debt payment ratio (SYSTEM-OVERVIEW §6.9, §7.2, §7.4). */
import { DateString, Month, monthOf } from './calendar';
import { CONFIG } from './config';
import { CreditLine, amountDue, billDueDate, billReserveOf, olderDebt, owedOnLine, statementBalance } from './credit-lines';
import {
  InstallmentLoan, dueDates, installmentsPaid, owedOn, totalPaidOn, unpaidInstallments,
} from './installment-loans';
import { Transaction, activeTransactions } from './ledger';
import { Rupiah, sum } from './money';

export interface DebtBook {
  loans: readonly InstallmentLoan[];
  lines: readonly CreditLine[];
  transactions: readonly Transaction[];
}

export interface DebtDue {
  debtId: string;
  kind: 'credit_line' | 'installment_loan';
  date: DateString;
  amount: Rupiah;
  /** Due before today and still unpaid. */
  overdue: boolean;
}

function personalLoans(book: DebtBook): InstallmentLoan[] {
  return book.loans.filter((loan) => loan.purpose === 'personal');
}

/** What is owed across credit lines and loans (the salary advance is listed separately). */
export function totalOwed(book: DebtBook): Rupiah {
  const loans = book.loans.map((loan) => owedOn(book.transactions, loan.id));
  const lines = book.lines.map((line) => owedOnLine(book.transactions, line.id));
  return sum([...loans, ...lines]);
}

/** Unpaid installments of personal loans, oldest first. */
function unpaidLoanDues(book: DebtBook, today: DateString): DebtDue[] {
  return personalLoans(book).flatMap((loan) => {
    const owed = owedOn(book.transactions, loan.id);
    return unpaidInstallments(loan, totalPaidOn(book.transactions, loan.id), owed).map((item) => ({
      debtId: loan.id, kind: 'installment_loan' as const, date: item.date, amount: item.amount, overdue: item.date < today,
    }));
  });
}

/** Credit-line bills that are due and unpaid. */
function openBillDues(book: DebtBook, today: DateString): DebtDue[] {
  return book.lines.flatMap((line) => {
    const amount = amountDue(book.transactions, line, today);
    if (amount <= 0) return [];
    const date = billDueDate(today, line);
    return [{ debtId: line.id, kind: 'credit_line' as const, date, amount, overdue: date < today }];
  });
}

/** Everything unpaid with its due date, oldest first (for reminders and the Debts view). */
export function dueList(book: DebtBook, today: DateString): DebtDue[] {
  return [...unpaidLoanDues(book, today), ...openBillDues(book, today)].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/**
 * Money Available Spending must leave for debts before the next payday: unpaid personal
 * installments due before it (overdue ones included), plus the older, not-yet-set-aside
 * balance of credit lines whose bill falls due before it.
 */
export function dueBeforePayday(book: DebtBook, today: DateString, nextPayday: DateString): Rupiah {
  const installments = unpaidLoanDues(book, today).filter((due) => due.date < nextPayday);
  const lineBills = openBillDues(book, today).filter((due) => due.date < nextPayday);
  const older = lineBills.map((due) =>
    olderDebt(owedOnLine(book.transactions, due.debtId), billReserveOf(book.transactions, due.debtId)));
  return sum(installments.map((due) => due.amount)) + sum(older);
}

/** A loan counts for a month if money is still owed on it or it was paid in that month. */
function isActiveIn(book: DebtBook, loan: InstallmentLoan, month: Month): boolean {
  if (owedOn(book.transactions, loan.id) > 0) return true;
  return activeTransactions(book.transactions).some((tx) => tx.debtId === loan.id && monthOf(tx.date) === month);
}

/**
 * Personal debt payments that belong to a month: scheduled installments of personal loans, and
 * the statement amount of credit lines whose bill falls due in it. Stays the same as bills get paid.
 */
export function dueInMonth(book: DebtBook, month: Month, today: DateString): Rupiah {
  const installments = personalLoans(book)
    .filter((loan) => isActiveIn(book, loan, month))
    .flatMap((loan) => dueDates(loan).filter((date) => monthOf(date) === month).map(() => loan.installmentAmount));
  const bills = book.lines
    .filter((line) => monthOf(billDueDate(today, line)) === month)
    .map((line) => statementBalance(book.transactions, line, today));
  return sum(installments) + sum(bills);
}

/** Personal debt payments due this month as a share of salary; null without a salary. */
export function debtPaymentRatio(dueThisMonth: Rupiah, salary: Rupiah): number | null {
  return salary > 0 ? dueThisMonth / salary : null;
}

/** The calm card appears above 30%. It never blocks a record and never ranks debts. */
export function exceedsDebtRatio(ratio: number | null): boolean {
  return ratio !== null && ratio > CONFIG.DEBT_RATIO_THRESHOLD;
}

/** Installments of a loan still ahead, for the "3 of 6 left" line. */
export function installmentsLeft(loan: InstallmentLoan, transactions: readonly Transaction[]): number {
  return loan.installmentCount - installmentsPaid(loan, totalPaidOn(transactions, loan.id));
}
