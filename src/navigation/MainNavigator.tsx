/**
 * Main Navigator
 * Tab navigator for authenticated screens with stack for modals
 * Role-based tab configuration
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text, Platform, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { MainTabParamList } from '../types/navigation';
import { useUser } from '../contexts/UserContext';
import { Colors } from '../components';

// Web platform support
import { Link } from '@react-navigation/web';

// Screens
import HomeScreen from '../screens/main/HomeScreen';
import AddRouteScreen from '../screens/main/AddRouteScreen';
import EditRouteScreen from '../screens/main/EditRouteScreen';
import RequestsScreen from '../screens/main/RequestsScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import CreateRequestScreen from '../screens/main/CreateRequestScreen';
import RequestConfirmationScreen from '../screens/main/RequestConfirmationScreen';
import RequestDetailScreen from '../screens/main/RequestDetailScreen';
import GillerRequestsScreen from '../screens/main/GillerRequestsScreen';
import DeliveryTrackingScreen from '../screens/main/DeliveryTrackingScreen';
import RouteManagementScreen from '../screens/main/RouteManagementScreen';
import { MatchingResultScreen } from '../screens/main/MatchingResultScreen';
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
import GillerDropoffAtLockerScreen from '../screens/giller/GillerDropoffAtLockerScreen';
import GillerPickupAtLockerScreen from '../screens/giller/GillerPickupAtLockerScreen';
import LockerMapScreen from '../screens/main/LockerMapScreen';
import DisputeReportScreen from '../screens/main/DisputeReportScreen';
import GillerLevelUpgradeScreen from '../screens/main/GillerLevelUpgradeScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createStackNavigator();

function TabBarIcon({ name, focused }: { name: string; focused: boolean }) {
  const iconConfig: { [key: string]: { emoji: string; label: string } } = {
    Home: { emoji: '🏠', label: '홈' },
    RouteManagement: { emoji: '🛤️', label: '동선' },
    Requests: { emoji: '📦', label: '요청' },
    GillerRequests: { emoji: '🚴', label: '매칭' },
    ChatList: { emoji: '💬', label: '채팅' },
    Profile: { emoji: '👤', label: '프로필' },
  };

  const config = iconConfig[name] || { emoji: '•', label: name };

  // 웹에서는 이모지만 사용 (동그라미 제거)
  if (Platform.OS === 'web') {
    return (
      <Text style={[
        styles.webIconEmoji,
        focused && styles.webIconFocused
      ]}>
        {config.emoji}
      </Text>
    );
  }

  // 네이티브에서는 Ionicons 사용
  const icons: { [key: string]: { name: keyof typeof Ionicons.glyphMap } } = {
    Home: { name: 'home' },
    RouteManagement: { name: 'map' },
    Requests: { name: 'cube' },
    GillerRequests: { name: 'bicycle' },
    ChatList: { name: 'chatbubbles' },
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
      {/* Common tab: Home */}
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: '홈' }}
      />

      {/* Gller-specific tab: Requests */}
      {(currentRole === 'gller' || currentRole === 'both') && (
        <Tab.Screen
          name="Requests"
          component={RequestsScreen}
          options={{ tabBarLabel: '요청 목록' }}
        />
      )}

      {/* Giller-specific tab: GillerRequests (배송 매칭) */}
      {(currentRole === 'giller' || currentRole === 'both') && (
        <Tab.Screen
          name="GillerRequests"
          component={GillerRequestsScreen}
          options={{ tabBarLabel: '배송 매칭' }}
        />
      )}

      <Tab.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{ tabBarLabel: '채팅' }}
      />

      {/* Route Management: ONLY for Giller (not Gller) */}
      {currentRole === 'giller' && (
        <Tab.Screen
          name="RouteManagement"
          component={RouteManagementScreen}
          options={{
            tabBarLabel: '동선 관리',
            tabBarAccessibilityLabel: '동선 등록',
          }}
        />
      )}

      {/* Common tab: Profile */}
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
        cardStyle: { flex: 1 },
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
        name="RequestConfirmation"
        component={RequestConfirmationScreen}
        options={{
          headerShown: true,
          title: '요청 완료',
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
      <Stack.Screen
        name="GillerDropoffAtLocker"
        component={GillerDropoffAtLockerScreen as any}
        options={{
          headerShown: true,
          title: '사물함 보관',
        }}
      />
      <Stack.Screen
        name="GillerPickupAtLocker"
        component={GillerPickupAtLockerScreen as any}
        options={{
          headerShown: true,
          title: '사물함 수거',
        }}
      />
      <Stack.Screen
        name="LockerMap"
        component={LockerMapScreen as any}
        options={{
          headerShown: true,
          title: '사물함 지도',
        }}
      />
      <Stack.Screen
        name="DisputeReport"
        component={DisputeReportScreen as any}
        options={{
          headerShown: true,
          title: '분쟁 신고',
        }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  webIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  webIconEmoji: {
    fontSize: 24,
    opacity: 0.6,
  },
  webIconFocused: {
    opacity: 1,
    transform: [{ scale: 1.1 }],
  },
});
