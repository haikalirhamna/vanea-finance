import { allMovements, balanceOf } from '@/domain/ledger';
import { Transaction } from '@/domain/ledger-types';
import { businessCost, expense, income, opening, reversalOf, salaryPayment, subscriptionCost, tx } from '../../domain/__tests__/helpers/builders';
import { creditLinesOf, DebtRecord, insertDebt, loadDebts, loansOf, updateDebt } from '../debts';
import { first } from '../driver';
import { loadHistoricalMonths, replaceHistoricalMonths } from '../planning';
import { Profile, getProfile, insertProfile, updateProfile } from '../profile';
import { activeAdvanceId, insertAdvance, insertSalarySetting, loadAdvances, loadSalarySettings, updateAdvance } from '../salary';
import { loadSnapshot } from '../snapshot';
import { deleteSubscription, insertSubscription, loadSubscriptions, updateSubscription } from '../subscriptions';
import {
  insertTransactions, loadReplacements, loadTransactions, markReplaced, updateDescriptive,
} from '../transactions';
import { NOW, freshDatabase, seedParents } from './helpers';

const profile: Profile = {
  id: 'me', displayName: 'Haikal', paydayDay: 25, onboardedOn: '2026-01-01', calibrationUntilPeriod: '2026-03',
  bufferMonths: 3, appLockEnabled: true, createdAt: NOW, updatedAt: NOW,
  notify: { payday: true, subscriptions: true, debts: true, month: true, pressure: true, backup: true },
};

describe('profile', () => {
  it('round-trips, with booleans and optional fields', async () => {
    const driver = await freshDatabase();
    expect(await getProfile(driver)).toBeNull();
    await insertProfile(driver, profile);
    expect(await getProfile(driver)).toEqual(profile);
  });

  it('updates single settings and stamps the time', async () => {
    const driver = await freshDatabase();
    await insertProfile(driver, profile);
    await updateProfile(driver, 'me', { paydayDay: 1, appLockEnabled: false, lastExportAt: NOW, notify: { debts: false } }, '2026-10-10T00:00:00.000Z');
    const updated = await getProfile(driver);
    expect(updated).toMatchObject({ paydayDay: 1, appLockEnabled: false, lastExportAt: NOW, updatedAt: '2026-10-10T00:00:00.000Z' });
    expect(updated!.notify).toEqual({ ...profile.notify, debts: false });
  });

  it('only allows paydays 1 to 28 and IDR', async () => {
    const driver = await freshDatabase();
    await expect(insertProfile(driver, { ...profile, paydayDay: 29 })).rejects.toThrow();
    await insertProfile(driver, profile);
    await expect(driver.run("UPDATE profile SET currency = 'USD'")).rejects.toThrow();
    await expect(driver.run('UPDATE profile SET payday_day = 0')).rejects.toThrow();
  });
});

