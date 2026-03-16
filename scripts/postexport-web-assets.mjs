#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');

const copyTargets = [
  {
    src: path.join(
      rootDir,
      'node_modules',
      '@expo',
      'vector-icons',
      'build',
      'vendor',
      'react-native-vector-icons',
      'Fonts'
    ),
    dest: path.join(
      distDir,
      'assets',
      'node_modules',
      '@expo',
      'vector-icons',
      'build',
      'vendor',
      'react-native-vector-icons',
      'Fonts'
    ),
  },
  {
    src: path.join(
      rootDir,
      'node_modules',
      '@react-navigation',
      'elements',
      'lib',
      'module',
      'assets'
    ),
    dest: path.join(
      distDir,
      'assets',
      'node_modules',
      '@react-navigation',
      'elements',
      'lib',
      'module',
      'assets'
    ),
  },
];

function ensureDirectory(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyDirectory(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`[postexport] skip (missing): ${src}`);
    return 0;
  }
  ensureDirectory(dest);
  fs.cpSync(src, dest, { recursive: true });
  const count = fs.readdirSync(dest).length;
  return count;
}

if (!fs.existsSync(distDir)) {
  console.error('[postexport] dist directory not found. Run expo export first.');
  process.exit(1);
}

let total = 0;
for (const target of copyTargets) {
  total += copyDirectory(target.src, target.dest);
}

console.log(`[postexport] copied web asset directories: ${total > 0 ? 'ok' : 'none'}`);

