import { SqlDriver } from '../driver';
import { openMemoryDriver } from '../driver-memory';
import { prepareDatabase } from '../database';

export const NOW = '2026-10-09T08:00:00.000Z';

export async function freshDatabase(): Promise<SqlDriver> {
  return prepareDatabase(await openMemoryDriver());
}

/** Inserts the rows other tables point to, so foreign keys hold. */
export async function seedParents(driver: SqlDriver): Promise<void> {
  await driver.run(
    "INSERT INTO debts (id, kind, name, type, purpose, status, origin, created_at, updated_at) VALUES ('line1', 'credit_line', 'PayLater', 'paylater', 'personal', 'open', 'manual', ?, ?)",
    [NOW, NOW],
  );
  await driver.run(
    "INSERT INTO debts (id, kind, name, type, purpose, amount_received, installment_amount, installment_count, frequency, first_due_date, status, origin, created_at, updated_at) VALUES ('loan1', 'installment_loan', 'Kredivo', 'online_loan', 'personal', 3000000, 550000, 6, 'monthly', '2026-10-02', 'open', 'manual', ?, ?)",
    [NOW, NOW],
  );
  await driver.run("INSERT INTO holdings (id, name, asset_class, status, created_at, updated_at) VALUES ('h1', 'BBCA', 'stock', 'open', ?, ?)", [NOW, NOW]);
  await driver.run("INSERT INTO subscriptions (id, name, billing_cycle, next_billing_date, created_at, updated_at) VALUES ('s1', 'Figma', 'monthly', '2026-11-15', ?, ?)", [NOW, NOW]);
}
