/**
 * Test Config Structure
 * Verify data structure without writing to Firebase
 */

const fs = require('fs');
const path = require('path');

console.log('='.repeat(60));
console.log('🔍 Config Data Structure Test');
console.log('='.repeat(60));

// Read data files
const dataDir = path.join(__dirname, '../data');

// 1. Test Stations
console.log('\n🚉 Testing Stations...');
try {
  const stationsContent = fs.readFileSync(path.join(dataDir, 'subway-stations.ts'), 'utf8');
  
  // Count stations
  const stationMatches = stationsContent.match(/\{[\s\S]{100,500}stationId:/g);
  const stationCount = stationMatches ? stationMatches.length : 0;
  
  console.log(`  ✅ Found ${stationCount} stations`);
  
  // Extract sample station
  const sampleMatch = stationsContent.match(/stationId: '(\w+)'/);
  if (sampleMatch) {
    console.log(`  ✅ Sample station ID: ${sampleMatch[1]}`);
  }
} catch (error) {
  console.error(`  ❌ Error reading stations:`, error.message);
}

// 2. Test Travel Times
console.log('\n🚄 Testing Travel Times...');
try {
  const travelContent = fs.readFileSync(path.join(dataDir, 'travel-times.ts'), 'utf8');
  
  // Count routes
  const routeMatches = travelContent.match(/'[\w]+-[\w]+':\s*\{/g);
  const routeCount = routeMatches ? routeMatches.length : 0;
  
  console.log(`  ✅ Found ${routeCount} routes`);
  
  // Extract sample route
  const sampleMatch = travelContent.match(/'(\d+-\d+)':/);
  if (sampleMatch) {
    console.log(`  ✅ Sample route: ${sampleMatch[1]}`);
  }
} catch (error) {
  console.error(`  ❌ Error reading travel times:`, error.message);
}

// 3. Test Express Trains
console.log('\n🚄 Testing Express Trains...');
try {
  const expressContent = fs.readFileSync(path.join(dataDir, 'express-trains.ts'), 'utf8');
  
  // Count express trains
  const expressMatches = expressContent.match(/\{[\s\S]{50,200}lineId:/g);
  const expressCount = expressMatches ? expressMatches.length : 0;
  
  console.log(`  ✅ Found ${expressCount} express train schedules`);
  
  // Extract sample line
  const sampleMatch = expressContent.match(/lineId:\s*['"](\w+)['"]/);
  if (sampleMatch) {
    console.log(`  ✅ Sample line: ${sampleMatch[1]}`);
  }
} catch (error) {
  console.error(`  ❌ Error reading express trains:`, error.message);
}

// 4. Test Congestion
console.log('\n👥 Testing Congestion Data...');
try {
  const congestionContent = fs.readFileSync(path.join(dataDir, 'congestion.ts'), 'utf8');
  
  // Count lines
  const lineMatches = congestionContent.match(/\{[\s\S]{50,200}lineId:/g);
  const lineCount = lineMatches ? lineMatches.length : 0;
  
  console.log(`  ✅ Found ${lineCount} lines with congestion data`);
  
  // Extract sample line
  const sampleMatch = congestionContent.match(/lineId:\s*['"](\w+)['"]/);
  if (sampleMatch) {
    console.log(`  ✅ Sample line: ${sampleMatch[1]}`);
  }
} catch (error) {
  console.error(`  ❌ Error reading congestion data:`, error.message);
}

// 5. Test Algorithm Params
console.log('\n⚙️  Testing Algorithm Params...');
try {
  const initConfigContent = fs.readFileSync(path.join(__dirname, 'init-config.ts'), 'utf8');
  
  // Check if algorithm params are defined
  const hasWeights = initConfigContent.includes('timeEfficiency: 0.5');
  const hasScoring = initConfigContent.includes('travelTime:');
  const hasLimits = initConfigContent.includes('maxMatchesPerRequest');
  
  if (hasWeights && hasScoring && hasLimits) {
    console.log(`  ✅ Algorithm params defined in init-config.ts`);
    console.log(`  ✅ Contains weights, scoring, and limits`);
  } else {
    console.log(`  ⚠️  Some algorithm params may be missing`);
  }
} catch (error) {
  console.error(`  ❌ Error reading algorithm params:`, error.message);
}

console.log('\n' + '='.repeat(60));
console.log('✅ Data Structure Test Complete!');
console.log('='.repeat(60));
console.log('\nNext steps:');
console.log('1. Install ts-node: npm install --save-dev ts-node');
console.log('2. Run init script: npm run init-config');
console.log('3. Or run with verbose: npm run init-config -- --verbose');
console.log();
