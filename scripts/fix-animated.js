const fs = require('fs');
const path = require('path');

const files = [
  'src/components/common/Toast.tsx',
  'src/components/common/Animations.tsx',
  'src/screens/main/MatchingResultScreen.tsx',
  'src/components/OfflineIndicator.tsx',
  'src/components/common/RouteVisualization.tsx',
  'src/components/RoleSwitcher.tsx',
  'src/components/onetime/ModeToggleSwitch.tsx',
  'src/components/ModeToggleSwitch.tsx',
  'src/components/matching/GillerProfileCard.tsx',
  'src/screens/main/home/components/SharedHomeComponents.tsx',
  'src/utils/success-animation.tsx',
  'src/components/common/Card.tsx'
];

for (const file of files) {
  const fullPath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(fullPath)) continue;

  let content = fs.readFileSync(fullPath, 'utf8');
  
  if (!content.includes('useNativeDriver: true')) continue;

  // Add Platform to react-native imports
  if (!content.includes('Platform,')) {
    content = content.replace(/import\s+{([^}]*)}\s+from\s+['"]react-native['"];/g, (match, p1) => {
      if (!p1.includes('Platform')) {
        return `import { Platform, ${p1.trim()} } from 'react-native';`;
      }
      return match;
    });
  }

  // Replace useNativeDriver: true
  content = content.replace(/useNativeDriver:\s*true/g, "useNativeDriver: Platform.OS !== 'web'");

  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`Updated ${file}`);
}
