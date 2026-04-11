import * as Crypto from 'expo-crypto';

const STORAGE_ENVELOPE_PREFIX = 'enc:v1';
const STORAGE_ENCRYPTION_SECRET: string = (() => {
  const key = process.env.EXPO_PUBLIC_STORAGE_ENCRYPTION_KEY;
  if (!key && typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn('[secure-storage] encryption key missing, using local fallback key');
  }
  return String(key ?? 'ganengile-beta1-local-storage-fallback-key');
})();

function stringToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function bytesToString(value: Uint8Array): string {
  return new TextDecoder().decode(value);
}

function bytesToHex(value: Uint8Array): string {
  return Array.from(value)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(value: string): Uint8Array {
  const output = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    output[index / 2] = parseInt(value.slice(index, index + 2), 16);
  }
  return output;
}

async function deriveKeystream(length: number, nonce: string): Promise<Uint8Array> {
  const chunks: number[] = [];
  let counter = 0;

  while (chunks.length < length) {
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${STORAGE_ENCRYPTION_SECRET}:${nonce}:${counter}`
    );
    chunks.push(...Array.from(hexToBytes(digest)));
    counter += 1;
  }

  return Uint8Array.from(chunks.slice(0, length));
}

function xorBytes(left: Uint8Array, right: Uint8Array): Uint8Array {
  const result = new Uint8Array(left.length);
  for (let index = 0; index < left.length; index += 1) {
    result[index] = left[index] ^ right[index];
  }
  return result;
}

export function isEncryptedStorageValue(value: string): boolean {
  return value.startsWith(`${STORAGE_ENVELOPE_PREFIX}:`);
}

export async function encryptStorageValue(plainText: string): Promise<string> {
  const nonce = Crypto.randomUUID();
  const inputBytes = stringToBytes(plainText);
  const keystream = await deriveKeystream(inputBytes.length, nonce);
  const cipherBytes = xorBytes(inputBytes, keystream);

  return `${STORAGE_ENVELOPE_PREFIX}:${nonce}:${bytesToHex(cipherBytes)}`;
}

export async function decryptStorageValue(value: string): Promise<string> {
  if (!isEncryptedStorageValue(value)) {
    return value;
  }

  const [, , nonce, cipherHex] = value.split(':');
  if (!nonce || !cipherHex) {
    return value;
  }

  const cipherBytes = hexToBytes(cipherHex);
  const keystream = await deriveKeystream(cipherBytes.length, nonce);
  const plainBytes = xorBytes(cipherBytes, keystream);

  return bytesToString(plainBytes);
}

export async function encryptStorageJson<T>(value: T): Promise<string> {
  return encryptStorageValue(JSON.stringify(value));
}

export async function decryptStorageJson<T>(value: string): Promise<T> {
  const plainText = await decryptStorageValue(value);
  return JSON.parse(plainText) as T;
}
