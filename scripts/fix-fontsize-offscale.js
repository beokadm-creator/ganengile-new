/**
 * Fix off-scale fontSize values with per-file decisions
 */
const fs = require('fs');
const path = require('path');

const srcBase = path.join(__dirname, '..', 'src');

const fixes = [
  // 22px → 3xl(24): section/modal headings (RequestMatchScoreBadge large score also → 24)
  {
    file: 'components/common/NearbyStationRecommendationsModal.tsx',
    from: /fontSize:\s*22(?=[,\s\}])/g,
    to: "fontSize: Typography.fontSize['3xl']",
  },
  {
    file: 'components/matching/RequestMatchScoreBadge.tsx',
    from: /fontSize:\s*22(?=[,\s\}])/g,
    to: "fontSize: Typography.fontSize['3xl']",
  },
  {
    file: 'screens/main/DeliveryTrackingScreen.tsx',
    from: /fontSize:\s*22(?=[,\s\}])/g,
    to: "fontSize: Typography.fontSize['3xl']",
  },
  {
    file: 'screens/main/TermsScreen.tsx',
    from: /fontSize:\s*22(?=[,\s\}])/g,
    to: "fontSize: Typography.fontSize['3xl']",
  },
  // 26px → 4xl(28): screen titles
  {
    file: 'screens/main/IdentityVerificationScreen.tsx',
    from: /fontSize:\s*26(?=[,\s\}])/g,
    to: "fontSize: Typography.fontSize['4xl']",
  },
  {
    file: 'screens/main/TermsScreen.tsx',
    from: /fontSize:\s*26(?=[,\s\}])/g,
    to: "fontSize: Typography.fontSize['4xl']",
  },
];

fixes.forEach(({ file, from, to }) => {
  const full = path.join(srcBase, file);
  if (!fs.existsSync(full)) {
    console.log(`  SKIP (not found): ${file}`);
    return;
  }
  let content = fs.readFileSync(full, 'utf8');
  const replaced = content.replace(from, to);
  if (replaced !== content) {
    fs.writeFileSync(full, replaced, 'utf8');
    console.log(`  FIXED: ${file}`);
  } else {
    console.log(`  NO MATCH: ${file}`);
  }
});

console.log('\nDone.');
