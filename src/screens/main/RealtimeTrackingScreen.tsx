/**
 * Realtime Tracking Screen
 * 지도 기반 실시간 배송 추적 화면
 */

import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { requireUserId } from '../../services/firebase';
import { UserContext } from '../../contexts/UserContext';
import type { UserContextType } from '../../contexts/UserContext';
import { startDeliveryTracking, stopDeliveryTracking } from '../../services/location-tracking-service';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

const { width, height } = Dimensions.get('window');

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
  route: {
    params: {
      deliveryId: string;
      requesterId: string;
      gillerId: string;
      pickupStation: { name: string; latitude: number; longitude: number };
      dropoffStation: { name: string; latitude: number; longitude: number };
    };
  };
}

interface TrackingData {
  currentLocation: { latitude: number; longitude: number } | null;
  lastLocationUpdate: any;
  status: string;
  gillerLocation?: { latitude: number; longitude: number };
  pathHistory?: { latitude: number; longitude: number }[];
}

export default function RealtimeTrackingScreen({ navigation, route }: Props) {
  const { deliveryId, requesterId, gillerId, pickupStation, dropoffStation } = route.params;
  const { user, currentRole } = useContext(UserContext) as UserContextType;

  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [currentRegion, setCurrentRegion] = useState({
    latitude: pickupStation.latitude,
    longitude: pickupStation.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });
  const [isTracking, setIsTracking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // 현재 사용자의 위치 가져오기
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('권한 필요', '위치 권한이 필요합니다.');
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const currentLoc = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        setUserLocation(currentLoc);

        // 지도 중심을 현재 위치로 설정
        setCurrentRegion({
          latitude: currentLoc.latitude,
          longitude: currentLoc.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      } catch (error) {
        console.error('Get location error:', error);
      }
    })();
  }, []);

  // 실시간 배송 추적 데이터 수신
  useEffect(() => {
    const deliveryRef = doc(db, 'deliveries', deliveryId);

    const unsubscribe = onSnapshot(deliveryRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data() as TrackingData;
        setTrackingData(data);
        setLoading(false);

        // 기러기 위치가 있으면 지도 중심 이동
        if (data.gillerLocation) {
          setCurrentRegion({
            latitude: data.gillerLocation.latitude,
            longitude: data.gillerLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
        }
      }
    }, (error) => {
      console.error('Tracking error:', error);
      setLoading(false);
      Alert.alert('오류', '실시간 추적 데이터를 가져오지 못했습니다.');
    });

    return () => unsubscribe();
  }, [deliveryId]);

  // 기러기인 경우 위치 추적 시작
  useEffect(() => {
    if (currentRole === 'giller' && !isTracking) {
      startTracking();
    }

    return () => {
      if (isTracking) {
        stopDeliveryTracking();
      }
    };
  }, [currentRole]);

  const startTracking = async () => {
    try {
      await startDeliveryTracking(deliveryId, 10000); // 10초마다 업데이트
      setIsTracking(true);
    } catch (error) {
      console.error('Start tracking error:', error);
      Alert.alert('오류', '위치 추적을 시작하지 못했습니다.');
    }
  };

  const handleStopTracking = async () => {
    try {
      stopDeliveryTracking();
      setIsTracking(false);
      Alert.alert('알림', '위치 추적이 중지되었습니다.');
    } catch (error) {
      console.error('Stop tracking error:', error);
    }
  };

  const handleRefreshLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const currentLoc = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setUserLocation(currentLoc);

      // 지도 중심 이동
      setCurrentRegion({
        latitude: currentLoc.latitude,
        longitude: currentLoc.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    } catch (error) {
      console.error('Refresh location error:', error);
    }
  };

  const handleFitToCoordinates = () => {
    const coordinates = [
      pickupStation,
      dropoffStation,
      ...(trackingData?.gillerLocation ? [trackingData.gillerLocation] : []),
      ...(userLocation ? [userLocation] : []),
    ];

    if (coordinates.length === 0) return;

    // 모든 좌표를 포함하는 영역 계산
    const latitudes = coordinates.map(c => c.latitude);
    const longitudes = coordinates.map(c => c.longitude);

    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLon = Math.min(...longitudes);
    const maxLon = Math.max(...longitudes);

    const midLat = (minLat + maxLat) / 2;
    const midLon = (minLon + maxLon) / 2;
    const latDelta = (maxLat - minLat) * 1.5; // 1.5배 패딩
    const lonDelta = (maxLon - minLon) * 1.5;

    setCurrentRegion({
      latitude: midLat,
      longitude: midLon,
      latitudeDelta: Math.max(latDelta, 0.01),
      longitudeDelta: Math.max(lonDelta, 0.01),
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>로딩 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 지도 */}
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        region={currentRegion}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={true}
        followsUserLocation={currentRole === 'giller'}
      >
        {/* 픽업 장소 마커 */}
        <Marker
          coordinate={{
            latitude: pickupStation.latitude,
            longitude: pickupStation.longitude,
          }}
          title="픽업 장소"
          description={pickupStation.name}
          pinColor="#4CAF50"
        />

        {/* 배송 장소 마커 */}
        <Marker
          coordinate={{
            latitude: dropoffStation.latitude,
            longitude: dropoffStation.longitude,
          }}
          title="배송 장소"
          description={dropoffStation.name}
          pinColor="#FF9800"
        />

        {/* 기러기 위치 마커 */}
        {trackingData?.gillerLocation && (
          <Marker
            coordinate={{
              latitude: trackingData.gillerLocation.latitude,
              longitude: trackingData.gillerLocation.longitude,
            }}
            title="기러기 위치"
            description="현재 위치"
            pinColor="#00BCD4"
          />
        )}

        {/* 경로 선 (픽업 → 배송) */}
        {trackingData?.pathHistory && trackingData.pathHistory.length > 1 && (
          <Polyline
            coordinates={trackingData.pathHistory}
            strokeColor="#00BCD4"
            strokeWidth={3}
          />
        )}
      </MapView>

      {/* 상단 정보 패널 */}
      <View style={styles.topPanel}>
        <View style={styles.statusContainer}>
          <Text style={styles.statusTitle}>배송 상태</Text>
          <Text style={styles.statusText}>
            {trackingData?.status === 'in_transit' ? '배송 중' :
             trackingData?.status === 'arrived' ? '도착 완료' :
             trackingData?.status === 'completed' ? '배송 완료' :
             '준비 중'}
          </Text>
        </View>

        {trackingData?.gillerLocation && (
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              기러기 위치: {trackingData.gillerLocation.latitude.toFixed(4)}, {trackingData.gillerLocation.longitude.toFixed(4)}
            </Text>
          </View>
        )}
      </View>

      {/* 하단 컨트롤 패널 */}
      <View style={styles.bottomPanel}>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.button}
            onPress={handleFitToCoordinates}
          >
            <Text style={styles.buttonText}>전체 보기</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={handleRefreshLocation}
          >
            <Text style={styles.buttonText}>위치 새로고침</Text>
          </TouchableOpacity>

          {currentRole === 'giller' && (
            <>
              <TouchableOpacity
                style={[styles.button, isTracking ? styles.buttonDanger : styles.buttonSuccess]}
                onPress={isTracking ? handleStopTracking : startTracking}
              >
                <Text style={styles.buttonText}>
                  {isTracking ? '추적 중지' : '추적 시작'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  map: {
    flex: 1,
  },
  topPanel: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 60,
    left: Spacing.md,
    right: Spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statusContainer: {
    marginBottom: Spacing.sm,
  },
  statusTitle: {
    ...Typography.subtitle2,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  statusText: {
    ...Typography.h6,
    color: Colors.text,
    fontWeight: 'bold',
  },
  infoContainer: {
    marginTop: Spacing.sm,
  },
  infoText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  bottomPanel: {
    position: 'absolute',
    bottom: Spacing.lg,
    left: Spacing.md,
    right: Spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  button: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSuccess: {
    backgroundColor: Colors.success,
  },
  buttonDanger: {
    backgroundColor: Colors.error,
  },
  buttonText: {
    ...Typography.button,
    color: '#fff',
    fontSize: 12,
  },
  loadingText: {
    ...Typography.h6,
    color: Colors.text,
    textAlign: 'center',
    marginTop: 100,
  },
});
