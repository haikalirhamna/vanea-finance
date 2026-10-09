/**
 * Passphrase-protected backups (SYSTEM-OVERVIEW §11): scrypt derives the key, XChaCha20-Poly1305 encrypts.
 * The envelope header is authenticated too, so tampering with the parameters is detected.
 * Randomness is passed in (expo-crypto in the app), which keeps this file pure and testable.
 */
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { scrypt } from '@noble/hashes/scrypt.js';

export const BACKUP_FORMAT = 'vanea-backup';
export const ENVELOPE_VERSION = 1;
export const MIN_PASSPHRASE_LENGTH = 8;

/** scrypt cost: 2^15 uses about 32 MB. Stored in the envelope so old backups keep opening. */
export const DEFAULT_SCRYPT = { n: 32_768, r: 8, p: 1 } as const;

export interface ScryptParams { n: number; r: number; p: number }

interface Envelope {
  format: typeof BACKUP_FORMAT;
  version: number;
  kdf: { name: 'scrypt' } & ScryptParams;
  salt: string;
  nonce: string;
  ciphertext: string;
}

export class InvalidBackupError extends Error {
  constructor(reason: string) {
    super(`This is not a valid Vanea backup: ${reason}`);
    this.name = 'InvalidBackupError';
  }
}

export class WrongPassphraseError extends Error {
  constructor() {
    super('The passphrase does not match this backup.');
    this.name = 'WrongPassphraseError';
  }
}

export interface Randomness {
  /** 16 random bytes. */
  salt: Uint8Array;
  /** 24 random bytes. */
  nonce: Uint8Array;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  try {
    return Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
  } catch {
    throw new InvalidBackupError('damaged data');
  }
}

function deriveKey(passphrase: string, salt: Uint8Array, params: ScryptParams): Uint8Array {
  return scrypt(encoder.encode(passphrase.normalize('NFKC')), salt, { N: params.n, r: params.r, p: params.p, dkLen: 32 });
}

/** What the header authenticates: the format, version and key-derivation parameters. */
function headerOf(envelope: Pick<Envelope, 'format' | 'version' | 'kdf'>): Uint8Array {
  const { format, version, kdf } = envelope;
  return encoder.encode(JSON.stringify({ format, version, kdf }));
}

export function isStrongEnough(passphrase: string): boolean {
  return passphrase.length >= MIN_PASSPHRASE_LENGTH;
}

/** Encrypts the plaintext into the text stored in a `.vanea` file. */
export function encryptBackup(
  plaintext: string,
  passphrase: string,
  random: Randomness,
  params: ScryptParams = DEFAULT_SCRYPT,
): string {
  if (!isStrongEnough(passphrase)) throw new Error(`The passphrase needs at least ${MIN_PASSPHRASE_LENGTH} characters.`);
  const header: Pick<Envelope, 'format' | 'version' | 'kdf'> = {
    format: BACKUP_FORMAT,
    version: ENVELOPE_VERSION,
    kdf: { name: 'scrypt', ...params },
  };
  const key = deriveKey(passphrase, random.salt, params);
  const sealed = xchacha20poly1305(key, random.nonce, headerOf(header)).encrypt(encoder.encode(plaintext));
  const envelope: Envelope = { ...header, salt: toBase64(random.salt), nonce: toBase64(random.nonce), ciphertext: toBase64(sealed) };
  return JSON.stringify(envelope);
}

function parseJson(text: string): Partial<Envelope> {
  try {
    return JSON.parse(text) as Partial<Envelope>;
  } catch {
    throw new InvalidBackupError('not a backup file');
  }
}

function hasKeyDerivation(parsed: Partial<Envelope>): boolean {
  const kdf = parsed.kdf;
  return kdf?.name === 'scrypt' && !!kdf.n && !!kdf.r && !!kdf.p;
}

function parseEnvelope(text: string): Envelope {
  const parsed = parseJson(text);
  if (parsed.format !== BACKUP_FORMAT) throw new InvalidBackupError('unknown format');
  if (parsed.version !== ENVELOPE_VERSION) throw new InvalidBackupError(`unsupported version ${String(parsed.version)}`);
  if (!hasKeyDerivation(parsed) || !parsed.salt || !parsed.nonce || !parsed.ciphertext) {
    throw new InvalidBackupError('incomplete header');
  }
  return parsed as Envelope;
}

/** Decrypts a `.vanea` file's text. Wrong passphrase and tampering both raise `WrongPassphraseError`. */
export function decryptBackup(text: string, passphrase: string): string {
  const envelope = parseEnvelope(text);
  const { n, r, p } = envelope.kdf;
  const key = deriveKey(passphrase, fromBase64(envelope.salt), { n, r, p });
  try {
    const opened = xchacha20poly1305(key, fromBase64(envelope.nonce), headerOf(envelope)).decrypt(fromBase64(envelope.ciphertext));
    return decoder.decode(opened);
  } catch {
    throw new WrongPassphraseError();
  }
}
