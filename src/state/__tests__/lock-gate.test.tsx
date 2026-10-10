import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { authenticate } from '@/platform/lock';
import { freezeToday, renderApp } from '../../screens/__tests__/render-app';
import { LockGate } from '../LockGate';

const authenticateMock = authenticate as jest.Mock;

jest.setTimeout(30_000);
beforeAll(freezeToday);
afterAll(() => jest.useRealTimers());
beforeEach(() => authenticateMock.mockReset());

describe('LockGate', () => {
  it('keeps the app hidden until the owner authenticates', async () => {
    authenticateMock.mockResolvedValueOnce(false).mockResolvedValue(true);
    await renderApp(<LockGate><Text>Secret numbers</Text></LockGate>);
    expect(await screen.findByText('Vanea is locked')).toBeTruthy();
    expect(screen.queryByText('Secret numbers')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Unlock' }));
    expect(await screen.findByText('Secret numbers')).toBeTruthy();
  });

  it('opens straight away when the first prompt succeeds', async () => {
    authenticateMock.mockResolvedValue(true);
    await renderApp(<LockGate><Text>Secret numbers</Text></LockGate>);
    await waitFor(() => expect(screen.getByText('Secret numbers')).toBeTruthy());
  });

  it('does not lock before onboarding, so the first run is not blocked', async () => {
    authenticateMock.mockResolvedValue(false);
    await renderApp(<LockGate><Text>Welcome</Text></LockGate>, { onboarded: false });
    expect(await screen.findByText('Welcome')).toBeTruthy();
    expect(authenticateMock).not.toHaveBeenCalled();
  });
});
