const fs = require('fs');
const { execSync } = require('child_process');

// Get all files with unused vars
const output = execSync('npm run lint 2>&1', { encoding: 'utf-8' });
const unusedVarLines = output.split('\n')
  .filter(line => line.includes('no-unused-vars'))
  .map(line => {
    const match = line.match(/^([^:]+):(\d+):\d+:\s+error\s+'([^']+)' is (?:assigned|defined) but never used/);
    if (match) {
      return { file: match[1], line: parseInt(match[2]), varName: match[3] };
    }
    return null;
  })
  .filter(item => item !== null);

console.log(`Found ${unusedVarLines.length} unused variables`);

// Fix by adding underscore prefix
let fixedCount = 0;
const processedFiles = new Set();

unusedVarLines.forEach(({ file, line, varName }) => {
  if (processedFiles.has(file)) return;
  
  try {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    
    // Add underscore prefix to unused parameter
    if (line > 0 && line <= lines.length) {
      const targetLine = lines[line - 1];
      // Pattern: parameter names that are unused
      const fixedLine = targetLine
        .replace(new RegExp(`(,\\s*)(${varName})(\\s*[),])`), '$1_$2$3')
        .replace(new RegExp(`(\\(\\s*)(${varName})(\\s*[),])`), '$1_$2$3');
      
      if (fixedLine !== targetLine) {
        lines[line - 1] = fixedLine;
        fs.writeFileSync(file, lines.join('\n'));
        fixedCount++;
        processedFiles.add(file);
        console.log(`Fixed ${file}:${line} - ${varName}`);
      }
    }
  } catch (err) {
    console.error(`Error processing ${file}:`, err.message);
  }
});

console.log(`\nTotal fixes: ${fixedCount}`);
