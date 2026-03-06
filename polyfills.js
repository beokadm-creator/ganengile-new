/**
 * React Native Web Polyfills
 * 웹 환경에서 React Native 모듈을 지원하기 위한 polyfills
 */

// Process polyfill
if (typeof window !== 'undefined' && typeof process === 'undefined') {
  window.process = {
    env: {},
  };
}

// React Native modules polyfills
if (typeof window !== 'undefined') {
  // AsyncStorage polyfill (localStorage wrapper)
  if (!window.ReactNativeAsyncStorage) {
    window.ReactNativeAsyncStorage = {
      getItem: (key) => Promise.resolve(localStorage.getItem(key)),
      setItem: (key, value) => Promise.resolve(localStorage.setItem(key, value)),
      removeItem: (key) => Promise.resolve(localStorage.removeItem(key)),
      clear: () => Promise.resolve(localStorage.clear()),
    };
  }

  // Platform module
  if (!window.Platform) {
    window.Platform = {
      OS: 'web',
      select: (obj) => obj.web || obj.default,
    };
  }
}

console.log('✅ Polyfills loaded');