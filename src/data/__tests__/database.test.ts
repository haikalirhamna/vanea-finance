import { migrate, prepareDatabase, schemaVersion } from '../database';
import { first } from '../driver';
import { openMemoryDriver } from '../driver-memory';
import { CURRENT_SCHEMA_VERSION, TABLES_IN_RESTORE_ORDER } from '../schema';

describe('migrations', () => {
  it('create every table and record the schema version', async () => {
    const driver = await openMemoryDriver();
    expect(await schemaVersion(driver)).toBe(0);
    await migrate(driver);
    expect(await schemaVersion(driver)).toBe(CURRENT_SCHEMA_VERSION);
    const tables = (await driver.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")).map((r) => r.name);
    for (const table of TABLES_IN_RESTORE_ORDER) expect(tables).toContain(table);
  });

  it('are safe to run again', async () => {
    const driver = await prepareDatabase(await openMemoryDriver());
    await expect(migrate(driver)).resolves.toBe(CURRENT_SCHEMA_VERSION);
  });

  it('refuse a database from a newer app', async () => {
    const driver = await openMemoryDriver();
    await driver.exec(`PRAGMA user_version = ${CURRENT_SCHEMA_VERSION + 1}`);
    await expect(migrate(driver)).rejects.toThrow(/newer version/);
  });

  it('turn foreign keys on', async () => {
    const driver = await prepareDatabase(await openMemoryDriver());
    expect((await first<{ foreign_keys: number }>(driver, 'PRAGMA foreign_keys'))?.foreign_keys).toBe(1);
  });
});

describe('the driver', () => {
  it('rolls a transaction back when the work fails, and commits when it succeeds', async () => {
    const driver = await openMemoryDriver();
    await driver.exec('CREATE TABLE t (n INTEGER)');
    await expect(driver.transaction(async () => {
      await driver.run('INSERT INTO t VALUES (1)');
      throw new Error('boom');
    })).rejects.toThrow('boom');
    expect(await driver.all('SELECT * FROM t')).toEqual([]);
    await driver.transaction(async () => driver.run('INSERT INTO t VALUES (2)'));
    expect(await driver.all('SELECT n FROM t')).toEqual([{ n: 2 }]);
  });

  it('refuses nested transactions', async () => {
    const driver = await openMemoryDriver();
    await expect(driver.transaction(() => driver.transaction(async () => undefined))).rejects.toThrow(/nested/);
  });

  it('binds parameters and returns null for missing values', async () => {
    const driver = await openMemoryDriver();
    await driver.exec('CREATE TABLE t (a TEXT, b INTEGER)');
    await driver.run('INSERT INTO t VALUES (?, ?)', ['x', null]);
    expect(await first(driver, 'SELECT a, b FROM t WHERE a = ?', ['x'])).toEqual({ a: 'x', b: null });
    expect(await first(driver, 'SELECT * FROM t WHERE a = ?', ['nope'])).toBeNull();
  });
});
