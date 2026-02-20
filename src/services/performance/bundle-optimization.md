/**
 * Bundle Size Optimization Guide
 * Code splitting, lazy loading, and tree shaking
 */

// ==================== Code Splitting Strategy ====================

/**
 * CODE SPLITTING APPROACHES:
 * 
 * 1. ROUTE-BASED SPLITTING
 *    - Split code by navigation routes
 *    - Lazy load screens
 *    - Reduces initial bundle size
 * 
 * 2. FEATURE-BASED SPLITTING
 *    - Split heavy features (chat, map, etc.)
 *    - Load on demand
 * 
 * 3. THIRD-PARTY LIBRARIES
 *    - Lazy load non-critical libraries
 *    - Use CDN when possible
 * 
 * EXAMPLE IMPLEMENTATIONS:
 */

// ❌ BAD: Import all screens upfront
import { HomeScreen } from './screens/HomeScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ChatScreen } from './screens/ChatScreen';

// ✅ GOOD: Lazy load screens
import { lazy } from 'react';

const HomeScreen = lazy(() => import('./screens/HomeScreen'));
const ProfileScreen = lazy(() => import('./screens/ProfileScreen'));
const SettingsScreen = lazy(() => import('./screens/SettingsScreen'));
const ChatScreen = lazy(() => import('./screens/ChatScreen'));

// ==================== Navigation Code Splitting ====================

/**
 * Setup code splitting with React Navigation
 */
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

const Stack = createStackNavigator();

function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          // Suspense fallback while loading lazy screens
          // This shows a loading indicator
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'Home' }}
        />
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ title: 'Profile' }}
        />
        {/* Other screens... */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ==================== Lazy Loading Heavy Components ====================

/**
 * Lazy load components that aren't immediately visible
 */
import { Suspense, lazy } from 'react';

// Heavy chart library
const ChartView = lazy(() => import('./components/ChartView'));

// Rich text editor
const RichTextEditor = lazy(() => import('./components/RichTextEditor'));

// Map view
const MapView = lazy(() => import('./components/MapView'));

export function Dashboard() {
  return (
    <View>
      <Suspense fallback={<LoadingIndicator />}>
        <ChartView data={chartData} />
      </Suspense>

      {/* Only load editor when needed */}
      {isEditing && (
        <Suspense fallback={<LoadingIndicator />}>
          <RichTextEditor />
        </Suspense>
      )}

      {/* Load map when tab is active */}
      {activeTab === 'map' && (
        <Suspense fallback={<LoadingIndicator />}>
          <MapView />
        </Suspense>
      )}
    </View>
  );
}

// ==================== Tree Shaking Best Practices ====================

/**
 * TREE SHAKING TIPS:
 * 
 * 1. USE ES MODULES
 *    - Modern bundlers support tree shaking
 *    - Avoid CommonJS if possible
 * 
 * 2. AVOID WHOLE LIBRARY IMPORTS
 *    - Import only what you need
 *    - Use named exports
 * 
 * 3. USE MODERN LINTING
 *    - Enable sideEffects: false in package.json
 *    - Use @babel/preset-env
 */

// ❌ BAD: Import entire library
import _ from 'lodash';
import * as Moment from 'moment';

// ✅ GOOD: Import specific functions
import debounce from 'lodash/debounce';
import throttle from 'lodash/throttle';
import { format } from 'date-fns';

// ==================== Third-Party Library Optimization ====================

/**
 * OPTIMIZING COMMON LIBRARIES:
 * 
 * 1. MOMENT/DATE-FNS
 *    - Use date-fns (tree-shakeable)
 *    - Avoid moment.js (large bundle)
 * 
 * 2. LODASH
 *    - Use lodash-es (ES modules)
 *    - Or import individual functions
 * 
 * 3. FIREBASE
 *    - Import only services you use
 *    - Use compat libraries for tree shaking
 * 
 * 4. ICONS
 *    - Use vector icons instead of images
 *    - Lazy load icon sets
 * 
 * EXAMPLES:
 */

// ❌ BAD: Import all Firebase services
import * as firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/auth';
import 'firebase/storage';
import 'firebase/messaging';

// ✅ GOOD: Import only what's needed
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getMessaging } from 'firebase/messaging';

// ==================== Bundle Analysis ====================

