const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add module resolution for react-native-worklets
config.resolver.alias = {
  'react-native-worklets': 'react-native-worklets-core',
};

module.exports = config;
