import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Card, ProgressBar } from '../components/common';
import { deliveryTrackingService, DeliveryStatus } from '../services/delivery-tracking-service';

interface DeliveryTrackingScreenProps {
  navigation: any;
  route: any;
}

export const DeliveryTrackingScreen: React.FC<DeliveryTrackingScreenProps> = ({
  navigation,
  route,
}) => {
  const [deliveryStatus, setDeliveryStatus] = useState<string>('pending');
  const [eta, setEta] = useState<string>('--:--');
  const [gillerLocation, setGillerLocation] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [currentStation, setCurrentStation] = useState<string>('');
  const [nextStation, setNextStation] = useState<string>('');

  const deliveryId = route?.params?.deliveryId;

  useEffect(() => {
    if (!deliveryId) {
      setIsLoading(false);
      return;
    }

    // 실시간 배송 추적 시작
    deliveryTrackingService.startTracking(
      deliveryId,
      (status: DeliveryStatus) => {
        setDeliveryStatus(status.status);
        setProgress(status.progress);
        setEta(status.eta || '--:--');
        setCurrentStation(status.currentStation || '');
        setNextStation(status.nextStation || '');
        
        // Giller 위치 정보
        if (status.gillerLocation) {
          setGillerLocation(
            `위도: ${status.gillerLocation.latitude.toFixed(4)}, 경도: ${status.gillerLocation.longitude.toFixed(4)}`
          );
        }

        setIsLoading(false);
      }
    );

    // 컴포넌트 언마운트 시 추적 중지
    return () => {
      deliveryTrackingService.stopTracking();
    };
  }, [deliveryId]);

  const getDeliveryStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return '⏳ 대기 중';
      case 'picked_up':
        return '✅ 픽업 완료';
      case 'in_transit':
        return '🚚 배송 중';
      case 'delivered':
        return '✅ 배송 완료';
      default:
        return '⏳ 대기 중';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#FFC107';
      case 'picked_up':
        return '#4CAF50';
      case 'in_transit':
        return '#2196F3';
      case 'delivered':
        return '#4CAF50';
      default:
        return '#FFC107';
    }
  };

  const handleEmergencyContact = () => {
    Alert.alert(
      '긴급 연락',
      '기러에게 긴급 연락하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        { text: '연락', onPress: () => console.log('긴급 연락') },
      ],
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>배송 추적</Text>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00BCD4" />
          <Text style={styles.loadingText}>배송 정보를 불러오는 중...</Text>
        </View>
      ) : (
        <>
          {/* 배송 상태 단계 표시 */}
          <Card style={styles.card}>
            <Text style={styles.label}>배송 상태</Text>
            <View style={[styles.statusContainer, { backgroundColor: getStatusColor(deliveryStatus) }]}>
              <Text style={styles.statusText}>{getDeliveryStatusText(deliveryStatus)}</Text>
            </View>
          </Card>

      {/* 진행률 표시 */}
      <Card style={styles.card}>
        <Text style={styles.label}>배송 진행률</Text>
        <ProgressBar progress={progress / 100} />
        <Text style={styles.progressText}>{progress}%</Text>
      </Card>

      {/* 예상 도착 시간 (ETA) */}
      <Card style={styles.card}>
        <Text style={styles.label}>예상 도착 시간</Text>
        <Text style={styles.eta}>{eta}</Text>
      </Card>

      {/* 기러 프로필 카드 */}
      <Card style={styles.card}>
        <View style={styles.profileContainer}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>기</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>김기러</Text>
            <Text style={styles.profileRating}>⭐ 4.8</Text>
            <Text style={styles.profileCompleted}>완료 건수: 156</Text>
          </View>
        </View>
      </Card>

      {/* 지도상 배송기러 현위치 (시뮬레이션) */}
      <Card style={styles.card}>
        <Text style={styles.label}>배송 경로</Text>
        {currentStation && (
          <View style={styles.stationInfo}>
            <Text style={styles.stationLabel}>현재 역:</Text>
            <Text style={styles.stationValue}>{currentStation}</Text>
          </View>
        )}
        {nextStation && (
          <View style={styles.stationInfo}>
            <Text style={styles.stationLabel}>다음 역:</Text>
            <Text style={styles.stationValue}>{nextStation}</Text>
          </View>
        )}
        <View style={styles.mapContainer}>
          <Text style={styles.mapPlaceholder}>지도 (시뮬레이션)</Text>
          <Text style={styles.mapSubtext}>
            {gillerLocation || '위치 추적 중...'}
          </Text>
        </View>
      </Card>

      {/* 긴급 연락 버튼 */}
      <TouchableOpacity
        style={styles.emergencyButton}
        onPress={handleEmergencyContact}>
        <Text style={styles.emergencyButtonText}>🚨 긴급 연락</Text>
      </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginVertical: 20,
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  statusContainer: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  progressText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00BCD4',
    textAlign: 'center',
    marginTop: 8,
  },
  eta: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#00BCD4',
    textAlign: 'center',
  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#00BCD4',
    justifyContent: 'center',
    marginRight: 16,
  },
  profileAvatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  profileRating: {
    fontSize: 16,
    color: '#FF9800',
    marginBottom: 4,
  },
  profileCompleted: {
    fontSize: 14,
    color: '#666',
  },
  mapContainer: {
    height: 200,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  stationInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stationLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  stationValue: {
    fontSize: 14,
    color: '#333',
  },
  mapPlaceholder: {
    fontSize: 18,
    color: '#333',
    marginBottom: 8,
  },
  mapSubtext: {
    fontSize: 14,
    color: '#666',
  },
  emergencyButton: {
    backgroundColor: '#D32F2F',
    marginHorizontal: 16,
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  emergencyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
