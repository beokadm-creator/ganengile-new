/**
 * Main Navigator
 * Tab navigator for authenticated screens with stack for modals
 * Role-based tab configuration
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { MainTabParamList } from '../types/navigation';
import { useUser } from '../contexts/UserContext';
import { Colors } from '../components';

// Screens
import HomeScreen from '../screens/main/HomeScreen';
import AddRouteScreen from '../screens/main/AddRouteScreen';
import EditRouteScreen from '../screens/main/EditRouteScreen';
import RequestsScreen from '../screens/main/RequestsScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import CreateRequestScreen from '../screens/main/CreateRequestScreen';
import RequestDetailScreen from '../screens/main/RequestDetailScreen';
import GillerRequestsScreen from '../screens/main/GillerRequestsScreen';
import DeliveryTrackingScreen from '../screens/main/DeliveryTrackingScreen';
import RouteManagementScreen from '../screens/main/RouteManagementScreen';
import MatchingResultScreen from '../screens/main/MatchingResultScreen';
import PickupVerificationScreen from '../screens/main/PickupVerificationScreen';
import DeliveryCompletionScreen from '../screens/main/DeliveryCompletionScreen';
import RatingScreen from '../screens/main/RatingScreen';
import ChatListScreen from '../screens/main/ChatListScreen';
import ChatScreen from '../screens/main/ChatScreen';
import NotificationSettingsScreen from '../screens/main/NotificationSettingsScreen';
import EarningsScreen from '../screens/main/EarningsScreen';
import MyRatingScreen from '../screens/main/MyRatingScreen';
import CustomerServiceScreen from '../screens/main/CustomerServiceScreen';
import TermsScreen from '../screens/main/TermsScreen';
import DepositPaymentScreen from '../screens/main/DepositPaymentScreen';
import PointHistoryScreen from '../screens/main/PointHistoryScreen';
import PointWithdrawScreen from '../screens/main/PointWithdrawScreen';
import GillerPickupFromLockerScreen from '../screens/requester/GillerPickupFromLockerScreen';
import GillerLevelUpgradeScreen from '../screens/main/GillerLevelUpgradeScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createStackNavigator();

function TabBarIcon({ name, focused }: { name: string; focused: boolean }) {
  const emojiMap: { [key: string]: string } = {
    Home: '🏠',
    RouteManagement: '🗺️',
    Requests: '📋',
    GillerRequests: '🚴',
    ChatList: '💬',
    Profile: '👤',
  };

  const emoji = emojiMap[name] || '•';

  if (Platform.OS === 'web') {
    return <Text style={{ fontSize: 24, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
  }

  const icons: { [key: string]: { name: keyof typeof Ionicons.glyphMap } } = {
    Home: { name: 'home' },
    RouteManagement: { name: 'map' },
    Requests: { name: 'cube' },
    GillerRequests: { name: 'bicycle' },
    Profile: { name: 'person' },
  };

  const icon = icons[name as keyof typeof icons] || { name: 'ellipse' };

  return (
    <Ionicons
      name={icon.name}
      size={24}
      color={focused ? Colors.secondary : Colors.text.disabled}
    />
  );
}

function TabNavigator() {
  const { currentRole } = useUser();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => (
          <TabBarIcon name={route.name} focused={focused} />
        ),
        tabBarActiveTintColor: '#4CAF50',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e0e0e0',
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerShown: false,
      })}
    >
      {/* Common tabs for all roles */}
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: '홈' }}
      />

      {/* Gller-specific tabs */}
      {(currentRole === 'gller' || currentRole === 'both') && (
        <>
          <Tab.Screen
            name="Requests"
            component={RequestsScreen}
            options={{ tabBarLabel: '요청 목록' }}
          />
        </>
      )}

      {/* Giller-specific tabs */}
      {(currentRole === 'giller' || currentRole === 'both') && (
        <>
          <Tab.Screen
            name="GillerRequests"
            component={GillerRequestsScreen}
            options={{ tabBarLabel: '배송 매칭' }}
          />
        </>
      )}

      {/* Route Management for both roles (positioned after role-specific tabs) */}
      <Tab.Screen
        name="RouteManagement"
        component={RouteManagementScreen}
        options={{ tabBarLabel: '동선 관리' }}
      />

      {/* Chat tab for all */}
      <Tab.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{ tabBarLabel: '채팅' }}
      />

      {/* Profile tab for all */}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: '프로필' }}
      />
    </Tab.Navigator>
  );
}

