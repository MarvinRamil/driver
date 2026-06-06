const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Required for expo-doctor / EAS to detect an Expo-based Metro config
config.transformer = {
  ...config.transformer,
  _expoRelativeProjectRoot: __dirname,
};

module.exports = config;
