import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TARGET_DIRS = ['src', 'admin-web', 'docs', 'scripts'];
const TARGET_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.yml',
  '.yaml',
]);
const IGNORE_SEGMENTS = ['node_modules', '.git', 'dist', 'coverage', '.next', 'android', 'ios'];

function shouldScan(filePath) {
  if (!TARGET_EXTENSIONS.has(path.extname(filePath))) {
    return false;
  }

  return !IGNORE_SEGMENTS.some((segment) => filePath.includes(`${path.sep}${segment}${path.sep}`));
}

function walk(dirPath, collector) {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (IGNORE_SEGMENTS.includes(entry.name)) {
        continue;
      }
      walk(fullPath, collector);
      continue;
    }

    if (entry.isFile() && shouldScan(fullPath)) {
      collector.push(fullPath);
    }
  }
}

function stripUtf8Bom(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3);
  }

  return buffer;
}

const files = [];
for (const targetDir of TARGET_DIRS) {
  walk(path.join(ROOT, targetDir), files);
}

let updatedCount = 0;

for (const filePath of files) {
  const originalBuffer = fs.readFileSync(filePath);
  const normalizedBuffer = stripUtf8Bom(originalBuffer);
  const normalizedText = normalizedBuffer.toString('utf8').replace(/\r\n/g, '\n');
  const rewrittenBuffer = Buffer.from(normalizedText, 'utf8');

  if (!originalBuffer.equals(rewrittenBuffer)) {
    fs.writeFileSync(filePath, rewrittenBuffer);
    updatedCount += 1;
  }
}

console.log(`Normalized ${updatedCount} file(s) to UTF-8 without BOM.`);
