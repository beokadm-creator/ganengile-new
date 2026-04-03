import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';

function loadEnvFile(filename) {
  const filePath = path.join(process.cwd(), filename);
  if (!fs.existsSync(filePath)) {
    return;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile('.env');
loadEnvFile('.env.local');

const requiredKeys = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
  'EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION',
];

const placeholderPatterns = [
  /^YOUR_/,
  /^REPLACE_/,
  /^CHANGE_ME$/,
  /^undefined$/i,
  /^null$/i,
];

const missing = requiredKeys.filter((key) => {
  const value = process.env[key]?.trim();
  if (!value) {
    return true;
  }

  return placeholderPatterns.some((pattern) => pattern.test(value));
});

if (missing.length > 0) {
  console.error('Web export blocked. Missing required public Firebase env vars:\n');
  for (const key of missing) {
    console.error(`- ${key}`);
  }
  console.error('\nFill .env.local before running web export.');
  process.exit(1);
}

console.log('Web env verification passed.');
