/**
 * Navigation Types
 * Type definitions for all navigation params and screens
 */

import type { NavigatorScreenParams } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

// ==================== Auth Navigator ====================

export type AuthStackParamList = {
  Landing: undefined;
  NewSignUp: undefined;
  Login: undefined;
};

export type AuthNavigationProp = StackNavigationProp<AuthStackParamList>;

// ==================== Main Navigator (Stack + Tab) ====================

export type MainTabParamList = {
  Home: undefined;
  Requests: undefined;
  GillerRequests: undefined;
  RouteManagement: { justAddedRouteId?: string } | undefined;

  ChatList: undefined;
  Profile: undefined;
};

import type { SharedPackageSize } from '../../shared/pricing-config';

export type MainStackParamList = {
  Tabs: NavigatorScreenParams<MainTabParamList>;
  CreateRequest:
    | {
        mode?: 'new' | 'reservation';
        sourceRequestId?: string;
        prefill?: {
          pickupMode?: 'station' | 'address';
          deliveryMode?: 'station' | 'address';
          pickupStation?: import('./request').StationInfo;
          deliveryStation?: import('./request').StationInfo;
          pickupRoadAddress?: string;
          pickupDetailAddress?: string;
          deliveryRoadAddress?: string;
          deliveryDetailAddress?: string;
          packageDescription?: string;
          packageSize?: SharedPackageSize;
          weightKg?: number;
          itemValue?: number;
          photoRefs?: string[];
          recipientName?: string;
          recipientPhone?: string;
          pickupLocationDetail?: string;
          storageLocation?: string;
          specialInstructions?: string;
          urgency?: 'normal' | 'fast' | 'urgent';
          directParticipationMode?: 'none' | 'requester_to_station' | 'locker_assisted';
          preferredPickupTime?: string;
          preferredArrivalTime?: string;
        };
      }
    | undefined;
  AddRoute: { selectedStation?: import('../types/config').Station };
  EditRoute: { routeId: string };
  RequesterDropoffLocker: { requestId: string };
  RequestDetail: { requestId: string; gillerId?: string };
  DeliveryTracking: { requestId?: string; matchId?: string };
  MatchingResult: {
    requestId: string;
    pickupStationName?: string;
    deliveryStationName?: string;
  };
  PickupVerification: {
    deliveryId: string;
    requestId: string;
  };
  DeliveryCompletion: {
    deliveryId: string;
  };
  ProfessionalMissionBridge: {
    missionTitle: string;
    missionWindow?: string;
    reason?: string;
    requestId?: string;
    deliveryId?: string;
  };
  Rating: {
    deliveryId: string;
    gillerId: string;
    requesterId: string;
    gllerId?: string;
  };
  ChatList: undefined;
  Chat: {
    chatRoomId: string;
    otherUserId: string;
    otherUserName: string;
    requestInfo?: { from: string; to: string; urgency: string };
  };

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


  Terms: undefined;
  AddressBook: undefined;
  ProfileEdit: undefined;
  DepositPayment: {
    gillerId: string;
    requesterId: string;
    gllerId?: string;
    requestId: string;
    itemValue: number;
  };
  PointHistory: undefined;
  PointWithdraw: undefined;
  GillerApply: undefined;
  IdentityVerification: undefined;
  LockerSelection: {
    stationId?: string;
    stationName?: string;
    lockerId?: string;
  };

  DisputeResolution: {
    disputeId: string;
  };
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

// ==================== Root Navigator ====================

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Onboarding: undefined;
  Main: NavigatorScreenParams<MainStackParamList>;
};

export type RootNavigationProp = StackNavigationProp<RootStackParamList>;

// ==================== Screen Props Types ====================

export type LandingScreenProps = {
  navigation: AuthNavigationProp;
};

export type LoginScreenProps = {
  navigation: AuthNavigationProp;
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
      pickupStationName?: string;
      deliveryStationName?: string;
    };
  };
};
