/** An in-memory SQLite (sql.js, the asm.js build: no wasm file to load). Used by tests and the web preview. */
import initSqlJs from 'sql.js/dist/sql-asm.js';
import type { Database } from 'sql.js';
import { SqlDriver, SqlValue } from './driver';

function wrap(db: Database): SqlDriver {
  let depth = 0;
  return {
    async exec(sql) {
      db.exec(sql);
    },
    async run(sql, params = []) {
      db.run(sql, [...params]);
    },
    async all<T>(sql: string, params: readonly SqlValue[] = []) {
      const statement = db.prepare(sql);
      try {
        statement.bind([...params]);
        const rows: T[] = [];
        while (statement.step()) rows.push(statement.getAsObject() as T);
        return rows;
      } finally {
        statement.free();
      }
    },
    async transaction<T>(work: () => Promise<T>) {
      if (depth > 0) throw new Error('Transactions cannot be nested');
      depth += 1;
      db.run('BEGIN');
      try {
        const result = await work();
        db.run('COMMIT');
        return result;
      } catch (error) {
        db.run('ROLLBACK');
        throw error;
      } finally {
        depth -= 1;
      }
    },
    async close() {
      db.close();
    },
  };
}

/** Opens an empty in-memory database; pass `bytes` to load a saved one. */
export async function openMemoryDriver(bytes?: Uint8Array): Promise<SqlDriver> {
  const SQL = await initSqlJs();
  return wrap(new SQL.Database(bytes));
}
