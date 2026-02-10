/**
 * App Entry Point
 */

import React from 'react';
import { ActivityIndicator, View, Platform } from 'react-native';
import { useFonts } from 'expo-font';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  // 웹 환경에서는 폰트 로딩을 무시하고 바로 렌더링
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    ...MaterialIcons.font,
  });

  // 웰에서는 항상 렌더링, 네이티브에서는 폰트 로딩 대기
  if (!fontsLoaded && Platform.OS !== 'web') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <AppNavigator />;
}
