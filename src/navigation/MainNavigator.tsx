/**
 * Main Navigator
 * Tab navigator for authenticated screens with stack for modals
 * Role-based tab configuration
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import type { MainTabParamList } from '../types/navigation';
import { useUser } from '../contexts/UserContext';
import { useGillerAccess } from '../hooks/useGillerAccess';

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
import BadgeCollectionScreen from '../screens/main/BadgeCollectionScreen';
import CustomerServiceScreen from '../screens/main/CustomerServiceScreen';
import TermsScreen from '../screens/main/TermsScreen';
import DepositPaymentScreen from '../screens/main/DepositPaymentScreen';
import PointHistoryScreen from '../screens/main/PointHistoryScreen';
import PointWithdrawScreen from '../screens/main/PointWithdrawScreen';
import LockerSelectionScreen from '../screens/main/LockerSelectionScreen';
import GillerPickupFromLockerScreen from '../screens/requester/GillerPickupFromLockerScreen';
import GillerDropoffAtLockerScreen from '../screens/giller/GillerDropoffAtLockerScreen';
import GillerPickupAtLockerScreen from '../screens/giller/GillerPickupAtLockerScreen';
import LockerMapScreen from '../screens/main/LockerMapScreen';
import DisputeReportScreen from '../screens/main/DisputeReportScreen';
import GillerLevelUpgradeScreen from '../screens/main/GillerLevelUpgradeScreen';
import GillerApplyScreen from '../screens/main/GillerApplyScreen';
import IdentityVerificationScreen from '../screens/main/IdentityVerificationScreen';
import DisputeResolutionScreen from '../screens/main/DisputeResolutionScreen';
import LevelBenefitsScreen from '../screens/main/LevelBenefitsScreen';
import UnlockLockerScreen from '../screens/main/UnlockLockerScreen';
import QRCodeScannerScreen from '../screens/main/QRCodeScannerScreen';
import RealtimeTrackingScreen from '../screens/main/RealtimeTrackingScreen';
import OnetimeModeScreen from '../screens/main/OnetimeModeScreen';
import CreateAuctionScreen from '../screens/main/CreateAuctionScreen';
import AuctionListScreen from '../screens/main/AuctionListScreen';
const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createStackNavigator();

function TabBarIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: { [key: string]: { active: keyof typeof MaterialIcons.glyphMap; inactive: keyof typeof MaterialIcons.glyphMap } } = {
    Home: { active: 'home', inactive: 'home' },
    RouteManagement: { active: 'alt-route', inactive: 'alt-route' },
    Requests: { active: 'inventory-2', inactive: 'inventory-2' },
    GillerRequests: { active: 'pedal-bike', inactive: 'pedal-bike' },
    ChatList: { active: 'chat', inactive: 'chat-bubble-outline' },
    Profile: { active: 'person', inactive: 'person-outline' },
  };

  const icon = icons[name as keyof typeof icons] || { active: 'help-outline', inactive: 'help-outline' };

  return (
    <MaterialIcons
      name={focused ? icon.active : icon.inactive}
      size={24}
      color={focused ? '#0F766E' : '#6B7280'}
    />
  );
}

function TabNavigator() {
  const { currentRole } = useUser();
  const { canAccessGiller } = useGillerAccess();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => (
          <TabBarIcon name={route.name} focused={focused} />
        ),
        tabBarActiveTintColor: '#0F766E',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          height: 88 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 16),
          paddingTop: 8,
          paddingHorizontal: 8,
          shadowColor: '#0F172A',
          shadowOpacity: 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: -2 },
          elevation: 8,
          overflow: 'visible',
        },
        tabBarHideOnKeyboard: true,
        tabBarLabelPosition: 'below-icon',
        tabBarItemStyle: {
          minHeight: 58,
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.1,
          lineHeight: 16,
          marginTop: 2,
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
      {(currentRole === 'giller' || currentRole === 'both') && canAccessGiller && (
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

      {/* Route Management: for giller and both */}
      {(currentRole === 'giller' || currentRole === 'both') && canAccessGiller && (
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
        headerBackTitleVisible: false,
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
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen
        name="CreateRequest"
        component={CreateRequestScreen}
        options={{
          headerShown: false,
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
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="DeliveryTracking"
        component={DeliveryTrackingScreen as any}
        options={{
          headerShown: false,
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
        name="BadgeCollection"
        component={BadgeCollectionScreen}
        options={{
          headerShown: true,
          title: '내 배지',
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
      <Stack.Screen
        name="GillerApply"
        component={GillerApplyScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="IdentityVerification"
        component={IdentityVerificationScreen}
        options={{
          headerShown: true,
          title: '신원 인증',
        }}
      />
      <Stack.Screen
        name="LockerSelection"
        component={LockerSelectionScreen as any}
        options={{
          headerShown: true,
          title: '사물함 선택',
        }}
      />
      <Stack.Screen
        name="DisputeResolution"
        component={DisputeResolutionScreen as any}
        options={{
          headerShown: true,
          title: '분쟁 해결',
        }}
      />
      <Stack.Screen
        name="LevelBenefits"
        component={LevelBenefitsScreen as any}
        options={{
          headerShown: true,
          title: '등급 혜택',
        }}
      />
      <Stack.Screen
        name="UnlockLocker"
        component={UnlockLockerScreen as any}
        options={{
          headerShown: true,
          title: '사물함 수령',
        }}
      />
      <Stack.Screen
        name="QRCodeScanner"
        component={QRCodeScannerScreen as any}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="RealtimeTracking"
        component={RealtimeTrackingScreen as any}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="OnetimeMode"
        component={OnetimeModeScreen as any}
        options={{
          headerShown: true,
          title: '원타임 매칭',
        }}
      />
      <Stack.Screen
        name="CreateAuction"
        component={CreateAuctionScreen as any}
        options={{
          headerShown: true,
          title: '경매 생성',
        }}
      />
      <Stack.Screen
        name="AuctionList"
        component={AuctionListScreen as any}
        options={{
          headerShown: true,
          title: '경매 목록',
        }}
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
