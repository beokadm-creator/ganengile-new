/**
 * Enterprise Legacy Navigator
 * Legacy enterprise customer stack preserved for compatibility.
 * New B2B semantics belong to external delivery partners, not enterprise customers.
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { View, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { EnterpriseLegacyStackParamList } from '../types/navigation';

import EnterpriseLegacyDashboardScreen from '../screens/enterprise-legacy/EnterpriseLegacyDashboardScreen';
import EnterpriseLegacyRequestScreen from '../screens/enterprise-legacy/EnterpriseLegacyRequestScreen';
import EnterpriseLegacyGillerScreen from '../screens/enterprise-legacy/EnterpriseLegacyGillerScreen';
import EnterpriseLegacyMatchingResultScreen from '../screens/enterprise-legacy/EnterpriseLegacyMatchingResultScreen';
import EnterpriseLegacyOnboardingScreen from '../screens/enterprise-legacy/EnterpriseLegacyOnboardingScreen';
import BusinessProfileScreen from '../screens/enterprise-legacy/BusinessProfileScreen';
import MonthlySettlementScreen from '../screens/enterprise-legacy/MonthlySettlementScreen';
import SubscriptionTierSelectionScreen from '../screens/enterprise-legacy/SubscriptionTierSelectionScreen';
import TaxInvoiceRequestScreen from '../screens/enterprise-legacy/TaxInvoiceRequestScreen';

const Stack = createStackNavigator<EnterpriseLegacyStackParamList>();

export default function EnterpriseLegacyNavigator() {
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
        name="EnterpriseLegacyDashboard"
        component={EnterpriseLegacyDashboardScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="EnterpriseLegacyRequest"
        component={EnterpriseLegacyRequestScreen}
        options={{ headerShown: true, title: '기업 고객 배송 요청' }}
      />
      <Stack.Screen
        name="EnterpriseLegacyGiller"
        component={EnterpriseLegacyGillerScreen}
        options={{ headerShown: true, title: '기업 계약 길러 운영' }}
      />
      <Stack.Screen
        name="EnterpriseLegacyMatchingResult"
        component={EnterpriseLegacyMatchingResultScreen}
        options={{ headerShown: true, title: '매칭 결과' }}
      />
      <Stack.Screen
        name="EnterpriseLegacyOnboarding"
        component={EnterpriseLegacyOnboardingScreen}
        options={{ headerShown: true, title: '기업 고객 계약 등록' }}
      />
      <Stack.Screen
        name="BusinessProfile"
        component={BusinessProfileScreen}
        options={{ headerShown: true, title: '기업 고객 프로필' }}
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
