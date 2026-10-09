/** SQLite on the phone: expo-sqlite built with SQLCipher (app.config.js `useSQLCipher`). */
import * as SQLite from 'expo-sqlite';
import { SqlDriver, SqlValue } from './driver';

const SELECT_CHECK = 'SELECT count(*) AS n FROM sqlite_master';

/** Serializes transactions: expo-sqlite's transactions are not exclusive on a shared connection. */
function createQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const next = tail.then(task, task);
    tail = next.catch(() => undefined);
    return next;
  };
}

function wrap(db: SQLite.SQLiteDatabase): SqlDriver {
  const enqueue = createQueue();
  return {
    exec: (sql) => db.execAsync(sql),
    run: async (sql, params = []) => {
      await db.runAsync(sql, [...params] as SQLite.SQLiteBindValue[]);
    },
    all: <T>(sql: string, params: readonly SqlValue[] = []) =>
      db.getAllAsync<T>(sql, [...params] as SQLite.SQLiteBindValue[]),
    transaction: <T>(work: () => Promise<T>) =>
      enqueue(async () => {
        let result!: T;
        await db.withTransactionAsync(async () => {
          result = await work();
        });
        return result;
      }),
    close: () => db.closeAsync(),
  };
}

export class WrongKeyError extends Error {
  constructor() {
    super('The database could not be opened with this key.');
    this.name = 'WrongKeyError';
  }
}

/**
 * Opens the encrypted database. `keyHex` is the 256-bit key as 64 hex characters,
 * given to SQLCipher as a raw key so no passphrase stretching is involved.
 */
export async function openEncryptedDriver(name: string, keyHex: string): Promise<SqlDriver> {
  if (!/^[0-9a-f]{64}$/i.test(keyHex)) throw new Error('The database key must be 64 hex characters');
  const db = await SQLite.openDatabaseAsync(name);
  await db.execAsync(`PRAGMA key = "x'${keyHex}'";`);
  try {
    await db.getFirstAsync(SELECT_CHECK);
  } catch {
    await db.closeAsync();
    throw new WrongKeyError();
  }
  return wrap(db);
}
