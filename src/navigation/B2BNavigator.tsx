/**
 * B2B Navigator
 * Stack navigator for B2B (business) screens
 * 湲곗뾽 怨좉컼 ?꾩슜 ?ㅻ퉬寃뚯씠?? */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { View, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { B2BStackParamList } from '../types/navigation';

// B2B Screens
import B2BDashboardScreen from '../screens/b2b/B2BDashboardScreen';
import B2BRequestScreen from '../screens/b2b/B2BRequestScreen';
import B2BGillerScreen from '../screens/b2b/B2BGillerScreen';
import B2BMatchingResultScreen from '../screens/b2b/B2BMatchingResultScreen';
import B2BOnboardingScreen from '../screens/b2b/B2BOnboardingScreen';
import BusinessProfileScreen from '../screens/b2b/BusinessProfileScreen';
import MonthlySettlementScreen from '../screens/b2b/MonthlySettlementScreen';
import SubscriptionTierSelectionScreen from '../screens/b2b/SubscriptionTierSelectionScreen';
import TaxInvoiceRequestScreen from '../screens/b2b/TaxInvoiceRequestScreen';

const Stack = createStackNavigator<B2BStackParamList>();

export default function B2BNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        headerBackTitle: '뒤로',
        headerTitleAlign: 'center',
        headerTitleStyle: { fontWeight: '800', fontSize: 18 },
        headerStyle: {
          backgroundColor: '#fff',
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
          elevation: 6,
        },
        headerTintColor: '#111827',
        headerLeftContainerStyle: { paddingLeft: 12 },
        headerBackImage: ({ tintColor }) => (
          <View style={styles.stackBackIconWrap}>
            <MaterialIcons name="arrow-back-ios-new" size={22} color={tintColor || '#111827'} />
          </View>
        ),
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        cardOverlayEnabled: true,
        cardShadowEnabled: true,
        cardStyle: { flex: 1 },
      }}
    >
      <Stack.Screen
        name="B2BDashboard"
        component={B2BDashboardScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="B2BRequest"
        component={B2BRequestScreen}
        options={{ headerShown: true, title: '배송 요청' }}
      />
      <Stack.Screen
        name="B2BGiller"
        component={B2BGillerScreen}
        options={{ headerShown: true, title: '길러 관리' }}
      />
      <Stack.Screen
        name="B2BMatchingResult"
        component={B2BMatchingResultScreen}
        options={{ headerShown: true, title: '매칭 결과' }}
      />
      <Stack.Screen
        name="B2BOnboarding"
        component={B2BOnboardingScreen}
        options={{ headerShown: true, title: 'B2B 가입' }}
      />
      <Stack.Screen
        name="BusinessProfile"
        component={BusinessProfileScreen}
        options={{ headerShown: true, title: '기업 프로필' }}
      />
      <Stack.Screen
        name="MonthlySettlement"
        component={MonthlySettlementScreen}
        options={{ headerShown: true, title: '월 정산' }}
      />
      <Stack.Screen
        name="SubscriptionTierSelection"
        component={SubscriptionTierSelectionScreen}
        options={{ headerShown: true, title: '구독 관리' }}
      />
      <Stack.Screen
        name="TaxInvoiceRequest"
        component={TaxInvoiceRequestScreen}
        options={{ headerShown: true, title: '세금계산서' }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  stackBackIconWrap: {
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
});
