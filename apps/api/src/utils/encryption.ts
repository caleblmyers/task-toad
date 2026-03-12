import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;   // 96-bit IV — recommended for GCM
const TAG_BYTES = 16;  // 128-bit auth tag — GCM default

function getMasterKey(): Buffer {
  const hex = process.env.ENCRYPTION_MASTER_KEY ?? '';
  if (hex.length !== 64) {
    throw new Error(
      'ENCRYPTION_MASTER_KEY must be a 64-character hex string (32 bytes). ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypts an API key with AES-256-GCM.
 * Returns a single string: "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 * Never logs the plaintext key.
 */
export function encryptApiKey(apiKey: string): string {
  const key = getMasterKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/**
 * Decrypts a value produced by encryptApiKey.
 * Throws if the master key is wrong or the ciphertext has been tampered with.
 * Never logs the plaintext key.
 */
export function decryptApiKey(encrypted: string): string {
  const key = getMasterKey();
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Encrypted value has unexpected format');
  }
  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  if (iv.length !== IV_BYTES || authTag.length !== TAG_BYTES) {
    throw new Error('Encrypted value is malformed');
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