describe('transactions', () => {
  const batch = (): Transaction[] => [
    opening('pool', 5_000_000, '2026-01-01'),
    income(8_000_000, '2026-01-10'),
    salaryPayment(5_000_000, '2026-01', '2026-01-25', 0),
    tx('expense', 120_000, { expenseCategory: 'wants', paymentMethod: 'credit_line', debtId: 'line1', date: '2026-02-01', note: 'Headphones', label: 'Store' }),
    tx('loan_start', 3_000_000, { debtId: 'loan1', paymentMethod: 'installment', totalOwed: 3_300_000, destinationAccount: 'personal', date: '2026-02-02' }),
    tx('debt_payment', 550_000, { debtId: 'loan1', paymentMethod: 'installment', sourceAccount: 'personal', date: '2026-03-02' }),
    tx('investment_contribution', 1_000_000, { holdingId: 'h1', date: '2026-03-03' }),
    subscriptionCost(225_000, '2026-03-15', 'monthly'),
  ];

  it('round-trips every field, in recording order', async () => {
    const driver = await freshDatabase();
    await seedParents(driver);
    const written = batch();
    await driver.transaction(() => insertTransactions(driver, written, NOW));
    expect(await loadTransactions(driver)).toEqual(written);
  });

  it('stores the same movements the domain derives', async () => {
    const driver = await freshDatabase();
    await seedParents(driver);
    const written = batch();
    await driver.transaction(() => insertTransactions(driver, written, NOW));
    const stored = await driver.all<{ account: string; ref_id: string | null; amount: number; date: string }>('SELECT * FROM movements');
    const derived = allMovements(written);
    expect(stored).toHaveLength(derived.length);
    const total = (rows: { account: string; amount: number }[], account: string) => rows.filter((r) => r.account === account).reduce((t, r) => t + r.amount, 0);
    for (const account of ['pool', 'personal', 'savings', 'investment', 'bill_reserve', 'debt']) {
      expect(total(stored, account)).toBe(balanceOf(derived, account as never));
    }
    expect(stored.find((m) => m.account === 'debt' && m.ref_id === 'loan1')).toBeDefined();
  });

  it('writes a reversal using an original that is already stored', async () => {
    const driver = await freshDatabase();
    await seedParents(driver);
    const original = expense(300_000, '2026-02-05');
    await driver.transaction(() => insertTransactions(driver, [original], NOW));
    const reversal = reversalOf(original, '2026-02-06');
    await driver.transaction(() => insertTransactions(driver, [reversal], NOW));
    const rows = await driver.all<{ amount: number }>("SELECT amount FROM movements WHERE transaction_id = ?", [reversal.id]);
    expect(rows).toEqual([{ amount: 300_000 }]);
    expect((await loadTransactions(driver)).map((t) => t.kind)).toEqual(['expense', 'reversal']);
  });

  it('writes nothing when one transaction in the work fails', async () => {
    const driver = await freshDatabase();
    await expect(driver.transaction(async () => {
      await insertTransactions(driver, [income(1_000)], NOW);
      await insertTransactions(driver, [tx('expense', 5, { expenseCategory: 'needs', paymentMethod: 'credit_line', debtId: 'missing' })], NOW);
    })).rejects.toThrow();
    expect(await loadTransactions(driver)).toEqual([]);
    expect(await driver.all('SELECT * FROM movements')).toEqual([]);
  });

  it('records which transaction replaced which, and edits descriptive fields in place', async () => {
    const driver = await freshDatabase();
    const original = expense(100, '2026-02-05');
    const replacement = expense(150, '2026-02-05');
    await driver.transaction(async () => {
      await insertTransactions(driver, [original, reversalOf(original, '2026-02-06'), replacement], NOW);
      await markReplaced(driver, original.id, replacement.id, NOW);
      await updateDescriptive(driver, replacement.id, { note: 'Lunch', expenseCategory: 'wants' }, '2026-02-07T00:00:00.000Z');
    });
    expect(await loadReplacements(driver)).toEqual(new Map([[original.id, replacement.id]]));
    const edited = (await loadTransactions(driver)).find((t) => t.id === replacement.id)!;
    expect(edited).toMatchObject({ note: 'Lunch', expenseCategory: 'wants', amount: 150 });
    await updateDescriptive(driver, replacement.id, { note: null }, NOW);
    expect((await loadTransactions(driver)).find((t) => t.id === replacement.id)!.note).toBeUndefined();
  });
});

