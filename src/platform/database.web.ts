/** The web preview keeps data in memory only: it is for looking at the screens, not for real use. */
import { SqlDriver } from '@/data/driver';
import { prepareDatabase } from '@/data/database';
import { openMemoryDriver } from '@/data/driver-memory';

export async function openAppDatabase(): Promise<SqlDriver> {
  return prepareDatabase(await openMemoryDriver());
}

export const newId = (): string => globalThis.crypto.randomUUID();
export const randomBytes = (length: number): Uint8Array => globalThis.crypto.getRandomValues(new Uint8Array(length));
