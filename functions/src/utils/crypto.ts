import * as crypto from 'crypto';
import * as functions from 'firebase-functions';

const ALGORITHM = 'aes-256-gcm';

// 32 bytes (256 bits) key required
const getSecretKey = () => {
  const key = process.env.ENCRYPTION_KEY || functions.config().crypto?.key;
  if (!key || key.length !== 32) {
    // Fallback for local testing only
    return crypto.createHash('sha256').update('fallback-secret-key-do-not-use-in-prod').digest();
  }
  return Buffer.from(key);
};

export const encrypt = (text: string): string => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getSecretKey(), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

export const decrypt = (encryptedData: string): string => {
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encryptedText = parts[2];
  
  const decipher = crypto.createDecipheriv(ALGORITHM, getSecretKey(), iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};