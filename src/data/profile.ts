/** The single profile row and the settings kept on it (SCHEMA §3.1). */
import { Month, DateString } from '@/domain/calendar';
import { SqlDriver, first } from './driver';
import { Row, fromRow, insertRow, updateRow } from './rows';

export interface NotificationSettings {
  payday: boolean;
  subscriptions: boolean;
  debts: boolean;
  month: boolean;
  pressure: boolean;
  backup: boolean;
}

export interface Profile {
  id: string;
  displayName?: string;
  paydayDay: number;
  onboardedOn: DateString;
  calibrationUntilPeriod: Month;
  bufferMonths: number;
  appLockEnabled: boolean;
  notify: NotificationSettings;
  lastExportAt?: string;
  createdAt: string;
  updatedAt: string;
}

const NOTIFY_KEYS = ['payday', 'subscriptions', 'debts', 'month', 'pressure', 'backup'] as const;

function rowOf(profile: Profile): object {
  const { notify, ...rest } = profile;
  const notifyColumns = Object.fromEntries(NOTIFY_KEYS.map((key) => [`notify${key[0]!.toUpperCase()}${key.slice(1)}`, notify[key]]));
  return { ...rest, currency: 'IDR', ...notifyColumns };
}

function profileOf(row: Row): Profile {
  const flat = fromRow<Record<string, string | number>>(row);
  const notify = Object.fromEntries(
    NOTIFY_KEYS.map((key) => [key, flat[`notify${key[0]!.toUpperCase()}${key.slice(1)}`] === 1]),
  ) as unknown as NotificationSettings;
  return {
    id: String(flat.id),
    ...(flat.displayName !== undefined ? { displayName: String(flat.displayName) } : {}),
    paydayDay: Number(flat.paydayDay),
    onboardedOn: String(flat.onboardedOn),
    calibrationUntilPeriod: String(flat.calibrationUntilPeriod),
    bufferMonths: Number(flat.bufferMonths),
    appLockEnabled: flat.appLockEnabled === 1,
    notify,
    ...(flat.lastExportAt !== undefined ? { lastExportAt: String(flat.lastExportAt) } : {}),
    createdAt: String(flat.createdAt),
    updatedAt: String(flat.updatedAt),
  };
}

export async function getProfile(driver: SqlDriver): Promise<Profile | null> {
  const row = await first(driver, 'SELECT * FROM profile LIMIT 1');
  return row ? profileOf(row) : null;
}

export async function insertProfile(driver: SqlDriver, profile: Profile): Promise<void> {
  await insertRow(driver, 'profile', rowOf(profile));
}

export type ProfilePatch = Partial<Pick<Profile, 'displayName' | 'paydayDay' | 'bufferMonths' | 'appLockEnabled' | 'lastExportAt'>> & {
  notify?: Partial<NotificationSettings>;
};

export async function updateProfile(driver: SqlDriver, id: string, patch: ProfilePatch, now: string): Promise<void> {
  const { notify, ...rest } = patch;
  const notifyColumns = Object.fromEntries(
    Object.entries(notify ?? {}).map(([key, value]) => [`notify${key[0]!.toUpperCase()}${key.slice(1)}`, value]),
  );
  await updateRow(driver, 'profile', id, { ...rest, ...notifyColumns, updatedAt: now });
}
