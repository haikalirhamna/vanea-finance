import {
  InvalidBackupError, WrongPassphraseError, decryptBackup, encryptBackup, isStrongEnough,
} from '../backup-crypto';

const FAST = { n: 1_024, r: 8, p: 1 } as const;
const random = (seed = 1) => ({
  salt: Uint8Array.from({ length: 16 }, (_, i) => (i * 7 + seed) % 256),
  nonce: Uint8Array.from({ length: 24 }, (_, i) => (i * 11 + seed) % 256),
});
const SECRET = JSON.stringify({ transactions: [{ id: 't1', amount: 4_250_000, note: 'Café ☕ 你好' }] });

describe('backup encryption', () => {
  it('round-trips text, including non-ASCII characters', () => {
    const sealed = encryptBackup(SECRET, 'correct horse battery', random(), FAST);
    expect(decryptBackup(sealed, 'correct horse battery')).toBe(SECRET);
  });

  it('works with the default (strong) key derivation', () => {
    const sealed = encryptBackup('hello', 'a long enough passphrase', random());
    expect(JSON.parse(sealed).kdf).toEqual({ name: 'scrypt', n: 32_768, r: 8, p: 1 });
    expect(decryptBackup(sealed, 'a long enough passphrase')).toBe('hello');
  }, 60_000);

  it('does not reveal the content in the file', () => {
    const sealed = encryptBackup(SECRET, 'correct horse battery', random(), FAST);
    expect(sealed).not.toContain('4250000');
    expect(sealed).not.toContain('t1');
  });

  it('gives different files for different salts and nonces', () => {
    const a = encryptBackup(SECRET, 'correct horse battery', random(1), FAST);
    const b = encryptBackup(SECRET, 'correct horse battery', random(2), FAST);
    expect(a).not.toBe(b);
  });

  it('refuses a wrong passphrase', () => {
    const sealed = encryptBackup(SECRET, 'correct horse battery', random(), FAST);
    expect(() => decryptBackup(sealed, 'wrong passphrase!')).toThrow(WrongPassphraseError);
  });

  it('refuses a file that was changed', () => {
    const envelope = JSON.parse(encryptBackup(SECRET, 'correct horse battery', random(), FAST));
    const flipped = Buffer.from(envelope.ciphertext, 'base64');
    flipped[3] = flipped[3]! ^ 1;
    expect(() => decryptBackup(JSON.stringify({ ...envelope, ciphertext: flipped.toString('base64') }), 'correct horse battery')).toThrow(WrongPassphraseError);
  });

  it('refuses a file whose key-derivation parameters were weakened', () => {
    const envelope = JSON.parse(encryptBackup(SECRET, 'correct horse battery', random(), FAST));
    envelope.kdf.n = 512;
    expect(() => decryptBackup(JSON.stringify(envelope), 'correct horse battery')).toThrow(WrongPassphraseError);
  });

  it('recognises files that are not backups', () => {
    expect(() => decryptBackup('hello', 'x'.repeat(8))).toThrow(InvalidBackupError);
    expect(() => decryptBackup('{"format":"other"}', 'x'.repeat(8))).toThrow(/unknown format/);
    expect(() => decryptBackup('{"format":"vanea-backup","version":9}', 'x'.repeat(8))).toThrow(/unsupported version 9/);
    expect(() => decryptBackup('{"format":"vanea-backup","version":1}', 'x'.repeat(8))).toThrow(/incomplete header/);
    const envelope = JSON.parse(encryptBackup(SECRET, 'correct horse battery', random(), FAST));
    expect(() => decryptBackup(JSON.stringify({ ...envelope, salt: '***' }), 'correct horse battery')).toThrow(InvalidBackupError);
  });

  it('requires a passphrase of at least 8 characters', () => {
    expect(isStrongEnough('1234567')).toBe(false);
    expect(isStrongEnough('12345678')).toBe(true);
    expect(() => encryptBackup(SECRET, 'short', random(), FAST)).toThrow(/at least 8/);
  });
});
