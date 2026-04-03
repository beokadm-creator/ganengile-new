import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TARGET_DIRS = ['src', 'admin-web', 'docs', 'scripts'];
const TARGET_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.yml', '.yaml']);
const SUSPICIOUS_PATTERNS = [
  /\uFFFD/g,
  /�/g,
  /(?:諛곗넚|寃곗젣|湲몃윭|梨꾪똿|媛꾩쓽|留ㅼ묶|ㅻ퉬寃뚯씠)/g,
];
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

function hasUtf8Bom(buffer) {
  return buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
}

const files = [];
for (const targetDir of TARGET_DIRS) {
  walk(path.join(ROOT, targetDir), files);
}

const findings = [];

for (const filePath of files) {
  const buffer = fs.readFileSync(filePath);
  if (hasUtf8Bom(buffer)) {
    findings.push({
      filePath,
      line: 1,
      reason: 'UTF-8 BOM detected',
      snippet: 'BOM',
    });
  }

  const content = buffer.toString('utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (filePath.endsWith(`${path.sep}scripts${path.sep}check-encoding.mjs`)) {
        continue;
      }

      if (pattern.test(line)) {
        findings.push({
          filePath,
          line: index + 1,
          reason: `Suspicious mojibake pattern: ${pattern}`,
          snippet: line.trim().slice(0, 160),
        });
        break;
      }
    }
  });
}

if (findings.length > 0) {
  console.error('Encoding check failed. Suspicious text was found:\n');
  for (const finding of findings) {
    console.error(`${path.relative(ROOT, finding.filePath)}:${finding.line} ${finding.reason}`);
    console.error(`  ${finding.snippet}`);
  }
  process.exit(1);
}

console.log(`Encoding check passed for ${files.length} files.`);
