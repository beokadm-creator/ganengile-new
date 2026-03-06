import { registerRootComponent } from 'expo';
import App from './App';

// Root component registration with error boundary
try {
  console.log('🚀 registerRootComponent called');
  registerRootComponent(App);
} catch (error) {
  console.error('❌ Critical error during registerRootComponent:', error);
}
