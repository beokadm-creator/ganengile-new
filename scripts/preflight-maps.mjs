/* global process, console */

import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const text = fs.readFileSync(filePath, 'utf8');
  return text
    .split(/\r?\n/)
    .filter((line) => line && !line.trim().startsWith('#'))
    .reduce((acc, line) => {
      const index = line.indexOf('=');
      if (index === -1) {
        return acc;
      }

      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim();
      acc[key] = value;
      return acc;
    }, {});
}

function readProjectEnv() {
  const rootEnv = parseEnvFile(path.join(cwd, '.env'));
  const functionsEnv = parseEnvFile(path.join(cwd, 'functions', '.env.ganengile'));
  return { rootEnv, functionsEnv };
}

function statusLine(label, ok, detail) {
  const icon = ok ? 'OK' : 'MISSING';
  console.log(`[${icon}] ${label}${detail ? `: ${detail}` : ''}`);
}

function hasNonEmpty(map, key) {
  const value = map[key];
  return typeof value === 'string' && value.length > 0;
}

const { rootEnv, functionsEnv } = readProjectEnv();

console.log('Ganengile map preflight');
console.log('');

const appRequired = [
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION',
  'EXPO_PUBLIC_MAP_PROVIDER',
  'EXPO_PUBLIC_NAVER_MAP_ENABLED',
  'EXPO_PUBLIC_NAVER_MAP_CLIENT_ID',
];

const dynamicOptional = [
  'EXPO_PUBLIC_NAVER_WEB_MAP_ENABLED',
  'EXPO_PUBLIC_NAVER_MAP_WEB_CLIENT_ID',
];

const functionsRequired = ['NAVER_MAP_CLIENT_ID', 'NAVER_MAP_CLIENT_SECRET'];

for (const key of appRequired) {
  statusLine(key, hasNonEmpty(rootEnv, key), hasNonEmpty(rootEnv, key) ? 'configured' : 'set this before deploy');
}

console.log('');

for (const key of dynamicOptional) {
  const configured = hasNonEmpty(rootEnv, key);
  statusLine(key, configured, configured ? 'configured' : 'optional for web dynamic maps');
}

console.log('');

for (const key of functionsRequired) {
  statusLine(key, hasNonEmpty(functionsEnv, key), hasNonEmpty(functionsEnv, key) ? 'configured' : 'set this before deploy');
}

console.log('');

const provider = rootEnv.EXPO_PUBLIC_MAP_PROVIDER ?? 'unset';
console.log(`Map provider: ${provider}`);

if (provider === 'naver-web') {
  const ready = hasNonEmpty(rootEnv, 'EXPO_PUBLIC_NAVER_WEB_MAP_ENABLED') && hasNonEmpty(rootEnv, 'EXPO_PUBLIC_NAVER_MAP_WEB_CLIENT_ID');
  statusLine('Dynamic web map readiness', ready, ready ? 'ready' : 'enable dynamic web map envs');
} else {
  statusLine('Dynamic web map readiness', true, 'static map mode or native fallback');
}
