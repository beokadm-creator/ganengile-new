import { registerRootComponent } from 'expo';
import App from './App';

// 웹 환경에서 useNativeDriver 비활성화
if (typeof window !== 'undefined') {
  // React Native Reanimated 웹 설정
  if (typeof window !== 'undefined' && !(window as any).__REANIMATED_WEB_ENABLED__) {
    (window as any).__REANIMATED_WEB_ENABLED__ = true;
  }
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
