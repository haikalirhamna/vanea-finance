/** Credit lines and installment loans in one table (SCHEMA §3.12). */
import { CreditLine } from '@/domain/credit-lines';
import { InstallmentLoan, LoanFrequency, LoanPurpose } from '@/domain/installment-loans';
import { DateString } from '@/domain/calendar';
import { SqlDriver } from './driver';
import { Row, fromRow, insertRow, updateRow } from './rows';

export type DebtKind = 'credit_line' | 'installment_loan';
export type CreditLineType = 'credit_card' | 'paylater';
export type LoanType =
  | 'online_loan' | 'bank_loan' | 'installment_purchase' | 'paylater_installments' | 'card_installment_plan' | 'personal' | 'other';

export interface DebtRecord {
  id: string;
  kind: DebtKind;
  name: string;
  type: CreditLineType | LoanType;
  purpose: LoanPurpose;
  creditLimit?: number;
  statementDay?: number;
  dueDay?: number;
  amountReceived?: number;
  installmentAmount?: number;
  installmentCount?: number;
  frequency?: LoanFrequency;
  startDate?: DateString;
  firstDueDate?: DateString;
  ojkRegistered?: 'yes' | 'no' | 'unknown';
  origin: 'manual' | 'onboarding' | 'conversion';
  status: 'open' | 'closed';
  note?: string;
}

const NUMERIC = ['creditLimit', 'statementDay', 'dueDay', 'amountReceived', 'installmentAmount', 'installmentCount'];

function debtOf(row: Row): DebtRecord {
  const record = fromRow<Record<string, string | number>>(row);
  delete record.createdAt;
  delete record.updatedAt;
  for (const key of NUMERIC) if (key in record) record[key] = Number(record[key]);
  return record as unknown as DebtRecord;
}

export async function loadDebts(driver: SqlDriver): Promise<DebtRecord[]> {
  return (await driver.all('SELECT * FROM debts ORDER BY created_at, rowid')).map(debtOf);
}

/** Call inside `driver.transaction`. */
export async function insertDebt(driver: SqlDriver, debt: DebtRecord, now: string): Promise<void> {
  await insertRow(driver, 'debts', { ...debt, createdAt: now, updatedAt: now });
}

export type DebtPatch = Partial<Pick<DebtRecord, 'name' | 'status' | 'note' | 'statementDay' | 'dueDay' | 'creditLimit'>>;

export async function updateDebt(driver: SqlDriver, id: string, patch: DebtPatch, now: string): Promise<void> {
  await updateRow(driver, 'debts', id, { ...patch, updatedAt: now });
}

/** The domain view of the open credit lines. */
export function creditLinesOf(debts: readonly DebtRecord[]): CreditLine[] {
  return debts
    .filter((d) => d.kind === 'credit_line' && d.status === 'open')
    .map((d) => ({ id: d.id, statementDay: d.statementDay ?? 1, dueDay: d.dueDay ?? 1, limit: d.creditLimit ?? null }));
}

/** The domain view of the installment loans (closed ones included: their history still counts). */
export function loansOf(debts: readonly DebtRecord[]): InstallmentLoan[] {
  return debts
    .filter((d) => d.kind === 'installment_loan')
    .map((d) => ({
      id: d.id,
      purpose: d.purpose,
      received: d.amountReceived ?? 0,
      installmentAmount: d.installmentAmount ?? 0,
      installmentCount: d.installmentCount ?? 1,
      frequency: d.frequency ?? 'monthly',
      startDate: d.startDate ?? d.firstDueDate ?? '',
      firstDueDate: d.firstDueDate ?? '',
    }));
}
