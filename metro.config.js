const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.alias = {
  'react-native-worklets': 'react-native-worklets-core',
};

config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];
config.resolver.assetExts = [...config.resolver.assetExts, 'ttf', 'otf', 'woff', 'woff2'];

module.exports = config;