describe('what the database refuses', () => {
  it('a subscription cost without its billing cycle', async () => {
    const driver = await freshDatabase();
    const bad = tx('business_cost', 100, { businessCostCategory: 'subscription' });
    await expect(insertTransactions(driver, [bad], NOW)).rejects.toThrow();
    await expect(insertTransactions(driver, [businessCost(100)], NOW)).resolves.toBeUndefined();
  });

  it('reversing the same transaction twice', async () => {
    const driver = await freshDatabase();
    const original = income(100);
    await insertTransactions(driver, [original, reversalOf(original, '2026-02-01')], NOW);
    await expect(insertTransactions(driver, [reversalOf(original, '2026-02-02')], NOW)).rejects.toThrow(/UNIQUE/);
  });

  it('pointing at a debt, holding or advance that does not exist', async () => {
    const driver = await freshDatabase();
    const orphan = tx('debt_cost', 10, { debtId: 'nope', paymentMethod: 'installment', debtCostType: 'fee' });
    await expect(insertTransactions(driver, [orphan], NOW)).rejects.toThrow(/FOREIGN KEY/);
    await expect(insertTransactions(driver, [tx('investment_contribution', 10, { holdingId: 'nope' })], NOW)).rejects.toThrow(/FOREIGN KEY/);
  });

  it('amounts that are not positive, except the documented zero cases', async () => {
    const driver = await freshDatabase();
    await expect(insertTransactions(driver, [income(0)], NOW)).rejects.toThrow(/CHECK/);
    await expect(insertTransactions(driver, [salaryPayment(0, '2026-10', '2026-10-25', 0)], NOW)).rejects.toThrow(/CHECK/);
    await expect(insertTransactions(driver, [salaryPayment(0, '2026-10', '2026-10-25', 500_000)], NOW)).resolves.toBeUndefined();
    const original = income(100);
    await expect(insertTransactions(driver, [original, reversalOf(original, '2026-02-01', 0)], NOW)).resolves.toBeUndefined();
  });

  it('a sale or cash withdrawal without an explicit destination', async () => {
    const driver = await freshDatabase();
    await seedParents(driver);
    const sale = tx('investment_sale', 10, { holdingId: 'h1', costRemoved: 5 });
    // The database refuses the row (validateTransactions catches it earlier in the app)...
    await expect(insertTransactions(driver, [sale], NOW)).rejects.toThrow(/CHECK/);
    // ...whichever way it is written.
    await expect(driver.run(
      "INSERT INTO transactions (id, kind, date, amount, holding_id, cost_removed, created_at, updated_at) VALUES ('x', 'investment_sale', '2026-01-01', 10, 'h1', 5, ?, ?)",
      [NOW, NOW],
    )).rejects.toThrow(/CHECK/);
  });

  it('a second active salary advance', async () => {
    const driver = await freshDatabase();
    const advance = { id: 'a1', amount: 3_000_000, termPeriods: 3, installmentAmount: 1_000_000, firstPeriod: '2026-11', origin: 'manual' as const, status: 'active' as const };
    await insertAdvance(driver, advance, NOW);
    await expect(insertAdvance(driver, { ...advance, id: 'a2' }, NOW)).rejects.toThrow(/UNIQUE/);
    await updateAdvance(driver, 'a1', { status: 'repaid' }, NOW);
    await expect(insertAdvance(driver, { ...advance, id: 'a2' }, NOW)).resolves.toBeUndefined();
  });

  it('a salary increase without the review it came from', async () => {
    const driver = await freshDatabase();
    const setting = { id: 'x', amount: 5_000_000, effectivePeriod: '2026-02', changeType: 'increase' as const, createdAt: NOW };
    await expect(insertSalarySetting(driver, setting)).rejects.toThrow(/CHECK/);
  });
});

describe('salary', () => {
  it('keeps the salary history in order of effective period', async () => {
    const driver = await freshDatabase();
    await insertSalarySetting(driver, { id: 'b', amount: 4_000_000, effectivePeriod: '2026-05', changeType: 'decrease', createdAt: NOW });
    await insertSalarySetting(driver, { id: 'a', amount: 5_000_000, effectivePeriod: '2026-01', changeType: 'initial', recommendedAmount: 5_300_000, note: 'first', createdAt: NOW });
    expect(await loadSalarySettings(driver)).toEqual([
      { id: 'a', amount: 5_000_000, effectivePeriod: '2026-01', changeType: 'initial', recommendedAmount: 5_300_000, note: 'first', createdAt: NOW },
      { id: 'b', amount: 4_000_000, effectivePeriod: '2026-05', changeType: 'decrease', createdAt: NOW },
    ]);
  });

  it('stores advances and finds the active one', async () => {
    const driver = await freshDatabase();
    expect(await activeAdvanceId(driver)).toBeNull();
    await insertAdvance(driver, { id: 'a1', amount: 3_000_000, termPeriods: 3, installmentAmount: 1_000_000, firstPeriod: '2026-11', origin: 'income_reversal', originTransactionId: 'r1', status: 'active' }, NOW);
    expect(await activeAdvanceId(driver)).toBe('a1');
    await updateAdvance(driver, 'a1', { amount: 4_000_000, installmentAmount: 1_000_000 }, NOW);
    expect((await loadAdvances(driver))[0]).toMatchObject({ id: 'a1', amount: 4_000_000, origin: 'income_reversal', originTransactionId: 'r1' });
  });
});

