/** The movements each kind of transaction causes (SYSTEM-OVERVIEW §6.2, §6.9–§6.11). */
import { Account, Movement, Transaction, TransactionKind } from './ledger-types';

interface Entry {
  account: Account;
  amount: number;
  refId?: string;
}

type ForwardKind = Exclude<TransactionKind, 'reversal'>;

function entry(account: Account, amount: number, refId?: string): Entry {
  return refId === undefined ? { account, amount } : { account, amount, refId };
}

const credit = (account: Account, amount: number, refId?: string): Entry => entry(account, amount, refId);
const debit = (account: Account, amount: number, refId?: string): Entry => entry(account, -amount, refId);

function required<T>(value: T | undefined, tx: Transaction, field: string): T {
  if (value === undefined) throw new Error(`Transaction ${tx.id} (${tx.kind}) requires ${field}`);
  return value;
}

/** The reference id a scoped account needs, taken from the transaction. */
function refFor(account: Account, tx: Transaction): string | undefined {
  if (account === 'debt' || account === 'bill_reserve') return required(tx.debtId, tx, 'debtId');
  if (account === 'investment' || account === 'investment_cash') return tx.holdingId;
  return undefined;
}

function creditTo(account: Account, tx: Transaction, amount = tx.amount): Entry {
  return credit(account, amount, refFor(account, tx));
}

function debitFrom(account: Account, tx: Transaction, amount = tx.amount): Entry {
  return debit(account, amount, refFor(account, tx));
}

function destination(tx: Transaction): Account {
  return required(tx.destinationAccount, tx, 'destinationAccount');
}

function source(tx: Transaction): Account {
  return required(tx.sourceAccount, tx, 'sourceAccount');
}

/** An expense: paid from Available Spending, with a credit line, or as an installment purchase. */
function expenseEntries(tx: Transaction): Entry[] {
  if (tx.paymentMethod === 'installment') return [];
  if (tx.paymentMethod === 'credit_line') {
    return [debit('personal', tx.amount), creditTo('bill_reserve', tx), creditTo('debt', tx)];
  }
  return [debit('personal', tx.amount)];
}

/** Interest, fees and late fees: a credit line sets them aside; a loan only owes more. */
function debtCostEntries(tx: Transaction): Entry[] {
  const owed = creditTo('debt', tx);
  if (tx.paymentMethod !== 'credit_line') return [owed];
  return [debit('personal', tx.amount), creditTo('bill_reserve', tx), owed];
}

/** Paying a credit line uses its bill reserve first (`reservePart`); a loan has no reserve. */
function debtPaymentEntries(tx: Transaction): Entry[] {
  const reserve = tx.paymentMethod === 'credit_line' ? (tx.reservePart ?? 0) : 0;
  const from = source(tx);
  const entries = [debitFrom('debt', tx)];
  if (reserve > 0) entries.push(debitFrom('bill_reserve', tx, reserve));
  if (from === 'pool') {
    entries.push(debit('pool', tx.amount));
    if (reserve > 0) entries.push(credit('personal', reserve));
  } else {
    entries.push(debit('personal', tx.amount - reserve));
  }
  return entries.filter((e) => e.amount !== 0);
}

function loanStartEntries(tx: Transaction): Entry[] {
  const entries = [creditTo('debt', tx, required(tx.totalOwed, tx, 'totalOwed'))];
  if (tx.destinationAccount) entries.push(credit(tx.destinationAccount, tx.amount));
  return entries;
}

/** A card or PayLater purchase becomes an installment loan: the line loses it, the loan gains its total. */
function conversionEntries(tx: Transaction): Entry[] {
  const reserve = required(tx.reservePart, tx, 'reservePart');
  const targetDebt = required(tx.targetDebtId, tx, 'targetDebtId');
  return [
    debitFrom('bill_reserve', tx, reserve),
    credit('personal', reserve),
    debitFrom('debt', tx),
    credit('debt', required(tx.totalOwed, tx, 'totalOwed'), targetDebt),
  ];
}

const FORWARD_ENTRIES: Record<ForwardKind, (tx: Transaction) => Entry[]> = {
  opening_balance: (tx) => [creditTo(required(tx.account, tx, 'account'), tx)],
  bill_reserve_set_aside: (tx) => [debit('personal', tx.amount), creditTo('bill_reserve', tx)],
  income: (tx) => [credit('pool', tx.amount)],
  business_cost: (tx) => [debit('pool', tx.amount)],
  salary_payment: (tx) => [debit('pool', tx.amount), credit('personal', tx.amount)],
  expense: expenseEntries,
  debt_cost: debtCostEntries,
  debt_payment: debtPaymentEntries,
  debt_payoff: (tx) => [debit(source(tx), tx.amount), debitFrom('debt', tx, required(tx.clearedAmount, tx, 'clearedAmount'))],
  loan_start: loanStartEntries,
  credit_conversion: conversionEntries,
  savings_deposit: (tx) => [debit('personal', tx.amount), credit('savings', tx.amount)],
  savings_withdrawal: (tx) => [debit('savings', tx.amount), credit('personal', tx.amount)],
  investment_contribution: (tx) => [debit('personal', tx.amount), creditTo('investment', tx)],
  investment_sale: (tx) => [debitFrom('investment', tx, required(tx.costRemoved, tx, 'costRemoved')), credit(destination(tx), tx.amount)],
  investment_income: (tx) => [creditTo('investment_cash', tx)],
  investment_cash_withdrawal: (tx) => [debitFrom('investment_cash', tx), credit(destination(tx), tx.amount)],
  surplus_allocation: (tx) => [debit('pool', tx.amount), creditTo(required(tx.account, tx, 'account'), tx)],
  advance_disbursement: (tx) => [debit('pool', tx.amount), credit('personal', tx.amount)],
  advance_early_repayment: (tx) => [debit('personal', tx.amount), credit('pool', tx.amount)],
};

function forwardEntries(tx: Transaction): Entry[] {
  if (tx.kind === 'reversal') throw new Error('A reversal cannot be reversed');
  return FORWARD_ENTRIES[tx.kind](tx);
}

function reversalEntries(reversal: Transaction, original: Transaction): Entry[] {
  // An income reversal removes only what the Pool can absorb (SYSTEM-OVERVIEW §6.5).
  if (original.kind === 'income') return [debit('pool', reversal.amount)];
  return forwardEntries(original).map((e) => entry(e.account, -e.amount, e.refId));
}

/** The movements one transaction causes. A reversal needs its original. */
export function movementsOf(tx: Transaction, original?: Transaction): Movement[] {
  if (tx.kind === 'reversal' && !original) {
    throw new Error(`Reversal ${tx.id} needs its original transaction`);
  }
  const entries = tx.kind === 'reversal' ? reversalEntries(tx, original!) : forwardEntries(tx);
  return entries
    .filter((e) => e.amount !== 0)
    .map((e) => ({ transactionId: tx.id, date: tx.date, ...e }));
}

export function allMovements(transactions: readonly Transaction[]): Movement[] {
  const byId = new Map(transactions.map((tx) => [tx.id, tx]));
  return transactions.flatMap((tx) =>
    movementsOf(tx, tx.reversesId === undefined ? undefined : byId.get(tx.reversesId)),
  );
}
