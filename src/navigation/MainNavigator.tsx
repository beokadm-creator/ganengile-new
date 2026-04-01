/**
 * Main Navigator
 * beta1 기준 메인 탭과 스택 구성
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MainStackParamList, MainTabParamList } from '../types/navigation';
import { useUser } from '../contexts/UserContext';
import { useGillerAccess } from '../hooks/useGillerAccess';
import { UserRole } from '../types/user';

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
import AddressBookScreen from '../screens/main/AddressBookScreen';
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
const Stack = createStackNavigator<MainStackParamList>();

const TAB_LABELS: Record<keyof MainTabParamList, string> = {
  Home: '홈',
  Requests: '요청',
  GillerRequests: '미션 보드',
  RouteManagement: '경로',
  ChatList: '채팅',
  Profile: '프로필',
};

const SCREEN_TITLES: Record<string, string> = {
  RequestConfirmation: '요청 확인',
  AddRoute: '경로 등록',
  MatchingResult: '매칭 진행',
  PickupVerification: '픽업 확인',
  DeliveryCompletion: '배송 완료',
  DepositPayment: '보증금 결제',
  PointHistory: '지갑 내역',
  PointWithdraw: '출금 요청',
  Rating: '평가 남기기',
  Chat: '미션 채팅',
  ChatList: '채팅 목록',
  NotificationSettings: '알림 설정',
  Earnings: '정산 관리',
  MyRating: '내 평점',
  BadgeCollection: '배지 컬렉션',
  GillerLevelUpgrade: '길러 승급',
  CustomerService: '고객센터',
  Terms: '약관 및 정책',
  AddressBook: '주소록 관리',
  GillerPickupFromLocker: '사물함 픽업',
  GillerDropoffAtLocker: '사물함 보관',
  GillerPickupAtLocker: '사물함 회수',
  LockerMap: '사물함 지도',
  DisputeReport: '분쟁 신고',
  IdentityVerification: '본인 확인',
  LockerSelection: '사물함 선택',
  DisputeResolution: '분쟁 처리',
  LevelBenefits: '레벨 혜택',
  UnlockLocker: '사물함 열기',
  OnetimeMode: '일회성 매칭',
  CreateAuction: '경매 생성',
  AuctionList: '경매 목록',
};

function TabBarIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<
    string,
    { active: keyof typeof MaterialIcons.glyphMap; inactive: keyof typeof MaterialIcons.glyphMap }
  > = {
    Home: { active: 'home', inactive: 'home' },
    RouteManagement: { active: 'alt-route', inactive: 'alt-route' },
    Requests: { active: 'inventory-2', inactive: 'inventory-2' },
    GillerRequests: { active: 'pedal-bike', inactive: 'pedal-bike' },
    ChatList: { active: 'chat', inactive: 'chat-bubble-outline' },
    Profile: { active: 'person', inactive: 'person-outline' },
  };

  const icon = icons[name] ?? { active: 'help-outline', inactive: 'help-outline' };

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

  const showRequesterTab = currentRole === UserRole.GLER || currentRole === UserRole.BOTH;
  const showGillerTabs =
    (currentRole === UserRole.GILLER || currentRole === UserRole.BOTH) && canAccessGiller;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabBarIcon name={route.name} focused={focused} />,
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
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: TAB_LABELS.Home }} />

      {showRequesterTab ? (
        <Tab.Screen
          name="Requests"
          component={RequestsScreen}
          options={{ tabBarLabel: TAB_LABELS.Requests }}
        />
      ) : null}

      {showGillerTabs ? (
        <Tab.Screen
          name="GillerRequests"
          component={GillerRequestsScreen}
          options={{ tabBarLabel: TAB_LABELS.GillerRequests }}
        />
      ) : null}

      <Tab.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{ tabBarLabel: TAB_LABELS.ChatList }}
      />

      {showGillerTabs ? (
        <Tab.Screen
          name="RouteManagement"
          component={RouteManagementScreen}
          options={{
            tabBarLabel: TAB_LABELS.RouteManagement,
            tabBarAccessibilityLabel: '경로 관리',
          }}
        />
      ) : null}

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: TAB_LABELS.Profile }}
      />
    </Tab.Navigator>
  );
}

function stackTitle(name: string): string | undefined {
  return SCREEN_TITLES[name];
}

export default function MainNavigator() {
  return (
    <Stack.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        headerBackTitle: '뒤로',
        headerBackTitleVisible: false,
        headerTitleAlign: 'center',
        headerTitleStyle: { fontWeight: '800', fontSize: 18 },
        headerStyle: {
          backgroundColor: '#FFFFFF',
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
        title: stackTitle(route.name),
      })}
    >
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen
        name="CreateRequest"
        component={CreateRequestScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="RequestConfirmation"
        component={RequestConfirmationScreen}
        options={{ headerShown: true }}
      />
      <Stack.Screen name="AddRoute" component={AddRouteScreen} options={{ headerShown: true }} />
      <Stack.Screen name="EditRoute" component={EditRouteScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="RequestDetail"
        component={RequestDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DeliveryTracking"
        component={DeliveryTrackingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MatchingResult"
        component={MatchingResultScreen}
        options={{ headerShown: true }}
      />
      <Stack.Screen
        name="PickupVerification"
        component={PickupVerificationScreen}
        options={{ headerShown: true }}
      />
      <Stack.Screen
        name="DeliveryCompletion"
        component={DeliveryCompletionScreen}
        options={{ headerShown: true }}
      />
      <Stack.Screen
        name="DepositPayment"
        component={DepositPaymentScreen}
        options={{ headerShown: true }}
      />
      <Stack.Screen
        name="PointHistory"
        component={PointHistoryScreen}
        options={{ headerShown: true }}
      />
      <Stack.Screen
        name="PointWithdraw"
        component={PointWithdrawScreen}
        options={{ headerShown: true }}
      />
      <Stack.Screen name="Rating" component={RatingScreen} options={{ headerShown: true }} />
      <Stack.Screen
        name="GillerPickupFromLocker"
        component={GillerPickupFromLockerScreen}
        options={{ headerShown: true }}
      />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ headerShown: true }} />
      <Stack.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{ headerShown: true }}
      />
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{ headerShown: true }}
      />
      <Stack.Screen
        name="Earnings"
        component={EarningsScreen}
        options={{ headerShown: true }}
      />
      <Stack.Screen
        name="MyRating"
        component={MyRatingScreen}
        options={{ headerShown: true }}
      />
      <Stack.Screen
        name="BadgeCollection"
        component={BadgeCollectionScreen}
        options={{ headerShown: true }}
      />
      <Stack.Screen
        name="GillerLevelUpgrade"
        component={GillerLevelUpgradeScreen}
        options={{ headerShown: true }}
      />
      <Stack.Screen
        name="CustomerService"
        component={CustomerServiceScreen}
        options={{ headerShown: true }}
      />
      <Stack.Screen name="Terms" component={TermsScreen} options={{ headerShown: true }} />
      <Stack.Screen
        name="AddressBook"
        component={AddressBookScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="GillerDropoffAtLocker"
        component={GillerDropoffAtLockerScreen}
        options={{ headerShown: true }}
      />
      <Stack.Screen
        name="GillerPickupAtLocker"
        component={GillerPickupAtLockerScreen}
        options={{ headerShown: true }}
      />
      <Stack.Screen
        name="LockerMap"
        component={LockerMapScreen}
        options={{ headerShown: true }}
      />
      <Stack.Screen
        name="DisputeReport"
        component={DisputeReportScreen}
        options={{ headerShown: true }}
      />
      <Stack.Screen
        name="GillerApply"
        component={GillerApplyScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="IdentityVerification"
        component={IdentityVerificationScreen}
        options={{ headerShown: true }}
      />
      <Stack.Screen
        name="LockerSelection"
        component={LockerSelectionScreen}
        options={{ headerShown: true }}
      />
      <Stack.Screen
        name="DisputeResolution"
        component={DisputeResolutionScreen}
        options={{ headerShown: true }}
      />
      <Stack.Screen
        name="LevelBenefits"
        component={LevelBenefitsScreen}
        options={{ headerShown: true }}
      />
      <Stack.Screen
        name="UnlockLocker"
        component={UnlockLockerScreen}
        options={{ headerShown: true }}
      />
      <Stack.Screen
        name="QRCodeScanner"
        component={QRCodeScannerScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="RealtimeTracking"
        component={RealtimeTrackingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="OnetimeMode"
        component={OnetimeModeScreen}
        options={{ headerShown: true }}
      />
      <Stack.Screen
        name="CreateAuction"
        component={CreateAuctionScreen}
        options={{ headerShown: true }}
      />
      <Stack.Screen
        name="AuctionList"
        component={AuctionListScreen}
        options={{ headerShown: true }}
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
