import * as crypto from 'crypto';

// 알고리즘 종류
const ALGORITHM = 'aes-256-gcm';
// 키 길이는 32바이트 (256비트)
const ENCRYPTION_KEY = process.env.RRN_ENCRYPTION_KEY || 'default_secure_key_32_bytes_long_123456';
const IV_LENGTH = 16; // AES-GCM IV 길이 (12바이트 또는 16바이트)

function getKey(): Buffer {
  // 환경변수로 주입받은 키를 32바이트 Buffer로 변환. 길이가 맞지 않으면 에러 방지를 위해 해시 처리
  if (ENCRYPTION_KEY.length === 32) {
    return Buffer.from(ENCRYPTION_KEY, 'utf-8');
  }
  return crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
}

/**
 * 주민등록번호 등 민감정보를 양방향 암호화합니다.
 * @param text 암호화할 평문
 * @returns 'iv:authTag:encryptedText' 형식의 문자열
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();

  // DB에 저장하기 위해 IV, 인증태그, 암호문을 하나로 묶어서 반환
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * 암호화된 민감정보를 복호화합니다. (세무 API 전송 시에만 사용)
 * @param encryptedData 'iv:authTag:encryptedText' 형식의 암호문
 * @returns 복호화된 평문
 */
export function decrypt(encryptedData: string): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encryptedText = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}