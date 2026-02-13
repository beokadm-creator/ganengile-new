/**
 * Offline Indicator Component
 * 네트워크 연결이 끊겼을 때 상단에 표시
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';

interface OfflineIndicatorProps {
  height?: number;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ height = 40 }) => {
  const [isOffline, setIsOffline] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  const netInfo = useNetInfo();

  useEffect(() => {
    const offline = !netInfo.isConnected;

    if (offline && !isOffline) {
      // 오프라인 상태가 되면 fade-in
      setIsOffline(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true
      }).start();
    } else if (!offline && isOffline) {
      // 온라인 상태가 되면 fade-out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true
      }).start(() => {
        setIsOffline(false);
      });
    }
  }, [netInfo.isConnected]);

  if (!isOffline) return null;

  return (
    <Animated.View style={[styles.container, { height, opacity: fadeAnim }]}>
      <View style={styles.content}>
        <Text style={styles.icon}>⚠️</Text>
        <Text style={styles.text}>인터넷 연결이 없습니다</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#f44336',
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16
  },
  icon: {
    fontSize: 18,
    marginRight: 8
  },
  text: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center'
  }
});
