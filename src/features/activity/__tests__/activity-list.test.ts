import { activityItems } from '../activity-list';
import { Transaction } from '@/domain/ledger-types';

const income: Transaction = { id: 'a', kind: 'income', date: '2026-10-01', amount: 5_000_000, source: 'Client X' };
const expense: Transaction = { id: 'b', kind: 'expense', date: '2026-10-05', amount: 40_000, expenseCategory: 'needs', note: 'Lunch' };

describe('activityItems', () => {
  it('lists newest first with plain titles', () => {
    const items = activityItems([income, expense]);
    expect(items.map((i) => i.id)).toEqual(['b', 'a']);
    expect(items[0]).toMatchObject({ title: 'Lunch', subtitle: 'Needs', direction: 'out', editable: true, removable: true });
    expect(items[1]).toMatchObject({ title: 'Client X', direction: 'in' });
  });

  it('leaves out reversed records and the reversals themselves', () => {
    const reversal: Transaction = { id: 'r', kind: 'reversal', date: '2026-10-06', amount: 40_000, reversesId: 'b' };
    expect(activityItems([income, expense, reversal]).map((i) => i.id)).toEqual(['a']);
  });

  it('does not offer to change a starting balance', () => {
    const opening: Transaction = { id: 'o', kind: 'opening_balance', date: '2026-10-01', amount: 1, account: 'pool' };
    expect(activityItems([opening])[0]).toMatchObject({ title: 'Starting balance · Pool', editable: false, removable: false });
  });

  it('describes subscriptions with their billing cycle', () => {
    const sub: Transaction = { id: 's', kind: 'business_cost', date: '2026-10-02', amount: 1, businessCostCategory: 'subscription', billingCycle: 'yearly', label: 'Figma' };
    expect(activityItems([sub])[0]).toMatchObject({ title: 'Figma', subtitle: 'Yearly · Figma' });
  });
});
