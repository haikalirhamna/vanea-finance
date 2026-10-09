import { getProfile } from '@/data/profile';
import { InvalidBackupError } from '@/data/backup-crypto';
import { TestApp, onboardedApp, testApp } from '../../__tests__/helpers';
import { recordExpense } from '../../spending/spending-actions';
import { BackupIo, daysSinceExport, exportBackup, openBackup, restoreBackup } from '../backup-actions';

function fakeIo() {
  const files = new Map<string, string>();
  const shared: string[] = [];
  const io: BackupIo = {
    randomBytes: (length) => Uint8Array.from({ length }, (_, i) => (i * 13 + 7) % 256),
    writeFile: async (name, text) => { files.set(`file:///cache/${name}`, text); return `file:///cache/${name}`; },
    share: async (uri) => { shared.push(uri); },
    appVersion: '0.1.0',
  };
  return { io, files, shared };
}

const PASS = 'correct horse battery';

async function exported(app: TestApp) {
  const { io, files, shared } = fakeIo();
  const result = await exportBackup(app.ctx, io, { passphrase: PASS, confirmation: PASS });
  return { result, text: [...files.values()][0]!, shared };
}

describe('exportBackup', () => {
  it('writes an encrypted file, offers it to the share sheet and remembers when', async () => {
    const app = await onboardedApp();
    const { result, text, shared } = await exported(app);
    expect(result).toEqual({ ok: true, value: { fileName: 'vanea-backup-2026-10-09.vanea' } });
    expect(shared).toEqual(['file:///cache/vanea-backup-2026-10-09.vanea']);
    expect(text).not.toContain('4250000');
    expect((await getProfile(app.driver))!.lastExportAt).toBe('2026-10-09T08:00:00.000Z');
  }, 60_000);

  it('refuses short or mismatched passphrases and writes nothing', async () => {
    const app = await onboardedApp();
    const { io, files } = fakeIo();
    expect(await exportBackup(app.ctx, io, { passphrase: 'short', confirmation: 'short' })).toMatchObject({ ok: false, error: { title: 'Choose a longer passphrase' } });
    expect(await exportBackup(app.ctx, io, { passphrase: PASS, confirmation: `${PASS}!` })).toMatchObject({ ok: false, error: { title: "The passphrases don't match" } });
    expect(files.size).toBe(0);
    expect((await getProfile(app.driver))!.lastExportAt).toBeUndefined();
  });
});

describe('openBackup and restoreBackup', () => {
  it('previews a backup, then restores it onto a fresh phone', async () => {
    const source = await onboardedApp();
    await recordExpense(source.ctx, { amount: 230_000, category: 'needs', note: 'Groceries' });
    const { text } = await exported(source);

    const opened = openBackup(text, PASS);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.value.summary).toMatchObject({ balances: { pool: 14_000_000, personal: 4_250_000 - 230_000, savings: 2_000_000 } });

    const fresh = await testApp();
    expect(await restoreBackup(fresh.ctx, opened.value.payload)).toEqual({ ok: true, value: undefined });
    const restored = await fresh.snapshot();
    const original = await source.snapshot();
    expect(restored.transactions).toEqual(original.transactions);
    expect(restored.profile).toMatchObject({ paydayDay: 25, onboardedOn: '2026-10-09' });
    expect(restored.salarySettings).toEqual(original.salarySettings);
  }, 60_000);

  it('explains a wrong passphrase as in DESIGN §12', async () => {
    const { text } = await exported(await onboardedApp());
    expect(openBackup(text, 'not the passphrase')).toEqual({
      ok: false,
      error: {
        title: "Backup couldn't be opened",
        what: "The passphrase doesn't match this file.",
        next: "Check the passphrase and try again. Vanea can't recover a forgotten passphrase.",
      },
    });
  }, 60_000);

  it('explains a file that is not a backup', () => {
    expect(openBackup('hello', PASS)).toMatchObject({ ok: false, error: { title: "Backup couldn't be opened", next: 'Pick a backup file made by Vanea.' } });
    expect(new InvalidBackupError('x').message).toContain('not a valid Vanea backup');
  });
});

describe('daysSinceExport', () => {
  it('counts whole days, or null when never exported', () => {
    expect(daysSinceExport(undefined, '2026-10-09T08:00:00.000Z')).toBeNull();
    expect(daysSinceExport('2026-09-05T08:00:00.000Z', '2026-10-09T08:00:00.000Z')).toBe(34);
    expect(daysSinceExport('2026-10-09T01:00:00.000Z', '2026-10-09T08:00:00.000Z')).toBe(0);
  });
});
