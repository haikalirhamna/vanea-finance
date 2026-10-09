import { balanceOf } from '@/domain/ledger';
import { allMovements } from '@/domain/ledger-movements';
import { expense, income, opening, reversalOf, salaryPayment, tx } from '../../domain/__tests__/helpers/builders';
import { decryptBackup, encryptBackup } from '../backup-crypto';
import {
  BackupPayload, InvalidPayloadError, exportPayload, importPayload, parsePayload, summarize, verifyBalances,
} from '../backup';
import { insertDebt } from '../debts';
import { loadHistoricalMonths, replaceHistoricalMonths } from '../planning';
import { insertProfile } from '../profile';
import { insertSalarySetting } from '../salary';
import { insertSubscription } from '../subscriptions';
import { insertTransactions, loadReplacements, loadTransactions, markReplaced } from '../transactions';
import { loadSnapshot } from '../snapshot';
import { NOW, freshDatabase } from './helpers';

async function populated() {
  const driver = await freshDatabase();
  await insertProfile(driver, {
    id: 'me', paydayDay: 25, onboardedOn: '2026-01-01', calibrationUntilPeriod: '2026-03', bufferMonths: 3, appLockEnabled: true,
    createdAt: NOW, updatedAt: NOW, notify: { payday: true, subscriptions: true, debts: true, month: true, pressure: true, backup: true },
  });
  await replaceHistoricalMonths(driver, [{ month: '2025-12', amount: 4_000_000 }], NOW);
  await insertSalarySetting(driver, { id: 's', amount: 5_000_000, effectivePeriod: '2026-01', changeType: 'initial', createdAt: NOW });
  await driver.transaction(() => insertSubscription(driver, { id: 'sub', name: 'Figma', cycle: 'monthly', nextBillingDate: '2026-11-15', prices: [{ price: 225_000, effectiveFrom: '2026-01-15' }] }, NOW));
  await insertDebt(driver, { id: 'line1', kind: 'credit_line', name: 'PayLater', type: 'paylater', purpose: 'personal', statementDay: 5, dueDay: 25, origin: 'manual', status: 'open' }, NOW);
  const wrong = expense(100_000, '2026-02-05');
  const fixed = expense(150_000, '2026-02-05');
  await driver.transaction(async () => {
    await insertTransactions(driver, [
      opening('pool', 1_000_000), income(8_000_000, '2026-01-10'), salaryPayment(5_000_000, '2026-01', '2026-01-25', 0),
      tx('expense', 200_000, { expenseCategory: 'wants', paymentMethod: 'credit_line', debtId: 'line1', date: '2026-02-01' }),
      wrong, reversalOf(wrong, '2026-02-06'), fixed,
    ], NOW);
    await markReplaced(driver, wrong.id, fixed.id, NOW);
  });
  return driver;
}

const META = { exportedAt: '2026-10-09T08:00:00.000Z', appVersion: '0.1.0' };

describe('export and import', () => {
  it('restores everything into a fresh database, including replacements', async () => {
    const source = await populated();
    const payload = await exportPayload(source, META);
    const target = await freshDatabase();
    await importPayload(target, parsePayload(JSON.stringify(payload)));
    expect(await loadSnapshot(target)).toEqual(await loadSnapshot(source));
    expect(await loadReplacements(target)).toEqual(await loadReplacements(source));
  });

  it('replaces data that was already there instead of merging', async () => {
    const source = await populated();
    const target = await populated();
    await insertTransactions(target, [income(99_999_999, '2026-03-01')], NOW);
    await importPayload(target, await exportPayload(source, META));
    const money = (await loadTransactions(target)).map((t) => t.amount);
    expect(money).not.toContain(99_999_999);
    expect(await loadTransactions(target)).toEqual(await loadTransactions(source));
    expect(await loadHistoricalMonths(target)).toHaveLength(1);
  });

  it('keeps balances identical after a restore', async () => {
    const source = await populated();
    const target = await freshDatabase();
    await importPayload(target, await exportPayload(source, META));
    const pool = async (d: typeof source) => balanceOf(allMovements(await loadTransactions(d)), 'pool');
    expect(await pool(target)).toBe(await pool(source));
  });

  it('works through the encrypted file', async () => {
    const source = await populated();
    const payload = await exportPayload(source, META);
    const sealed = encryptBackup(JSON.stringify(payload), 'correct horse battery', { salt: new Uint8Array(16).fill(3), nonce: new Uint8Array(24).fill(5) }, { n: 1_024, r: 8, p: 1 });
    const target = await freshDatabase();
    await importPayload(target, parsePayload(decryptBackup(sealed, 'correct horse battery')));
    expect(await loadSnapshot(target)).toEqual(await loadSnapshot(source));
  });
});

describe('summary', () => {
  it('shows counts, the date range and balances recomputed from the transactions', async () => {
    const payload = await exportPayload(await populated(), META);
    const summary = summarize(payload);
    expect(summary.counts.transactions).toBe(7);
    expect(summary.counts.subscriptions).toBe(1);
    expect(summary.firstTransactionDate).toBe('2026-01-01');
    expect(summary.lastTransactionDate).toBe('2026-02-06'); // the reversal
    expect(summary.balances.pool).toBe(1_000_000 + 8_000_000 - 5_000_000);
    expect(summary.exportedAt).toBe(META.exportedAt);
  });

  it('has no dates for an empty database', async () => {
    const summary = summarize(await exportPayload(await freshDatabase(), META));
    expect(summary).toMatchObject({ firstTransactionDate: null, lastTransactionDate: null, balances: { pool: 0, personal: 0, savings: 0 } });
  });
});

describe('what an import refuses', () => {
  const valid = async (): Promise<BackupPayload> => exportPayload(await populated(), META);

  it('text that is not a backup, or from another version', async () => {
    expect(() => parsePayload('nonsense')).toThrow(InvalidPayloadError);
    expect(() => parsePayload('{"format":"x"}')).toThrow(/unknown data format/);
    const payload = await valid();
    expect(() => parsePayload(JSON.stringify({ ...payload, schemaVersion: 99 }))).toThrow(/newer version/);
    expect(() => parsePayload(JSON.stringify({ ...payload, schemaVersion: 0 }))).toThrow(/older version/);
    const withoutTransactions: Partial<typeof payload.data> = { ...payload.data };
    delete withoutTransactions.transactions;
    expect(() => parsePayload(JSON.stringify({ ...payload, data: withoutTransactions }))).toThrow(/transactions data is missing/);
  });

  it('balances that do not add up, before touching any data', async () => {
    const target = await populated();
    const before = await loadSnapshot(target);
    const payload = await valid();
    payload.data.movements[0]!.amount = Number(payload.data.movements[0]!.amount) + 1;
    expect(() => verifyBalances(payload)).toThrow(/does not add up/);
    await expect(importPayload(target, payload)).rejects.toThrow(InvalidPayloadError);
    expect(await loadSnapshot(target)).toEqual(before);
  });

  it('a payload that fails halfway, leaving the current data untouched', async () => {
    const target = await populated();
    const before = await loadSnapshot(target);
    const payload = await valid();
    payload.data.transactions[2] = { ...payload.data.transactions[2]!, kind: 'not_a_kind' };
    await expect(importPayload(target, payload)).rejects.toThrow();
    expect(await loadSnapshot(target)).toEqual(before);
  });
});
