import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { AddBusinessCostScreen } from '../AddBusinessCostScreen';
import { SalaryScreen } from '../SalaryScreen';
import { ChangeSalaryScreen } from '../ChangeSalaryScreen';
import { recordIncome } from '@/features/income/income-actions';
import { IntentionScreen } from '../IntentionScreen';
import { ReflectionScreen } from '../ReflectionScreen';
import { paySalary } from '@/features/salary/salary-actions';
import { recordExpense } from '@/features/spending/spending-actions';
import { AddSubscriptionScreen } from '../AddSubscriptionScreen';
import { SubscriptionDetailScreen } from '../SubscriptionDetailScreen';
import { addSubscription } from '@/features/subscriptions/subscription-actions';
import { AdvanceScreen } from '../AdvanceScreen';
import { SavingsScreen } from '../SavingsScreen';
import { AddCreditLineScreen } from '../AddCreditLineScreen';
import { AddExpenseScreen } from '../AddExpenseScreen';
import { ActivityScreen } from '../ActivityScreen';
import { HomeScreen } from '../HomeScreen';
import { OnboardingScreen } from '../OnboardingScreen';
import { freezeToday, renderApp, transactionsOf } from './render-app';

const mockBack = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
}));

jest.setTimeout(30_000);
beforeAll(freezeToday);
afterAll(() => jest.useRealTimers());
beforeEach(() => { mockBack.mockClear(); mockParams = {}; });

describe('Home', () => {
  it('shows what can be spent today', async () => {
    await renderApp(<HomeScreen />);
    expect(await screen.findByText('Rp 4.250.000')).toBeTruthy();
    expect(screen.getByText(/a day until 25 Oct/)).toBeTruthy();
    expect(screen.getByText('Pool')).toBeTruthy();
  });
});

