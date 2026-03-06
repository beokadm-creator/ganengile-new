/**
 * Delivery Tracking Screen
 * 실시간 배송 추적 화면
 * 개선사항: 네트워크 에러 처리, 재시도 로직, 더 나은 UX
 */

import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Alert,
  RefreshControl,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { getDeliveryByRequestId } from '../../services/delivery-service';
import { getRequestById } from '../../services/request-service';
import { UserContext } from '../../contexts/UserContext';
import type { UserContextType } from '../../contexts/UserContext';
import { UserRole } from '../../types/user';
import type { Request } from '../../types/request';
import { toTrackingModel, TrackingModel, TrackingEvent } from '../../utils/request-adapters';
import { formatTimeKR } from '../../utils/date';
import { startDeliveryTracking, stopDeliveryTracking } from '../../services/location-tracking-service';

// Utils
import { retryWithBackoff, retryFirebaseQuery } from '../../utils/retry-with-backoff';
import { showErrorAlert, isNetworkError } from '../../utils/error-handler';
import { isNetworkAvailable, addNetworkListener } from '../../utils/network-detector';

const { width } = Dimensions.get('window');

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
  route: {
    params: {
      requestId: string;
    };
  };
}

export default function DeliveryTrackingScreen({ navigation, route }: Props) {
  const { requestId } = route.params;
  const { user, currentRole } = useContext(UserContext) as UserContextType;

  const [trackingData, setTrackingData] = useState<TrackingModel | null>(null);
  const [trackingEvents, setTrackingEvents] = useState<TrackingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [progress, setProgress] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  // Memoized values
  const progressValue = useMemo(() => progress, [progress]);

  useEffect(() => {
    loadTrackingData();
    setupNetworkListener();

    // Cleanup: stop location tracking when unmount
    return () => {
      if (isTracking) {
        stopDeliveryTracking();
      }
    };
  }, [requestId]);

  const setupNetworkListener = () => {
    const unsubscribe = addNetworkListener((state) => {
      setIsOnline(state.isOnline);

      // Auto-refresh when coming back online
      if (state.isOnline && !loading) {
        loadTrackingData();
      }
    });

    return unsubscribe;
  };

  const loadTrackingData = async () => {
    // Check network first
    const networkAvailable = await isNetworkAvailable();
    if (!networkAvailable) {
      setIsOnline(false);
      setLoading(false);
      return;
    }

    setIsOnline(true);
    setRetryCount(0);

    try {
      // Try to get delivery first with retry
      const deliveryData = await retryWithBackoff(
        () => getDeliveryByRequestId(requestId),
        {
          maxAttempts: 3,
          timeoutMs: 15000,
          onRetry: (attempt) => {
            setRetryCount(attempt);
            console.log(`Retry attempt ${attempt} for delivery data...`);
          },
        }
      );

      if (deliveryData) {
        const model = toTrackingModel(deliveryData);
        setTrackingData(model);
        setTrackingEvents(model.trackingEvents || []);
        calculateProgress(model.status);

        // Start real-time tracking for in_transit status
        if (model.status === 'in_transit' || model.status === 'arrived') {
          if (!isTracking && deliveryData.id) {
            startDeliveryTracking(deliveryData.id);
            setIsTracking(true);
          }

          // Update current location
          if (deliveryData.tracking?.currentLocation) {
            setCurrentLocation(deliveryData.tracking.currentLocation);
          }
        }
      } else {
        // Fallback to request data
        const requestData = await retryFirebaseQuery(() => getRequestById(requestId));
        if (requestData) {
          const model = toTrackingModel(requestData);
          setTrackingData(model);
          setTrackingEvents(model.trackingEvents || []);
          calculateProgress(model.status);
        }
      }
    } catch (error) {
      console.error('Error loading tracking data:', error);

      // Show user-friendly error
      if (isNetworkError(error)) {
        Alert.alert(
          '네트워크 오류',
          '배송 정보를 불러오지 못했습니다. 네트워크 연결을 확인해주세요.',
          [
            { text: '확인', style: 'cancel' },
            { text: '다시 시도', onPress: loadTrackingData },
          ]
        );
      } else {
        showErrorAlert(error, loadTrackingData);
      }
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTrackingData();
    setRefreshing(false);
  }, [requestId]);

  const calculateProgress = useCallback((status: string) => {
    const progressMap: Record<string, number> = {
      pending: 10,
      matched: 25,
      accepted: 40,
      in_transit: 60,
      arrived: 80,
      completed: 100,
      cancelled: 0,
      quote_requested: 5,
      quote_received: 15,
      scheduled: 20,
    };

    setProgress(progressMap[status] || 0);
  }, []);

  const getStatusColor = useCallback((status: string): string => {
    switch (status) {
      case 'pending':
        return '#FFA726';
      case 'matched':
        return '#42A5F5';
      case 'accepted':
        return '#26C6DA';
      case 'in_transit':
        return '#AB47BC';
      case 'arrived':
        return '#66BB6A';
      case 'completed':
        return '#4CAF50';
      case 'cancelled':
        return '#EF5350';
      default:
        return '#9E9E9E';
    }
  }, []);

  const getStatusText = useCallback((status: string): string => {
    switch (status) {
      case 'pending':
        return '매칭 대기 중';
      case 'matched':
        return '매칭 완료';
      case 'accepted':
        return '수락 완료';
      case 'in_transit':
        return '배송 중';
      case 'arrived':
        return '도착 완료';
      case 'completed':
        return '배송 완료';
      case 'cancelled':
        return '취소됨';
      default:
        return status;
    }
  }, []);

  const formatTime = useCallback((date: Date): string => formatTimeKR(date), []);

  // Loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00BCD4" />
        <Text style={styles.loadingText}>
          {retryCount > 0 ? `재시도 중... (${retryCount})` : '로딩 중...'}
        </Text>
      </View>
    );
  }

  // Offline state
  if (!isOnline) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>배송 추적</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.offlineContainer}>
          <Text style={styles.offlineIcon}>📡</Text>
          <Text style={styles.offlineTitle}>오프라인</Text>
          <Text style={styles.offlineText}>
            인터넷 연결을 확인해주세요.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadTrackingData}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // No data state
  if (!trackingData) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>배송 추적</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>❌</Text>
          <Text style={styles.errorTitle}>정보를 찾을 수 없음</Text>
          <Text style={styles.errorText}>
            배송 정보를 불러올 수 없습니다.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadTrackingData}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} accessibilityLabel="뒤로 가기">
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>배송 추적</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton} accessibilityLabel="새로고침">
          <ActivityIndicator size="small" color={refreshing ? '#00BCD4' : '#999'} animating={refreshing} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00BCD4"
            colors={['#00BCD4']}
          />
        }
      >
        {/* Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: getStatusColor(trackingData.status) }]}>
          <Text style={styles.statusBannerText}>{getStatusText(trackingData.status)}</Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressSection}>
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: `${progressValue}%` }]} />
          </View>
          <Text style={styles.progressText}>{progressValue}%</Text>
        </View>

        {/* Route Summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🚇 배송 경로</Text>
          <View style={styles.routeContainer}>
            <View style={styles.stationPoint}>
              <View style={styles.stationDot} />
              <Text style={styles.stationName}>{trackingData.pickupStation.stationName}</Text>
              <Text style={styles.stationLine}>{trackingData.pickupStation.line}</Text>
            </View>

            <View style={styles.routeLine}>
              <View style={styles.dashedLine} />
              <Text style={styles.routeDuration}>약 25분</Text>
            </View>

            <View style={styles.stationPoint}>
              <View style={[styles.stationDot, styles.stationDotEnd]} />
              <Text style={styles.stationName}>{trackingData.deliveryStation.stationName}</Text>
              <Text style={styles.stationLine}>{trackingData.deliveryStation.line}</Text>
            </View>
          </View>
        </View>

        {/* Tracking Timeline */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📍 추적 정보</Text>
          <View style={styles.timeline}>
            {trackingEvents.map((event, index) => (
              <View key={event.type} style={styles.timelineItem}>
                {/* Timeline Line */}
                {index < trackingEvents.length - 1 && (
                  <View style={[
                    styles.timelineLine,
                    event.completed && styles.timelineLineCompleted
                  ]} />
                )}

                {/* Timeline Dot */}
                <View style={[
                  styles.timelineDot,
                  event.completed && styles.timelineDotCompleted
                ]}
                  accessibilityLabel={event.title}
                  accessibilityState={{ selected: event.completed }}
                >
                  {event.completed && (
                    <Text style={styles.timelineDotIcon}>✓</Text>
                  )}
                </View>

                {/* Timeline Content */}
                <View style={styles.timelineContent}>
                  <Text style={[
                    styles.timelineTitle,
                    event.completed && styles.timelineTitleCompleted
                  ]}>
                    {event.title}
                  </Text>
                  <Text style={[
                    styles.timelineDescription,
                    event.completed && styles.timelineDescriptionCompleted
                  ]}>
                    {event.description}
                  </Text>
                  {event.completed && event.timestamp && (
                    <Text style={styles.timelineTime}>
                      {formatTime(event.timestamp)}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Delivery Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📦 배송 정보</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>패키지</Text>
            <Text style={styles.infoValue}>
              {trackingData.packageInfo.size === 'small' ? '소형' :
               trackingData.packageInfo.size === 'medium' ? '중형' :
               trackingData.packageInfo.size === 'large' ? '대형' : trackingData.packageInfo.size}
              ({trackingData.packageInfo.weight})
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>수신자</Text>
            <Text style={styles.infoValue}>{trackingData.recipientName || '-'}</Text>
          </View>
          {trackingData.recipientVerificationCode && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>인증코드</Text>
              <Text style={styles.verificationCode}>{trackingData.recipientVerificationCode}</Text>
            </View>
          )}
        </View>

        {/* Courier Info (if matched) */}
        {trackingData.status !== 'pending' && trackingData.status !== 'cancelled' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>👤 길러 정보</Text>
            <View style={styles.courierInfo}>
              <View style={styles.courierAvatar}>
                <Text style={styles.courierAvatarText}>🚴</Text>
              </View>
              <View style={styles.courierDetails}>
                <Text style={styles.courierName}>길러</Text>
                <Text style={styles.courierRating}>⭐ 4.8</Text>
              </View>
            </View>
          </View>
        )}

        {/* Help Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>❓ 도움이 필요하신가요?</Text>
          <TouchableOpacity
            style={styles.helpButton}
            accessibilityLabel="고객센터 문의"
          >
            <Text style={styles.helpButtonText}>고객센터 문의</Text>
          </TouchableOpacity>
        </View>

        {/* Giller Actions - for active deliveries (길러만) */}
        {trackingData &&
         (currentRole === 'giller' || currentRole === 'both') &&
         (trackingData.status === 'accepted' || trackingData.status === 'in_transit') && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📱 길러 액션</Text>
            {trackingData.status === 'accepted' && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  const delivery = trackingData as any;
                  if (delivery.deliveryId) {
                    navigation.navigate('PickupVerification', {
                      deliveryId: delivery.deliveryId,
                      requestId,
                    });
                  }
                }}
                accessibilityLabel="픽업 인증하기"
              >
                <Text style={styles.actionButtonText}>픽업 인증하기</Text>
              </TouchableOpacity>
            )}
            {trackingData.status === 'in_transit' && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  const delivery = trackingData as any;
                  if (delivery.deliveryId) {
                    navigation.navigate('DeliveryCompletion', {
                      deliveryId: delivery.deliveryId,
                    });
                  }
                }}
                accessibilityLabel="배송 완료하기"
              >
                <Text style={styles.actionButtonText}>배송 완료하기</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Gller Info - 읽기 전용 (글러만) */}
        {currentRole === 'gller' && trackingData && trackingData.status !== 'pending' && trackingData.status !== 'cancelled' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📦 배송 정보</Text>
            <Text style={styles.infoText}>
              {trackingData.status === 'accepted' && '길러가 매칭을 수락했습니다.'}
              {trackingData.status === 'in_transit' && '길러가 배송 중입니다.'}
              {trackingData.status === 'arrived' && '길러가 도착했습니다.'}
              {trackingData.status === 'completed' && '배송이 완료되었습니다.'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 14,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backButton: {
    width: 40,
  },
  backButtonText: {
    color: '#333',
    fontSize: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderColor: '#e0e0e0',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  cardTitle: {
    color: '#333',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  container: {
    backgroundColor: '#f5f5f5',
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  courierAvatar: {
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: 25,
    height: 50,
    justifyContent: 'center',
    marginRight: 12,
    width: 50,
  },
  courierAvatarText: {
    fontSize: 24,
  },
  courierDetails: {
    flex: 1,
  },
  courierInfo: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  courierName: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  courierRating: {
    color: '#FFA726',
    fontSize: 14,
  },
  dashedLine: {
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    borderWidth: 1,
    height: 2,
    marginBottom: 8,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomColor: '#e0e0e0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerSpacer: {
    width: 40,
  },
  headerTitle: {
    color: '#333',
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  refreshButton: {
    width: 40,
    alignItems: 'center',
  },
  helpButton: {
    alignItems: 'center',
    backgroundColor: '#00BCD4',
    borderRadius: 8,
    paddingVertical: 12,
  },
  helpButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoLabel: {
    color: '#666',
    fontSize: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoText: {
    color: '#666',
    fontSize: 14,
    lineHeight: 20,
  },
  infoValue: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
    marginTop: 12,
  },
  offlineContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  offlineIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  offlineText: {
    color: '#666',
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  offlineTitle: {
    color: '#333',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  errorIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  errorText: {
    color: '#666',
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  errorTitle: {
    color: '#333',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  retryButton: {
    alignItems: 'center',
    backgroundColor: '#00BCD4',
    borderRadius: 8,
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressBar: {
    backgroundColor: '#00BCD4',
    height: '100%',
  },
  progressBarContainer: {
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    height: 8,
    overflow: 'hidden',
    width: '100%',
  },
  progressSection: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
  },
  progressText: {
    color: '#00BCD4',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 8,
  },
  routeContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  routeDuration: {
    color: '#999',
    fontSize: 12,
  },
  routeLine: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 8,
  },
  stationDot: {
    backgroundColor: '#00BCD4',
    borderColor: '#fff',
    borderRadius: 8,
    borderWidth: 3,
    elevation: 2,
    height: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    width: 16,
  },
  stationDotEnd: {
    backgroundColor: '#4CAF50',
  },
  stationLine: {
    color: '#00BCD4',
    fontSize: 12,
  },
  stationName: {
    color: '#333',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  stationPoint: {
    alignItems: 'center',
  },
  statusBanner: {
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
  },
  statusBannerText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  timeline: {
    paddingLeft: 8,
  },
  timelineContent: {
    flex: 1,
    paddingTop: 2,
  },
  timelineDescription: {
    color: '#999',
    fontSize: 14,
    marginBottom: 4,
  },
  timelineDescriptionCompleted: {
    color: '#666',
  },
  timelineDot: {
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
    borderColor: '#fff',
    borderRadius: 12,
    borderWidth: 3,
    elevation: 2,
    height: 24,
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    width: 24,
    zIndex: 1,
  },
  timelineDotCompleted: {
    backgroundColor: '#00BCD4',
  },
  timelineDotIcon: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 24,
    position: 'relative',
  },
  timelineLine: {
    backgroundColor: '#e0e0e0',
    height: '100%',
    left: 11,
    position: 'absolute',
    top: 24,
    width: 2,
  },
  timelineLineCompleted: {
    backgroundColor: '#00BCD4',
  },
  timelineTime: {
    color: '#00BCD4',
    fontSize: 12,
  },
  timelineTitle: {
    color: '#999',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  timelineTitleCompleted: {
    color: '#333',
  },
  verificationCode: {
    color: '#00BCD4',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
});
