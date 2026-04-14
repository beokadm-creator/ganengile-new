/**
 * Replace in-scale raw fontSize values with Typography.fontSize tokens
 */
const fs = require('fs');
const path = require('path');

const map = {
  11: "Typography.fontSize.xs",
  12: "Typography.fontSize.sm",
  14: "Typography.fontSize.base",
  16: "Typography.fontSize.lg",
  18: "Typography.fontSize.xl",
  20: "Typography.fontSize['2xl']",
  24: "Typography.fontSize['3xl']",
  28: "Typography.fontSize['4xl']",
  32: "Typography.fontSize['5xl']",
};

const inScaleValues = new Set(Object.keys(map).map(Number));

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) walkDir(full, callback);
    else if (f.endsWith('.tsx') || f.endsWith('.ts')) callback(full);
  });
}

let totalFiles = 0;
let totalReplacements = 0;
const offScaleMap = {};

walkDir(path.join(__dirname, '..', 'src'), (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let fileReplacements = 0;

  // Replace: fontSize: <number>  where number is in-scale
  const replaced = content.replace(/fontSize:\s*(\d+)(?=[,\s\}])/g, (match, num) => {
    const n = Number(num);
    if (map[n]) {
      fileReplacements++;
      return `fontSize: ${map[n]}`;
    }
    return match; // leave off-scale values unchanged
  });

  if (replaced !== content) {
    modified = true;
    content = replaced;
    totalReplacements += fileReplacements;
  }

  // Collect off-scale values for reporting
  const remaining = content.match(/fontSize:\s*\d+(?=[,\s\}])/g) || [];
  remaining.forEach(m => {
    const val = Number(m.match(/\d+/)[0]);
    if (!inScaleValues.has(val)) {
      if (!offScaleMap[val]) offScaleMap[val] = new Set();
      offScaleMap[val].add(path.relative(path.join(__dirname, '..', 'src'), filePath));
    }
  });

  if (modified) {
    // Ensure Typography is imported if we used it
    const needsTypography = content.includes('Typography.fontSize');
    const alreadyHasTypography = /import\s*\{[^}]*Typography[^}]*\}/.test(content);

    if (needsTypography && !alreadyHasTypography) {
      // Add Typography to existing theme import
      const themeImportRegex = /import\s*\{([^}]+)\}\s*from\s*(['"])((?:\.\.\/)+theme)\2/;
      if (themeImportRegex.test(content)) {
        content = content.replace(themeImportRegex, (match, imports) => {
          if (imports.includes('Typography')) return match;
          return match.replace(imports, imports.trimEnd() + ', Typography');
        });
      }
      // If no theme import exists at all, we leave it (edge case)
    }

    fs.writeFileSync(filePath, content, 'utf8');
    totalFiles++;
    const rel = path.relative(path.join(__dirname, '..', 'src'), filePath);
    console.log(`  [${fileReplacements}] ${rel}`);
  }
});

console.log(`\n완료: ${totalFiles}개 파일, ${totalReplacements}개 교체`);
console.log('\nOff-scale (수동 확인 필요):');
Object.entries(offScaleMap)
  .sort((a, b) => Number(a[0]) - Number(b[0]))
  .forEach(([val, files]) => {
    const arr = [...files];
    console.log(`  ${val}px → ${arr.length}개 파일: ${arr.slice(0, 3).join(', ')}${arr.length > 3 ? ` ... +${arr.length - 3}` : ''}`);
  });
