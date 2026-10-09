import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { AddBusinessCostScreen } from '../AddBusinessCostScreen';
import { AddCreditLineScreen } from '../AddCreditLineScreen';
import { AddExpenseScreen } from '../AddExpenseScreen';
import { ActivityScreen } from '../ActivityScreen';
import { HomeScreen } from '../HomeScreen';
import { OnboardingScreen } from '../OnboardingScreen';
import { freezeToday, renderApp, transactionsOf } from './render-app';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({}),
}));

jest.setTimeout(30_000);
beforeAll(freezeToday);
afterAll(() => jest.useRealTimers());
beforeEach(() => mockBack.mockClear());

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
