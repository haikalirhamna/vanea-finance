/** Opening the database: pragmas and migrations. */
import { SqlDriver, first } from './driver';
import { CURRENT_SCHEMA_VERSION, MIGRATIONS } from './schema';

export async function schemaVersion(driver: SqlDriver): Promise<number> {
  const row = await first<{ user_version: number }>(driver, 'PRAGMA user_version');
  return row?.user_version ?? 0;
}

/**
 * Applies every migration newer than the database, each in its own transaction.
 * A database from a newer app is refused rather than guessed at.
 */
export async function migrate(driver: SqlDriver): Promise<number> {
  const current = await schemaVersion(driver);
  if (current > CURRENT_SCHEMA_VERSION) {
    throw new Error(`This database is from a newer version of Vanea (schema ${current}).`);
  }
  for (const migration of MIGRATIONS.filter((m) => m.version > current)) {
    await driver.transaction(async () => {
      await driver.exec(migration.sql);
      await driver.exec(`PRAGMA user_version = ${migration.version}`);
    });
  }
  return CURRENT_SCHEMA_VERSION;
}

/** Foreign keys on, then migrations: the state every repository expects. */
export async function prepareDatabase(driver: SqlDriver): Promise<SqlDriver> {
  await driver.exec('PRAGMA foreign_keys = ON');
  await migrate(driver);
  return driver;
}
