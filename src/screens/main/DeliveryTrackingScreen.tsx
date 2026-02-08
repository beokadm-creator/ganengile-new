/**
 * Delivery Tracking Screen
 * 실시간 배송 추적 화면
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { getDeliveryByRequestId } from '../../services/delivery-service';
import { getRequestById } from '../../services/request-service';
import { requireUserId } from '../../services/firebase';
import type { DeliveryRequest, DeliveryStatus } from '../../types/delivery';

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

interface TrackingEvent {
  type: string;
  title: string;
  description: string;
  timestamp: Date;
  completed: boolean;
}

export default function DeliveryTrackingScreen({ navigation, route }: Props) {
  const { requestId } = route.params;
  const [request, setRequest] = useState<DeliveryRequest | null>(null);
  const [trackingEvents, setTrackingEvents] = useState<TrackingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    loadTrackingData();
    // Refresh every 30 seconds
    const interval = setInterval(loadTrackingData, 30000);
    return () => clearInterval(interval);
  }, [requestId]);

  const loadTrackingData = async () => {
    try {
      const userId = requireUserId();

      // Try to get delivery first
      const deliveryData = await getDeliveryByRequestId(requestId);

      if (deliveryData) {
        setRequest(deliveryData);
        generateTrackingEvents(deliveryData);
        calculateProgress(deliveryData.status);
      } else {
        // Fallback to request data
        const requestData = await getRequestById(requestId);
        if (requestData) {
          setRequest(requestData as any);
          generateTrackingEvents(requestData as any);
          calculateProgress(requestData.status as any);
        }
      }
    } catch (error) {
      console.error('Error loading tracking data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateTrackingEvents = (req: DeliveryRequest) => {
    const events: TrackingEvent[] = [
      {
        type: 'created',
        title: '요청 생성',
        description: '배송 요청이 생성되었습니다',
        timestamp: req.createdAt,
        completed: true,
      },
      {
        type: 'matched',
        title: '매칭 완료',
        description: '길러가 매칭되었습니다',
        timestamp: req.createdAt, // 실제로는 매칭 시간
        completed: ['matched', 'accepted', 'in_transit', 'arrived', 'completed'].includes(req.status),
      },
      {
        type: 'accepted',
        title: '수락 완료',
        description: '길러가 배송을 수락했습니다',
        timestamp: req.updatedAt,
        completed: ['accepted', 'in_transit', 'arrived', 'completed'].includes(req.status),
      },
      {
        type: 'picked_up',
        title: '픽업 완료',
        description: '물품을 수령했습니다',
        timestamp: req.updatedAt,
        completed: ['in_transit', 'arrived', 'completed'].includes(req.status),
      },
      {
        type: 'in_transit',
        title: '배송 중',
        description: '지하철을 타고 이동 중입니다',
        timestamp: req.updatedAt,
        completed: ['in_transit', 'arrived', 'completed'].includes(req.status),
      },
      {
        type: 'arrived',
        title: '도착 완료',
        description: '목적지에 도착했습니다',
        timestamp: req.updatedAt,
        completed: ['arrived', 'completed'].includes(req.status),
      },
      {
        type: 'completed',
        title: '배송 완료',
        description: '배송이 완료되었습니다',
        timestamp: req.updatedAt,
        completed: req.status === 'completed',
      },
    ];

    setTrackingEvents(events);
  };

  const calculateProgress = (status: DeliveryStatus) => {
    const progressMap: Record<DeliveryStatus, number> = {
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
  };

  const getStatusColor = (status: DeliveryStatus): string => {
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
  };

  const getStatusText = (status: DeliveryStatus): string => {
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
  };

  const formatTime = (date: Date): string => {
    return new Date(date).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00BCD4" />
        <Text style={styles.loadingText}>로딩 중...</Text>
      </View>
    );
  }

  if (!request) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>배송 추적</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content}>
        {/* Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: getStatusColor(request.status) }]}>
          <Text style={styles.statusBannerText}>{getStatusText(request.status)}</Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressSection}>
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>{progress}%</Text>
        </View>

        {/* Route Summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🚇 배송 경로</Text>
          <View style={styles.routeContainer}>
            <View style={styles.stationPoint}>
              <View style={styles.stationDot} />
              <Text style={styles.stationName}>{request.pickupStation.stationName}</Text>
              <Text style={styles.stationLine}>{request.pickupStation.line}</Text>
            </View>

            <View style={styles.routeLine}>
              <View style={styles.dashedLine} />
              <Text style={styles.routeDuration}>약 25분</Text>
            </View>

            <View style={styles.stationPoint}>
              <View style={[styles.stationDot, styles.stationDotEnd]} />
              <Text style={styles.stationName}>{request.deliveryStation.stationName}</Text>
              <Text style={styles.stationLine}>{request.deliveryStation.line}</Text>
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
                ]}>
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
                  {event.completed && (
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
              {request.packageInfo.size === 'small' ? '소형' :
               request.packageInfo.size === 'medium' ? '중형' :
               request.packageInfo.size === 'large' ? '대형' : '특대'}
              ({request.packageInfo.weight}kg)
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>수신자</Text>
            <Text style={styles.infoValue}>{request.recipientName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>인증코드</Text>
            <Text style={styles.verificationCode}>{request.recipientVerificationCode}</Text>
          </View>
        </View>

        {/* Courier Info (if matched) */}
        {request.status !== 'pending' && request.status !== 'cancelled' && (
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
          <TouchableOpacity style={styles.helpButton}>
            <Text style={styles.helpButtonText}>고객센터 문의</Text>
          </TouchableOpacity>
        </View>

        {/* Giller Actions - for active deliveries */}
        {request && (request.status === 'accepted' || request.status === 'in_transit') && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📱 길러 액션</Text>
            {request.status === 'accepted' && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  const delivery = request as any;
                  if (delivery.deliveryId) {
                    navigation.navigate('PickupVerification', {
                      deliveryId: delivery.deliveryId,
                      requestId,
                    });
                  }
                }}
              >
                <Text style={styles.actionButtonText}>픽업 인증하기</Text>
              </TouchableOpacity>
            )}
            {request.status === 'in_transit' && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  const delivery = request as any;
                  if (delivery.deliveryId) {
                    navigation.navigate('DeliveryCompletion', {
                      deliveryId: delivery.deliveryId,
                    });
                  }
                }}
              >
                <Text style={styles.actionButtonText}>배송 완료하기</Text>
              </TouchableOpacity>
            )}
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
