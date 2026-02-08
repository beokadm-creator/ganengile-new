/**
 * Main Navigator
 * Tab navigator for authenticated screens with stack for modals
 * Role-based tab configuration
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { MainTabParamList } from '../types/navigation';
import { useUser } from '../contexts/UserContext';
import { Colors } from '../components';

// Screens
import HomeScreen from '../screens/main/HomeScreen';
import AddRouteScreen from '../screens/main/AddRouteScreen';
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

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createStackNavigator();

function TabBarIcon({ name, focused }: { name: string; focused: boolean }) {
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
      }}
    >
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen
        name="CreateRequest"
        component={CreateRequestScreen}
        options={{
          headerShown: true,
          title: '배송 요청하기',
          headerStyle: { backgroundColor: '#FF9800' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
      <Stack.Screen
        name="AddRoute"
        component={AddRouteScreen}
        options={{
          headerShown: true,
          title: '동선 등록',
          headerStyle: { backgroundColor: '#4CAF50' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
      <Stack.Screen
        name="RequestDetail"
        component={RequestDetailScreen as any}
        options={{
          headerShown: true,
          title: '요청 상세',
          headerStyle: { backgroundColor: '#00BCD4' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
      <Stack.Screen
        name="DeliveryTracking"
        component={DeliveryTrackingScreen as any}
        options={{
          headerShown: true,
          title: '배송 추적',
          headerStyle: { backgroundColor: '#4CAF50' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
      <Stack.Screen
        name="MatchingResult"
        component={MatchingResultScreen as any}
        options={{
          headerShown: true,
          title: '매칭 결과',
          headerStyle: { backgroundColor: '#FF9800' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
      <Stack.Screen
        name="PickupVerification"
        component={PickupVerificationScreen as any}
        options={{
          headerShown: true,
          title: '픽업 인증',
          headerStyle: { backgroundColor: '#4CAF50' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
      <Stack.Screen
        name="DeliveryCompletion"
        component={DeliveryCompletionScreen as any}
        options={{
          headerShown: true,
          title: '배송 완료',
          headerStyle: { backgroundColor: '#4CAF50' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
      <Stack.Screen
        name="Rating"
        component={RatingScreen as any}
        options={{
          headerShown: true,
          title: '평가',
          headerStyle: { backgroundColor: '#FF9800' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen as any}
        options={{
          headerShown: true,
          title: '채팅',
          headerStyle: { backgroundColor: '#2196F3' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
      <Stack.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{
          headerShown: true,
          title: '채팅',
          headerStyle: { backgroundColor: '#2196F3' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{
          headerShown: true,
          title: '알림 설정',
          headerStyle: { backgroundColor: '#FF9800' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
    </Stack.Navigator>
  );
}
