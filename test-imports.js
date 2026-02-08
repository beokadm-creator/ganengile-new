// Simple test to verify data structure
const fs = require('fs');
const path = require('path');

// Read TypeScript files and count exports
const files = [
  'data/subway-stations.ts',
  'data/travel-times.ts',
  'data/express-trains.ts',
  'data/congestion.ts'
];

for (const file of files) {
  const content = fs.readFileSync(path.join(__dirname, file), 'utf8');
  const lines = content.split('\n').filter(line => line.includes('export const'));
  console.log(`📄 ${file}:`);
  console.log(`   ${lines.length} exports`);
  lines.forEach(line => console.log(`   - ${line.trim()}`));
  console.log();
}
