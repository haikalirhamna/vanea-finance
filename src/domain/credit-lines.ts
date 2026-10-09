/** Credit cards and PayLater: bill reserve, amount due, paying the bill, converting to installments (SYSTEM-OVERVIEW §6.9). */
import { DateString, addMonths, dateInMonth, monthOf } from './calendar';
import { Transaction, activeTransactions, allMovements, balanceOf, balanceThrough, scopedBalance } from './ledger';
import { Rupiah } from './money';

export interface CreditLine {
  id: string;
  statementDay: number;
  dueDay: number;
  limit: Rupiah | null;
}

export type BillPaymentSource = 'personal' | 'pool';

export type BillPaymentPlan =
  | {
      ok: true;
      /** Taken from the bill reserve, set aside earlier. */
      reservePart: Rupiah;
      /** Taken from Available Spending now (an older balance). */
      fromAvailableSpending: Rupiah;
      /** Taken from the Pool. */
      fromPool: Rupiah;
      /** Reserved money handed back to Available Spending when the Pool pays. */
      returnedToAvailableSpending: Rupiah;
    }
  | { ok: false; code: 'INVALID_AMOUNT' | 'ABOVE_OWED'; max: Rupiah };

export type ConversionPlan =
  | { ok: true; reservePart: Rupiah; totalOwed: Rupiah; cost: Rupiah }
  | { ok: false; code: 'INVALID_AMOUNT' | 'ABOVE_OWED' | 'REPAYS_LESS_THAN_PURCHASE'; max?: Rupiah };

export function owedOnLine(transactions: readonly Transaction[], lineId: string): Rupiah {
  return scopedBalance(transactions, 'debt', lineId);
}

/** Money already taken out of Available Spending for this line's bill. */
export function billReserveOf(transactions: readonly Transaction[], lineId: string): Rupiah {
  return scopedBalance(transactions, 'bill_reserve', lineId);
}

/** The part of the balance not yet set aside (an older debt being repaid over time). */
export function olderDebt(owed: Rupiah, reserve: Rupiah): Rupiah {
  return Math.max(0, owed - reserve);
}

/** Credit left under the limit, or null without a limit. Never used to block a purchase. */
export function availableCredit(limit: Rupiah | null, owed: Rupiah): Rupiah | null {
  return limit === null ? null : Math.max(0, limit - owed);
}

// ---------------------------------------------------------------------------
// Statement and due date
// ---------------------------------------------------------------------------

/** The most recent statement date on or before today. */
export function latestStatementDate(today: DateString, statementDay: number): DateString {
  const thisMonth = dateInMonth(monthOf(today), statementDay);
  return today >= thisMonth ? thisMonth : dateInMonth(addMonths(monthOf(today), -1), statementDay);
}

/** When the bill of the latest statement is due: the first due day after it. */
export function billDueDate(today: DateString, line: CreditLine): DateString {
  const statementMonth = monthOf(latestStatementDate(today, line.statementDay));
  const dueMonth = line.dueDay > line.statementDay ? statementMonth : addMonths(statementMonth, 1);
  return dateInMonth(dueMonth, line.dueDay);
}

/** What was owed on the line at its latest statement. */
export function statementBalance(transactions: readonly Transaction[], line: CreditLine, today: DateString): Rupiah {
  const movements = allMovements(transactions);
  return Math.max(0, balanceThrough(movements, 'debt', latestStatementDate(today, line.statementDay), line.id));
}

/** Payments and conversions after a date: they reduce the bill. */
function settledSince(transactions: readonly Transaction[], lineId: string, date: DateString): Rupiah {
  return activeTransactions(transactions)
    .filter((tx) => tx.debtId === lineId && tx.date > date && (tx.kind === 'debt_payment' || tx.kind === 'credit_conversion'))
    .reduce((total, tx) => total + tx.amount, 0);
}

/** The latest statement's bill, less what has been paid or converted since. */
export function amountDue(transactions: readonly Transaction[], line: CreditLine, today: DateString): Rupiah {
  const statement = latestStatementDate(today, line.statementDay);
  return Math.max(0, statementBalance(transactions, line, today) - settledSince(transactions, line.id, statement));
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

/** How a bill payment splits between the bill reserve, Available Spending and the Pool. */
export function planBillPayment(
  amount: Rupiah,
  owed: Rupiah,
  reserve: Rupiah,
  source: BillPaymentSource,
): BillPaymentPlan {
  if (!Number.isSafeInteger(amount) || amount <= 0) return { ok: false, code: 'INVALID_AMOUNT', max: owed };
  if (amount > owed) return { ok: false, code: 'ABOVE_OWED', max: owed };
  const reservePart = Math.min(amount, reserve);
  const fromPool = source === 'pool';
  return {
    ok: true,
    reservePart,
    fromAvailableSpending: fromPool ? 0 : amount - reservePart,
    fromPool: fromPool ? amount : 0,
    returnedToAvailableSpending: fromPool ? reservePart : 0,
  };
}

/** Converting a purchase to installments: the reserve returns to Available Spending, a loan takes over. */
export function planConversion(input: {
  purchaseAmount: Rupiah;
  owed: Rupiah;
  reserve: Rupiah;
  installmentAmount: Rupiah;
  installmentCount: number;
}): ConversionPlan {
  const { purchaseAmount, owed, reserve, installmentAmount, installmentCount } = input;
  if (!Number.isSafeInteger(purchaseAmount) || purchaseAmount <= 0) return { ok: false, code: 'INVALID_AMOUNT' };
  if (purchaseAmount > owed) return { ok: false, code: 'ABOVE_OWED', max: owed };
  const totalOwed = installmentAmount * installmentCount;
  if (totalOwed < purchaseAmount) return { ok: false, code: 'REPAYS_LESS_THAN_PURCHASE' };
  return { ok: true, reservePart: Math.min(purchaseAmount, reserve), totalOwed, cost: totalOwed - purchaseAmount };
}

/** Total set aside across all lines (for the Debts view). */
export function totalBillReserve(transactions: readonly Transaction[]): Rupiah {
  return balanceOf(allMovements(transactions), 'bill_reserve');
}
