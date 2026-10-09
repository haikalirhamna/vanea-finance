/** Export, preview and restore of an encrypted backup file (PRD BAK-1, BAK-2). */
import {
  InvalidBackupError, MIN_PASSPHRASE_LENGTH, WrongPassphraseError, decryptBackup, encryptBackup, isStrongEnough,
} from '@/data/backup-crypto';
import {
  BackupPayload, BackupSummary, InvalidPayloadError, exportPayload, importPayload, parsePayload, summarize, verifyBalances,
} from '@/data/backup';
import { updateProfile } from '@/data/profile';
import { ActionContext, ActionResult, failure, requireProfile, runAtomic, success } from '../action-runtime';
import { ExplainedError, problem } from '../errors';

/** What the phone has to provide; keeps this file free of native modules. */
export interface BackupIo {
  randomBytes(length: number): Uint8Array;
  /** Writes a temporary file and returns where it is. */
  writeFile(fileName: string, text: string): Promise<string>;
  /** Opens the system share sheet for the file. */
  share(uri: string): Promise<void>;
  appVersion: string;
}

export interface OpenedBackup {
  payload: BackupPayload;
  summary: BackupSummary;
}

const SALT_BYTES = 16;
const NONCE_BYTES = 24;

function explainOpenError(error: unknown): ExplainedError {
  if (error instanceof WrongPassphraseError) {
    return problem("Backup couldn't be opened", "The passphrase doesn't match this file.", "Check the passphrase and try again. Vanea can't recover a forgotten passphrase.");
  }
  if (error instanceof InvalidBackupError || error instanceof InvalidPayloadError) {
    return problem("Backup couldn't be opened", error.message, 'Pick a backup file made by Vanea.');
  }
  throw error;
}

export async function exportBackup(
  ctx: ActionContext,
  io: BackupIo,
  input: { passphrase: string; confirmation: string },
): Promise<ActionResult<{ fileName: string }>> {
  if (!isStrongEnough(input.passphrase)) {
    return failure(problem('Choose a longer passphrase', `A backup passphrase needs at least ${MIN_PASSPHRASE_LENGTH} characters.`, 'Choose a longer one you will remember.'));
  }
  if (input.passphrase !== input.confirmation) {
    return failure(problem("The passphrases don't match", 'The two passphrases you typed are different.', 'Type the same passphrase twice.'));
  }
  const fileName = `vanea-backup-${ctx.today()}.vanea`;
  const payload = await exportPayload(ctx.driver, { exportedAt: ctx.now(), appVersion: io.appVersion });
  const sealed = encryptBackup(JSON.stringify(payload), input.passphrase, {
    salt: io.randomBytes(SALT_BYTES), nonce: io.randomBytes(NONCE_BYTES),
  });
  await io.share(await io.writeFile(fileName, sealed));
  return runAtomic(ctx, async () => {
    const profile = await requireProfile(ctx.driver);
    await updateProfile(ctx.driver, profile.id, { lastExportAt: ctx.now() }, ctx.now());
    return success({ fileName });
  });
}

/** Decrypts and checks a backup without changing anything, so the user can see what it holds first. */
export function openBackup(text: string, passphrase: string): ActionResult<OpenedBackup> {
  try {
    const payload = parsePayload(decryptBackup(text, passphrase));
    verifyBalances(payload);
    return success({ payload, summary: summarize(payload) });
  } catch (error) {
    return failure(explainOpenError(error));
  }
}

/** Replaces everything on this phone with the backup. Run only after the user confirmed the summary. */
export async function restoreBackup(ctx: ActionContext, payload: BackupPayload): Promise<ActionResult> {
  try {
    await importPayload(ctx.driver, payload);
    return success(undefined);
  } catch (error) {
    return failure(explainOpenError(error));
  }
}

/** Days since the last export; null when there never was one. */
export function daysSinceExport(lastExportAt: string | undefined, now: string): number | null {
  if (!lastExportAt) return null;
  return Math.floor((Date.parse(now) - Date.parse(lastExportAt)) / 86_400_000);
}
