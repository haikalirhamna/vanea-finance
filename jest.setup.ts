// Native modules without a JS implementation are stubbed for component tests.
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// The phone-only database opener is replaced by an in-memory one (see src/screens/__tests__/render-app.tsx).
jest.mock('@/platform/database', () => {
  let counter = 0;
  return {
    newId: () => `ui-${++counter}`,
    randomBytes: (length: number) => new Uint8Array(length),
    openAppDatabase: jest.fn(),
  };
});

jest.mock('@/platform/lock', () => ({ authenticate: jest.fn(async () => true), lockAvailable: jest.fn(async () => true) }));