/**
 * MEASURING BUNDLE SIZE:
 * 
 * 1. WEB:
 *    - Use webpack-bundle-analyzer
 *    - Run: npm run build:analyze
 *    - Shows module sizes visually
 * 
 * 2. REACT NATIVE:
 *    - Use bundleizer
 *    - Check Metro bundler output
 *    - Profile with React DevTools
 * 
 * TARGET BUNDLE SIZES:
 * 
 * Initial Bundle (JS):
 * - Excellent: < 200KB
 * - Good: 200-400KB
 * - Warning: 400-600KB
 * - Critical: > 600KB
 * 
 * Total Bundle (including assets):
 * - Excellent: < 1MB
 * - Good: 1-2MB
 * - Warning: 2-3MB
 * - Critical: > 3MB
 */

// ==================== Metro Bundler Optimization ====================

/**
 * METRO CONFIGURATION FOR OPTIMAL BUNDLING:
 * 
 * File: metro.config.js
 */
module.exports = {
  resolver: {
    // Enable source maps for debugging
    sourceExts: ['jsx', 'js', 'ts', 'tsx', 'json'],
  },
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: false,
      },
      // Enable Hermes for smaller bundles
      minifierConfig: {
        keep_classnames: false,
        keep_fnames: false,
        mangle: {
          keep_fnames: false,
          keep_classnames: false,
        },
      },
    }),
  },
  // Reset cache to ensure clean builds
  resetCache: false,
  maxWorkers: 2, // Limit workers for faster builds
};

// ==================== Production Build Settings ====================

/**
 * OPTIMIZING PRODUCTION BUILDS:
 * 
 * ANDROID:
 * - Enable ProGuard: android/app/build.gradle
 * - Enable code shrinking
 * - Use release configuration
 * 
 * IOS:
 * - Enable bitcode
 * - Strip debug symbols
 * - Use release build
 * 
 * WEB:
 * - Enable compression
 * - Use Brotli compression
 * - Minify JavaScript
 */

// ==================== Dynamic Imports ====================

/**
 * Use dynamic imports for code splitting
 */
export async function loadChatModule() {
  const { ChatService } = await import('./services/chat-service');
  return ChatService;
}

export async function loadMapModule() {
  const { MapService } = await import('./services/map-service');
  return MapService;
}

// ==================== Environment-Specific Builds ====================

/**
 * Create different builds for development/production
 * 
 * DEV: Full debugging, hot reload
 * PROD: Optimized, minified, no debugging
 */

// Development build includes dev tools
if (__DEV__) {
  console.log('Running in development mode');
  // Enable React DevTools
  // Enable debugging
} else {
  console.log('Running in production mode');
  // Disable debugging
  // Enable performance monitoring
}

// ==================== Compression Plugin ====================

/**
 * Enable compression for production builds
 * 
 * WEB: Use compression middleware
 * ANDROID: Enable deflate compression
 * IOS: Automatic with HTTP/2
 */

// ==================== Bundle Size Budgets ====================

/**
 * SET BUNDLE SIZE BUDGETS IN package.json:
 */
{
  "scripts": {
    "build:check-size": "bundlesize",
    "analyze": "webpack-bundle-analyzer"
  },
  "bundlesize": {
    "path": "./build",
    "maxSize": "200 kB",
    "compression": "gzip"
  }
}

// ==================== Lazy Loading Screens ====================

/**
 * PRACTICAL EXAMPLES OF LAZY LOADED SCREENS
 */

// Heavy analytics screen
const AnalyticsScreen = lazy(() =>
  import('./screens/AnalyticsScreen').then(m => ({
    default: m.AnalyticsScreen
  }))
);

// Settings with many options
const SettingsScreen = lazy(() =>
  import('./screens/SettingsScreen').then(m => ({
    default: m.SettingsScreen
  }))
);

// Photo editor
const PhotoEditorScreen = lazy(() =>
  import('./screens/PhotoEditorScreen').then(m => ({
    default: m.PhotoEditorScreen
  }))
);

// ==================== Preloading Critical Code ====================

/**
 * PRELOAD STRATEGY:
 * 
 * 1. INITIAL SCREEN (CRITICAL)
 *    - Load immediately
 *    - No lazy loading
 * 
 * 2. SECOND SCREENS (IMPORTANT)
 *    - Preload after initial render
 *    - Reduce perceived load time
 * 
 * 3. RARELY USED SCREENS
 *    - Load on demand
 *    - Accept initial load delay
 */

// Preload after app launch
useEffect(() => {
  const timer = setTimeout(() => {
    // Preload frequently accessed screens
    import('./screens/ProfileScreen');
    import('./screens/RequestsScreen');
  }, 2000);

  return () => clearTimeout(timer);
}, []);
