import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
// Default key for development. In production, this must be injected via env variables.
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default_secret_key_needs_32_bytes!'; 
const IV_LENGTH = 16;

/**
 * Ensures the key is exactly 32 bytes long by hashing or padding it.
 */
function getValidKey(): Buffer {
  const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'utf8');
  if (keyBuffer.length === 32) {
    return keyBuffer;
  }
  // Hash to 32 bytes if not exactly 32
  return crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
}

/**
 * Encrypts a string using AES-256-GCM.
 * @param text The text to encrypt
 * @returns Encrypted string in format: iv:authTag:encryptedText
 */
export function encrypt(text: string): string {
  if (!text) return text;
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getValidKey();
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a string encrypted by the encrypt function.
 * @param hash The encrypted string in format: iv:authTag:encryptedText
 * @returns Decrypted text
 */
export function decrypt(hash: string): string {
  if (!hash) return hash;
  
  try {
    const parts = hash.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = Buffer.from(parts[2], 'hex');
    const key = getValidKey();
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText);
    // Note: older node versions returned decipher.update(...) as Buffer, newer as String depending on encoding arg
    // By not passing encoding to update(), it returns a Buffer, which we can concat
    const finalBuffer = decipher.final();
    
    return Buffer.concat([decrypted, finalBuffer]).toString('utf8');
  } catch (error) {
    console.error('Decryption failed:', error.message);
    return '';
  }
}
