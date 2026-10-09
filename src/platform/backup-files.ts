/** Files for backups on the phone: write to the cache and share, or let the user pick a file to restore. */
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { BackupIo } from '@/features/backup/backup-actions';
import { randomBytes } from './database';

export const backupIo: BackupIo = {
  randomBytes,
  appVersion: '0.1.0',
  async writeFile(fileName, text) {
    const file = new File(Paths.cache, fileName);
    if (file.exists) file.delete();
    file.create();
    file.write(text);
    return file.uri;
  },
  share: (uri) => Sharing.shareAsync(uri, { dialogTitle: 'Save your Vanea backup' }),
};

/** The text of the file the user picked, or null if they cancelled. */
export async function pickBackupText(): Promise<string | null> {
  const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
  const asset = picked.canceled ? null : picked.assets[0];
  return asset ? new File(asset.uri).text() : null;
}
