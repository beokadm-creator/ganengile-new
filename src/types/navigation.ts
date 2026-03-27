/**
 * Navigation Types
 * Type definitions for all navigation params and screens
 */

import type { NavigatorScreenParams } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { UserRole } from './user';

// ==================== Auth Navigator ====================

export type AuthStackParamList = {
  Landing: undefined;
  NewSignUp: undefined;
  Login: undefined;
};

export type AuthNavigationProp = StackNavigationProp<AuthStackParamList>;

// ==================== Onboarding Navigator ====================

// Profile data type passed between onboarding screens
export interface GllerProfileData {
  name: string;
  phoneNumber: string;
  nickname: string;
  profileImage: string | null;
}

// Giller data type
export interface GillerRouteData {
  routes: Array<{
    departureStationId: string;
    arrivalStationId: string;
    daysOfWeek: number[];
    departureTime: string;
  }>;
}

export type OnboardingStackParamList = {
  BasicInfoOnboarding: undefined;
  GllerOnboarding: undefined;
};

export type OnboardingNavigationProp = StackNavigationProp<OnboardingStackParamList>;

// ==================== Main Navigator (Stack + Tab) ====================

export type MainTabParamList = {
  Home: undefined;
  Requests: undefined;
  GillerRequests: undefined;
  RouteManagement: undefined;
  ChatList: undefined;
  Profile: undefined;
};

export type MainStackParamList = {
  Tabs: NavigatorScreenParams<MainTabParamList>;
  CreateRequest: undefined;
  AddRoute: { selectedStation?: import('../types/config').Station };
  EditRoute: { routeId: string };
  RequestDetail: { requestId: string; gillerId?: string };
  DeliveryTracking: { requestId?: string; matchId?: string };
  MatchingResult: {
    requestId: string;
    success: boolean;
    gillerId?: string;
  };
  PickupVerification: {
    deliveryId: string;
    requestId: string;
  };
  DeliveryCompletion: {
    deliveryId: string;
  };
  Rating: {
    deliveryId: string;
    gillerId: string;
    gllerId: string;
  };
  ChatList: undefined;
  Chat: {
    chatRoomId: string;
    otherUserId: string;
    otherUserName: string;
    requestInfo?: { from: string; to: string; urgency: string };
  };
  NotificationSettings: undefined;
  GillerPickupFromLocker: {
    requestId: string;
  };
  GillerDropoffAtLocker: {
    deliveryId: string;
  };
  GillerPickupAtLocker: {
    deliveryId: string;
  };
  LockerMap: undefined;
  DisputeReport: {
    deliveryId?: string;
    matchId?: string;
  };
  Earnings: undefined;
  MyRating: undefined;
  GillerLevelUpgrade: undefined;
  CustomerService: undefined;
  Terms: undefined;
  RequestConfirmation: { requestId: string };
  DepositPayment: undefined;
  PointHistory: undefined;
  PointWithdraw: undefined;
  GillerApply: undefined;
  IdentityVerification: undefined;
  LockerSelection: {
    stationId?: string;
    stationName?: string;
  };
  BadgeCollection: undefined;
  DisputeResolution: {
    disputeId: string;
  };
  LevelBenefits: undefined;
  UnlockLocker: {
    deliveryId: string;
  };
  QRCodeScanner: undefined;
  RealtimeTracking: {
    deliveryId: string;
    requesterId: string;
    gillerId: string;
    pickupStation: { name: string; latitude: number; longitude: number };
    dropoffStation: { name: string; latitude: number; longitude: number };
  };
  OnetimeMode: undefined;
  CreateAuction: undefined;
  AuctionList: undefined;
};

export type MainTabNavigationProp = BottomTabNavigationProp<MainTabParamList>;
export type MainStackNavigationProp = StackNavigationProp<MainStackParamList>;

// Composite navigation for screens in Stack that need to navigate within Tabs
// Extends MainStackNavigationProp to support Tab navigation
export type MainStackWithTabNavigationProp = MainStackNavigationProp & {
  navigate(
    route: 'Tabs',
    params: { screen: keyof MainTabParamList }
  ): void;
};

// ==================== B2B Navigator ====================

export type B2BStackParamList = {
  B2BDashboard: undefined;
  B2BRequest: undefined;
  B2BGiller: undefined;
  B2BMatchingResult: {
    requestId: string;
  };
  B2BOnboarding: undefined;
  BusinessProfile: undefined;
  MonthlySettlement: undefined;
  SubscriptionTierSelection: undefined;
  TaxInvoiceRequest: undefined;
};

export type B2BStackNavigationProp = StackNavigationProp<B2BStackParamList>;

// ==================== Root Navigator ====================

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Onboarding: NavigatorScreenParams<OnboardingStackParamList> & { role: UserRole };
  Main: NavigatorScreenParams<MainStackParamList>;
  B2B: NavigatorScreenParams<B2BStackParamList>;
};

export type RootNavigationProp = StackNavigationProp<RootStackParamList>;

// ==================== Screen Props Types ====================

export type LandingScreenProps = {
  navigation: AuthNavigationProp;
};

export type SignUpScreenProps = {
  navigation: AuthNavigationProp;
};

export type LoginScreenProps = {
  navigation: AuthNavigationProp;
};

export type GllerOnboardingProps = {
  navigation: OnboardingNavigationProp;
};

export type HomeScreenProps = {
  navigation: MainStackNavigationProp;
};

export type AddRouteScreenProps = {
  navigation: MainStackNavigationProp;
};

export type EditRouteScreenProps = {
  navigation: MainStackNavigationProp;
  route: {
    params: {
      routeId: string;
    };
  };
};

export type RequestsScreenProps = {
  navigation: MainStackNavigationProp;
};

export type ProfileScreenProps = {
  navigation: MainStackNavigationProp;
};

export type MatchingResultScreenProps = {
  navigation: MainStackNavigationProp;
  route: {
    params: {
      requestId: string;
      success: boolean;
      gillerId?: string;
    };
  };
};
