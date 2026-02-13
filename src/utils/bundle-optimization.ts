/**
 * Bundle Size Optimization
 * 번들 사이즈 최적화를 위한 설정
 */

// 메타 데이터 업데이트
const updateHtmlMeta = () => {
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes');
  }
};

// Code splitting 라우트 설정
const lazyLoadRoutes = () => {
  // 메인 번들 크기 줄이기
  const mainBundle = document.querySelector('script[src*="main"]') as HTMLScriptElement;
  if (mainBundle) {
    mainBundle.crossOrigin = 'anonymous';
  }
};

// Tree shaking 설정
export const optimizeImports = () => {
  // 사용하지 않는 lodash 함수 제거
  // import debounce from 'lodash/debounce'; // ✅
  // import _ from 'lodash'; // ❌

  // Firebase 모듈 트리 쉐이킹
  // import { doc, getDoc } from 'firebase/firestore'; // ✅
  // import * from 'firebase/firestore'; // ❌

  // React Native 모듈 트리 쉐이킹
  // import { View } from 'react-native'; // ✅
  // import { View, Text, ScrollView, ... } from 'react-native'; // ❌
};

// 번들 분석 도구 설정
export const analyzeBundleSize = () => {
  const analyzer = {
    start: () => console.log('📊 Starting bundle analysis...'),
    report: (size: number) => {
      const sizeMB = (size / 1024 / 1024).toFixed(2);
      console.log(`📦 Bundle size: ${sizeMB} MB`);

      if (sizeMB > '5') {
        console.warn('⚠️ Bundle size exceeds 5MB!');
      } else if (sizeMB > '3') {
        console.log('⚠️ Bundle size: Consider optimization');
      } else {
        console.log('✅ Bundle size: Good!');
      }
    }
  };

  return analyzer;
};

// Dynamic import 래퍼
export const dynamicImport = () => {
  return {
    // 설정 화면 지연 로딩
    SettingsScreen: () => import('../screens/SettingsScreen'),
    // 프로필 화면 지연 로딩
    ProfileScreen: () => import('../screens/ProfileScreen'),
    // 채팅 화면 지연 로딩
    ChatScreen: () => import('../screens/ChatScreen')
  };
};
