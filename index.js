// Web entry point for React Native Web
import React from 'react';
import { AppRegistry } from 'react-native';
import App from './App';
import { getStorybookUI } from '@storybook/react-native';

// Register the app
AppRegistry.registerComponent('main', () => App);

// Render the app
const rootTag = document.getElementById('root');
if (rootTag) {
  const { element } = AppRegistry.getApplication('main');
  
  // Create a React root
  const { createRoot } = require('react-dom/client');
  const root = createRoot(rootTag);
  root.render(element);
}

// Enable fast refresh
if (module.hot) {
  module.hot.accept();
}
