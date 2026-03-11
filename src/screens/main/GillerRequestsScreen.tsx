/**
 * Giller Requests Screen
 * 길러(배송 대행자)용 매칭 가능한 요청 목록 화면
 * Tab Navigator 구조로 리팩토링
 */

import React from 'react';
import { View, Text } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import RouteMatchingTab from './tabs/RouteMatchingTab';
import InstantMatchingTab from './tabs/InstantMatchingTab';
import type { RouteProp } from '@react-navigation/native';

type TabParamList = {
  RouteMatching: undefined;
  InstantMatching: undefined;
};

const Tab = createMaterialTopTabNavigator<TabParamList>();

interface Props {
  route: RouteProp<any, any>;
}

export default function GillerRequestsScreen({ route }: Props) {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#00BCD4',
        tabBarInactiveTintColor: '#999',
        tabBarIndicatorStyle: {
          backgroundColor: '#00BCD4',
          height: 3,
        },
        tabBarLabelStyle: {
          fontSize: 14,
          fontWeight: '600',
        },
        tabBarStyle: {
          backgroundColor: '#fff',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: '#E0E0E0',
        },
      }}
    >
      <Tab.Screen
        name="RouteMatching"
        component={RouteMatchingTab}
        options={{
          title: '🔄 동선 매칭',
        }}
      />
      <Tab.Screen
        name="InstantMatching"
        component={InstantMatchingTab}
        options={{
          title: '⚡ 즉시 매칭',
        }}
      />
    </Tab.Navigator>
  );
}