describe('subscriptions', () => {
  const figma = { id: 's1', name: 'Figma', cycle: 'monthly' as const, nextBillingDate: '2026-11-15', prices: [{ price: 225_000, effectiveFrom: '2026-01-15' }] };

  it('round-trips with their price history', async () => {
    const driver = await freshDatabase();
    await driver.transaction(() => insertSubscription(driver, figma, NOW));
    expect(await loadSubscriptions(driver)).toEqual([figma]);
  });

  it('edits fields and replaces the price history', async () => {
    const driver = await freshDatabase();
    await driver.transaction(() => insertSubscription(driver, figma, NOW));
    const prices = [...figma.prices, { price: 252_000, effectiveFrom: '2026-06-15' }];
    await driver.transaction(() => updateSubscription(driver, 's1', { name: 'Figma Pro', cycle: 'yearly', prices, note: 'team plan' }, NOW));
    expect((await loadSubscriptions(driver))[0]).toEqual({ ...figma, name: 'Figma Pro', cycle: 'yearly', prices, note: 'team plan' });
  });

  it('can always be deleted: recorded costs keep their label and lose only the link', async () => {
    const driver = await freshDatabase();
    await driver.transaction(() => insertSubscription(driver, figma, NOW));
    const cost = { ...subscriptionCost(225_000, '2026-02-15', 'monthly'), subscriptionId: 's1', label: 'Figma' };
    await insertTransactions(driver, [cost], NOW);
    await deleteSubscription(driver, 's1');
    expect(await loadSubscriptions(driver)).toEqual([]);
    expect(await first(driver, 'SELECT * FROM subscription_prices')).toBeNull();
    const kept = (await loadTransactions(driver))[0]!;
    expect(kept.label).toBe('Figma');
    expect(kept.subscriptionId).toBeUndefined();
  });
});

describe('debts', () => {
  const payLater: DebtRecord = { id: 'paylater', kind: 'credit_line', name: 'PayLater', type: 'paylater', purpose: 'personal', statementDay: 5, dueDay: 25, creditLimit: 5_000_000, origin: 'manual', status: 'open' };
  const kredivo: DebtRecord = {
    id: 'kredivo', kind: 'installment_loan', name: 'Kredivo', type: 'online_loan', purpose: 'personal', amountReceived: 3_000_000,
    installmentAmount: 550_000, installmentCount: 6, frequency: 'monthly', startDate: '2026-09-02', firstDueDate: '2026-10-02', ojkRegistered: 'yes', origin: 'manual', status: 'open',
  };

  it('round-trips credit lines and loans', async () => {
    const driver = await freshDatabase();
    await insertDebt(driver, payLater, NOW);
    await insertDebt(driver, kredivo, NOW);
    expect(await loadDebts(driver)).toEqual([payLater, kredivo]);
  });

  it('refuses a loan without its terms', async () => {
    const driver = await freshDatabase();
    await expect(insertDebt(driver, { ...kredivo, installmentAmount: undefined }, NOW)).rejects.toThrow(/CHECK/);
  });

  it('presents debts to the domain, leaving closed credit lines out', async () => {
    const closed = { ...payLater, id: 'old', status: 'closed' as const };
    expect(creditLinesOf([payLater, closed, kredivo])).toEqual([{ id: 'paylater', statementDay: 5, dueDay: 25, limit: 5_000_000 }]);
    expect(loansOf([payLater, kredivo])).toEqual([{
      id: 'kredivo', purpose: 'personal', received: 3_000_000, installmentAmount: 550_000, installmentCount: 6,
      frequency: 'monthly', startDate: '2026-09-02', firstDueDate: '2026-10-02',
    }]);
  });

  it('closes a debt', async () => {
    const driver = await freshDatabase();
    await insertDebt(driver, payLater, NOW);
    await updateDebt(driver, 'paylater', { status: 'closed' }, NOW);
    expect((await loadDebts(driver))[0]!.status).toBe('closed');
  });
});

describe('history and snapshot', () => {
  it('replaces the historical months as a whole', async () => {
    const driver = await freshDatabase();
    await replaceHistoricalMonths(driver, [{ month: '2026-08', amount: 4_000_000 }, { month: '2026-09', amount: 0 }], NOW);
    await replaceHistoricalMonths(driver, [{ month: '2026-09', amount: 5_000_000 }], NOW);
    expect(await loadHistoricalMonths(driver)).toEqual([{ month: '2026-09', amount: 5_000_000 }]);
  });

  it('loads everything at once', async () => {
    const driver = await freshDatabase();
    await insertProfile(driver, profile);
    await replaceHistoricalMonths(driver, [{ month: '2026-09', amount: 5_000_000 }], NOW);
    await insertSalarySetting(driver, { id: 'a', amount: 5_000_000, effectivePeriod: '2026-01', changeType: 'initial', createdAt: NOW });
    await insertTransactions(driver, [income(1_000)], NOW);
    const snapshot = await loadSnapshot(driver);
    expect(snapshot.profile?.id).toBe('me');
    expect(snapshot.transactions).toHaveLength(1);
    expect(snapshot.historicalMonths).toHaveLength(1);
    expect(snapshot.salarySettings).toHaveLength(1);
    expect(snapshot.advances).toEqual([]);
    expect(snapshot.subscriptions).toEqual([]);
    expect(snapshot.debts).toEqual([]);
  });
});
