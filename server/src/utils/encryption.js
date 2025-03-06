// server/src/utils/encryption.js
import crypto from 'crypto';

// We'll use a proper key generation method
function generateEncryptionKey(secret) {
  return crypto.scryptSync(secret, 'salt', 32); // Generate a 32-byte key
}

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-super-secret-key-for-encryption!!';
const KEY = generateEncryptionKey(ENCRYPTION_KEY);
const IV_LENGTH = 16;

export function encryptCredentials(credentials) {
  try {
    const encryptField = (text) => {
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv('aes-256-cbc', KEY, iv);
      let encrypted = cipher.update(text);
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      return iv.toString('hex') + ':' + encrypted.toString('hex');
    };

    return {
      password: encryptField(credentials.password),
      totp: encryptField(credentials.totp),
      apiKey: encryptField(credentials.apiKey)
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt credentials');
  }
}

export function decryptCredentials(encryptedCredentials) {
  try {
    const decryptField = (text) => {
      const textParts = text.split(':');
      const iv = Buffer.from(textParts.shift(), 'hex');
      const encryptedText = Buffer.from(textParts.join(':'), 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', KEY, iv);
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString();
    };

    return {
      password: decryptField(encryptedCredentials.password),
      totp: decryptField(encryptedCredentials.totp),
      apiKey: decryptField(encryptedCredentials.apiKey)
    };
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt credentials');
  }
}