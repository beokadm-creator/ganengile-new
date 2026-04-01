import fs from 'fs';
import path from 'path';

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('Colors.')) {
    // Check if imported
    if (!content.includes('import ') || (!content.includes('Colors') || !content.match(/import\s+.*Colors.*from/))) {
      // It uses Colors. but doesn't import Colors!
      return true;
    }
  }
  // Check index-5932... js file context? No, wait, just check tsx files line 1 to 5 to see if Colors is imported.
  const lines = content.split('\n');
  const importsColors = lines.some(line => line.includes('import') && line.includes('Colors'));
  if (content.includes('Colors.') && !importsColors) {
     return true;
  }
  return false;
}

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(fullPath);
    }
  });
  return results;
}

const targetDir = path.join(process.cwd(), 'src');
const allFiles = walk(targetDir);
for (const file of allFiles) {
  if (processFile(file)) {
    console.log(`Missing import in: ${file}`);
  }
}
