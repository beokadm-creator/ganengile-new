/**
 * Web Entry Point with Polyfills
 */

// Load polyfills first
console.log('🚀 index.web.js starting...');
import './polyfills';
console.log('📦 index.web.js polyfills loaded');

// Import App
import App from './App';
import { registerRootComponent } from 'expo';

// Register the app
registerRootComponent(App);