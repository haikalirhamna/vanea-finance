/** In the web preview a backup is a browser download, and restoring picks a file from the computer. */
import { BackupIo } from '@/features/backup/backup-actions';
import { randomBytes } from './database';

const pending = new Map<string, string>();

export const backupIo: BackupIo = {
  randomBytes,
  appVersion: '0.1.0',
  async writeFile(fileName, text) {
    pending.set(fileName, text);
    return fileName;
  },
  async share(uri) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([pending.get(uri) ?? ''], { type: 'text/plain' }));
    link.download = uri;
    link.click();
  },
};

export function pickBackupText(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = () => resolve(input.files?.[0] ? input.files[0].text() : null);
    input.click();
  });
}