export default function MainNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        headerBackTitle: '뒤로',
        headerTitleAlign: 'center',
        headerTitleStyle: { fontWeight: 'bold', fontSize: 18 },
        headerStyle: {
          backgroundColor: '#fff',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        },
        headerTintColor: '#333',
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        cardOverlayEnabled: true,
        cardShadowEnabled: true,
      }}
    >
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen
        name="CreateRequest"
        component={CreateRequestScreen}
        options={{
          headerShown: true,
          title: '배송 요청하기',
        }}
      />
      <Stack.Screen
        name="AddRoute"
        component={AddRouteScreen}
        options={{
          headerShown: true,
          title: '동선 등록',
        }}
      />
      <Stack.Screen
        name="EditRoute"
        component={EditRouteScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="RequestDetail"
        component={RequestDetailScreen as any}
        options={{
          headerShown: true,
          title: '요청 상세',
        }}
      />
      <Stack.Screen
        name="DeliveryTracking"
        component={DeliveryTrackingScreen as any}
        options={{
          headerShown: true,
          title: '배송 추적',
        }}
      />
      <Stack.Screen
        name="MatchingResult"
        component={MatchingResultScreen as any}
        options={{
          headerShown: true,
          title: '매칭 결과',
        }}
      />
      <Stack.Screen
        name="PickupVerification"
        component={PickupVerificationScreen as any}
        options={{
          headerShown: true,
          title: '픽업 인증',
        }}
      />
      <Stack.Screen
        name="DeliveryCompletion"
        component={DeliveryCompletionScreen as any}
        options={{
          headerShown: true,
          title: '배송 완료',
        }}
      />
      <Stack.Screen
        name="DepositPayment"
        component={DepositPaymentScreen}
        options={{
          headerShown: true,
          title: '보증금 결제',
        }}
      />
      <Stack.Screen
        name="PointHistory"
        component={PointHistoryScreen}
        options={{
          headerShown: true,
          title: '포인트 내역',
        }}
      />
      <Stack.Screen
        name="PointWithdraw"
        component={PointWithdrawScreen}
        options={{
          headerShown: true,
          title: '포인트 출금',
        }}
      />
      <Stack.Screen
        name="Rating"
        component={RatingScreen as any}
        options={{
          headerShown: true,
          title: '평가',
        }}
      />
      <Stack.Screen
        name="GillerPickupFromLocker"
        component={GillerPickupFromLockerScreen}
        options={{
          headerShown: true,
          title: '사물함 수령',
        }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen as any}
        options={{
          headerShown: true,
          title: '채팅',
        }}
      />
      <Stack.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{
          headerShown: true,
          title: '채팅 목록',
        }}
      />
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{
          headerShown: true,
          title: '알림 설정',
        }}
      />
      <Stack.Screen
        name="Earnings"
        component={EarningsScreen}
        options={{
          headerShown: true,
          title: '수익 관리',
        }}
      />
      <Stack.Screen
        name="MyRating"
        component={MyRatingScreen}
        options={{
          headerShown: true,
          title: '내 평가',
        }}
      />
      <Stack.Screen
        name="GillerLevelUpgrade"
        component={GillerLevelUpgradeScreen}
        options={{
          headerShown: true,
          title: '길러 승급',
        }}
      />
      <Stack.Screen
        name="CustomerService"
        component={CustomerServiceScreen}
        options={{
          headerShown: true,
          title: '고객센터',
        }}
      />
      <Stack.Screen
        name="Terms"
        component={TermsScreen}
        options={{
          headerShown: true,
          title: '약관 및 정책',
        }}
      />
    </Stack.Navigator>
  );
}
