/** Opens the encrypted database on the phone. The key is random, made once, and kept in the Android Keystore. */
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { SqlDriver } from '@/data/driver';
import { openEncryptedDriver } from '@/data/driver-expo';
import { prepareDatabase } from '@/data/database';

const KEY_NAME = 'vanea.db.key';
const DB_NAME = 'vanea.db';
const KEY_BYTES = 32;

const toHex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

async function databaseKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY_NAME);
  if (existing) return existing;
  const fresh = toHex(Crypto.getRandomBytes(KEY_BYTES));
  await SecureStore.setItemAsync(KEY_NAME, fresh);
  return fresh;
}

export async function openAppDatabase(): Promise<SqlDriver> {
  return prepareDatabase(await openEncryptedDriver(DB_NAME, await databaseKey()));
}

export const newId = (): string => Crypto.randomUUID();
export const randomBytes = (length: number): Uint8Array => Crypto.getRandomBytes(length);