describe('Add expense', () => {
  it('cannot be saved until an amount and a category are chosen', async () => {
    await renderApp(<AddExpenseScreen />);
    const save = await screen.findByRole('button', { name: 'Save expense' });
    expect(save.props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(screen.getByLabelText('Amount'), '45000');
    expect(screen.getByRole('button', { name: 'Save expense' }).props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByRole('radio', { name: 'Needs' }));
    expect(screen.getByRole('button', { name: 'Save expense' }).props.accessibilityState.disabled).toBeFalsy();
  });

  it('records the expense and closes', async () => {
    const { driver } = await renderApp(<AddExpenseScreen />);
    fireEvent.changeText(await screen.findByLabelText('Amount'), '45000');
    fireEvent.press(screen.getByRole('radio', { name: 'Wants' }));
    fireEvent.press(screen.getByRole('button', { name: 'Save expense' }));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    const saved = (await transactionsOf(driver)).filter((tx) => tx.kind === 'expense');
    expect(saved).toMatchObject([{ amount: 45_000, expenseCategory: 'wants' }]);
  });
});

describe('Business cost', () => {
  it('asks how a subscription is billed and has no default', async () => {
    await renderApp(<AddBusinessCostScreen />);
    fireEvent.changeText(await screen.findByLabelText('Amount'), '1200000');
    fireEvent.press(screen.getByRole('radio', { name: 'Subscription' }));
    expect(screen.getByText('How often is it billed?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save cost' }).props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByRole('radio', { name: 'Yearly' }));
    expect(screen.getByText(/Spread over 12 months: about Rp 100.000/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save cost' }).props.accessibilityState.disabled).toBeFalsy();
  });
});

describe('Activity', () => {
  it('lists records, newest first, with plain names', async () => {
    await renderApp(<ActivityScreen />);
    expect(await screen.findByText('Starting balance · Pool')).toBeTruthy();
    expect(screen.getByText('Starting balance · Savings')).toBeTruthy();
  });
});

describe('Onboarding', () => {
  it('needs a valid payday before it continues', async () => {
    await renderApp(<OnboardingScreen />, { onboarded: false });
    fireEvent.press(await screen.findByRole('button', { name: 'Get started' }));
    const next = () => screen.getByRole('button', { name: 'Continue' });
    expect(next().props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(screen.getByLabelText('Day of the month (1–28)'), '31');
    expect(next().props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(screen.getByLabelText('Day of the month (1–28)'), '25');
    expect(next().props.accessibilityState.disabled).toBe(false);
  });
});

describe('Credit lines', () => {
  it('saves a PayLater and offers it as a way to pay', async () => {
    const { driver } = await renderApp(<AddCreditLineScreen />);
    fireEvent.press(await screen.findByRole('radio', { name: 'PayLater' }));
    fireEvent.changeText(screen.getByLabelText('Name'), 'ShopeePayLater');
    fireEvent.changeText(screen.getByLabelText('Statement day (1–31)'), '20');
    fireEvent.changeText(screen.getByLabelText('Due day (1–31)'), '5');
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    const debts = await driver.all<{ name: string; kind: string }>('SELECT name, kind FROM debts');
    expect(debts).toEqual([{ name: 'ShopeePayLater', kind: 'credit_line' }]);
  });
});

const STEADY_3M = Array.from({ length: 12 }, (_, i) => ({
  month: `${i < 3 ? 2025 : 2026}-${String(((i + 9) % 12) + 1).padStart(2, '0')}`, amount: 3_000_000,
}));

describe('Salary review', () => {
  const raiseEligible = {
    onboarding: { historical: STEADY_3M, salary: 2_500_000 },
    today: '2027-05-10',
    async prepare(ctx: Parameters<NonNullable<Parameters<typeof renderApp>[1]>['prepare'] & {}>[0], setToday: (d: string) => void) {
      for (const month of ['2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04']) {
        setToday(`${month}-20`);
        await recordIncome(ctx, { amount: month < '2027-01' ? 3_000_000 : 4_500_000 });
      }
      setToday('2027-05-10');
    },
  };

  it('offers keeping, a smaller raise and the maximum as equal choices, and applies the raise', async () => {
    const { driver } = await renderApp(<SalaryScreen />, raiseEligible);
    expect(await screen.findByText('Your income has moved up and held there.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Keep Rp 2.500.000' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Choose a smaller increase' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Increase to Rp 2.620.000' }));
    await waitFor(async () => {
      const rows = await driver.all<{ amount: number; change_type: string }>('SELECT amount, change_type FROM salary_settings ORDER BY rowid');
      expect(rows.at(-1)).toEqual({ amount: 2_620_000, change_type: 'increase' });
    });
  });

  it('explains without a button when no raise is possible', async () => {
    await renderApp(<SalaryScreen />, { today: '2026-11-02' });
    expect(await screen.findByText(/We need at least 6 months|Your salary changed recently/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Increase to/ })).toBeNull();
  });
});

describe('Change salary', () => {
  it('shows what a lower salary does to the Pool before confirming', async () => {
    const { driver } = await renderApp(<ChangeSalaryScreen />, { today: '2026-11-02' });
    fireEvent.changeText(await screen.findByLabelText('New salary'), '3500000');
    expect(await screen.findByText('Pool would last')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Decrease salary' }));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    const rows = await driver.all<{ amount: number; change_type: string }>('SELECT amount, change_type FROM salary_settings ORDER BY rowid');
    expect(rows.at(-1)).toEqual({ amount: 3_500_000, change_type: 'decrease' });
  });
});

describe('Intention and reflection', () => {
  it('saves this month\'s intention, allowing 0', async () => {
    const { driver } = await renderApp(<IntentionScreen />);
    expect(screen.getByRole('button', { name: 'Save intention' }).props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(await screen.findByLabelText('Set aside'), '0');
    fireEvent.press(screen.getByRole('button', { name: 'Save intention' }));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(await driver.all('SELECT month, set_aside_amount FROM monthly_intentions')).toEqual([{ month: '2026-10', set_aside_amount: 0 }]);
  });

  it('shows last month\'s numbers, saves notes, and then reads back as history', async () => {
    mockParams = { month: '2026-10' };
    const { driver } = await renderApp(<ReflectionScreen />, {
      today: '2026-11-03',
      async prepare(ctx, setToday) {
        setToday('2026-10-26');
        await paySalary(ctx, { amount: 4_700_000 });
        setToday('2026-10-28');
        await recordExpense(ctx, { amount: 300_000, category: 'needs', date: '2026-10-27' });
        setToday('2026-11-03');
      },
    });
    expect(await screen.findByText('October reflection')).toBeTruthy();
    expect(screen.getByLabelText('Needs, Rp 300.000')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('How can I improve?'), 'Cook more');
    fireEvent.press(screen.getByRole('button', { name: 'Save reflection' }));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(await driver.all('SELECT month, improve_note FROM reflections')).toEqual([{ month: '2026-10', improve_note: 'Cook more' }]);
  });
});

describe('Subscriptions', () => {
  it('asks how it is billed, with no default, and saves', async () => {
    const { driver } = await renderApp(<AddSubscriptionScreen />);
    fireEvent.changeText(await screen.findByLabelText('Name'), 'Figma');
    fireEvent.changeText(screen.getByLabelText('Price'), '225000');
    expect(screen.getByRole('button', { name: 'Save subscription' }).props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByRole('radio', { name: 'Monthly' }));
    fireEvent.press(screen.getByRole('button', { name: 'Save subscription' }));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(await driver.all('SELECT name, billing_cycle FROM subscriptions')).toEqual([{ name: 'Figma', billing_cycle: 'monthly' }]);
  });

  it('asks "Did the price change?" when a different amount is charged', async () => {
    let id = '';
    const { driver } = await renderApp(<SubscriptionDetailScreen />, {
      async prepare(ctx) {
        const added = await addSubscription(ctx, { name: 'Figma', cycle: 'monthly', price: 225_000, nextBillingDate: '2026-10-09' });
        id = added.ok ? added.value.id : '';
        mockParams = { id };
      },
    });
    fireEvent.press(await screen.findByRole('button', { name: 'Record billing' }));
    fireEvent.changeText(await screen.findByLabelText('Amount charged'), '250000');
    expect(await screen.findByText('Did the price change?')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Record billing' }).at(-1)!.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByRole('radio', { name: 'From now on' }));
    fireEvent.press(screen.getAllByRole('button', { name: 'Record billing' }).at(-1)!);
    // The billing date is the day the price was saved, so the new price replaces it.
    await waitFor(async () => expect(await driver.all('SELECT price FROM subscription_prices')).toEqual([{ price: 250_000 }]));
  });
});

describe('Advance and savings', () => {
  it('shows what an advance does to the next salaries before taking it', async () => {
    const { driver } = await renderApp(<AdvanceScreen />, { today: '2026-10-25' });
    fireEvent.changeText(await screen.findByLabelText('Amount'), '3000000');
    expect(screen.getByText('Rp 3.000.000 now. Your next 3 salaries will be Rp 1.000.000 lower.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Take advance' }));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(await driver.all('SELECT amount, installment_amount FROM salary_advances')).toEqual([{ amount: 3_000_000, installment_amount: 1_000_000 }]);
  });

  it('sets money aside from Available Spending', async () => {
    const { driver } = await renderApp(<SavingsScreen />);
    fireEvent.press(await screen.findByRole('button', { name: 'Set aside' }));
    fireEvent.changeText(await screen.findByLabelText('Amount'), '500000');
    fireEvent.press(screen.getAllByRole('button', { name: 'Set aside' }).at(-1)!);
    await waitFor(async () => expect(await driver.all("SELECT amount FROM transactions WHERE kind = 'savings_deposit'")).toEqual([{ amount: 500_000 }]));
  });
});
