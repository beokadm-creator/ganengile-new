import { registerRootComponent } from 'expo';
import App from './App';

// React Native Gesture Handler for web
import { gestureHandlerRootHOC } from 'react-native-gesture-handler';

// Wrap App with gesture handler for better web touch support
const WrappedApp = gestureHandlerRootHOC(App);

// Root component registration with error boundary
try {
  console.log('🚀 registerRootComponent called');
  registerRootComponent(WrappedApp);
} catch (error) {
  console.error('❌ Critical error during registerRootComponent:', error);
}
