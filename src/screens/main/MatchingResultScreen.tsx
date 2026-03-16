import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme';
import * as requestService from '../../services/request-service';
import { fetchUserInfo } from '../../services/matching-service';

const IconWrapper = ({
  name,
  size,
  color,
  emoji,
}: {
  name: string;
  size: number;
  color: string;
  emoji: string;
}) => {
  if (Platform.OS === 'web') {
    return <Text style={{ fontSize: size, color }}>{emoji}</Text>;
  }
  return <Ionicons name={name as any} size={size} color={color} />;
};

type MatchingResultRouteParams = {
  MatchingResult: {
    requestId: string;
    pickupStationName?: string;
    deliveryStationName?: string;
  };
};

type RequestStatus =
  | 'pending'
  | 'matched'
  | 'accepted'
  | 'in_transit'
  | 'arrived'
  | 'delivered'
  | 'completed'
  | 'cancelled';

export const MatchingResultScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<MatchingResultRouteParams, 'MatchingResult'>>();
  const { requestId, pickupStationName, deliveryStationName } = route.params;

  const [status, setStatus] = useState<RequestStatus>('pending');
  const [_loading, setLoading] = useState(true);
  const [giller, setGiller] = useState<any>(null);
  const [notificationSent, setNotificationSent] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [noMatchMessage, setNoMatchMessage] = useState<string | null>(null);
  const [showNoMatchMessage, setShowNoMatchMessage] = useState(false);

  // 요청 상태 실시간 감시
  useEffect(() => {
    const unsubscribe = requestService.subscribeToRequest(requestId, async (request) => {
      if (request) {
        setStatus(request.status);
        const matchedGillerId = (request as any).matchedGillerId;
        if (matchedGillerId) {
          const gillerInfo = await fetchUserInfo(matchedGillerId);
          setGiller({ id: matchedGillerId, ...gillerInfo });
        }
        setLoading(false);
      }
    });

    // 길러들에게 푸시 알림 전송
    const sendNotifications = async () => {
      try {
        const result = await requestService.notifyGillers(requestId);
        if (!result.success) {
          if (result.error?.includes('매칭 가능한 길러가 없습니다')) {
            setNoMatchMessage('현재 즉시 매칭 가능한 길러가 아직 없습니다. 요청은 유지되며 순차적으로 재탐색됩니다.');
          } else {
            setNotificationError(result.error || '알림 전송에 실패했습니다.');
          }
          return;
        }
        setNotificationSent(true);
      } catch (error) {
        console.error('푸시 알림 전송 실패:', error);
        setNotificationError('알림 전송에 실패했습니다.');
      }
    };

    sendNotifications();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [requestId]);

  useEffect(() => {
    if (!noMatchMessage || status !== 'pending') {
      setShowNoMatchMessage(false);
      return;
    }
    const timer = setTimeout(() => {
      setShowNoMatchMessage(true);
    }, 20000);
    return () => clearTimeout(timer);
  }, [noMatchMessage, status]);

  const handleGoToChat = () => {
    navigation.navigate('Chat' as any, {
      gillerId: giller.id,
      requestId: requestId,
    });
  };

  const handleGoHome = () => {
    navigation.navigate('Tabs', { screen: 'Home' } as any);
  };

  const handleViewRequestDetail = () => {
    navigation.navigate('RequestDetail' as any, {
      requestId,
    });
  };

  // 매칭 완료 화면
  if ((status === 'accepted' || status === 'in_transit' || status === 'arrived' || status === 'delivered' || status === 'completed') && giller) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* 성공 아이콘 */}
          <View style={styles.iconContainer}>
            <IconWrapper name="checkmark-circle" size={100} color={Colors.success} emoji="✅" />
          </View>

          <Text style={styles.title}>길러 매칭 완료!</Text>
          <Text style={styles.message}>
            {giller.name || '길러'}님과 매칭되었습니다.
          </Text>

          {/* 길러 정보 카드 */}
          <View style={styles.infoCard}>
            <View style={styles.gillerInfo}>
              <View style={styles.avatar}>
                <IconWrapper name="person" size={40} color={Colors.primary} emoji="👤" />
              </View>
              <View style={styles.gillerDetails}>
                <Text style={styles.gillerName}>{giller.name || '길러'}</Text>
                <Text style={styles.gillerRating}>
                  ⭐ {giller.rating?.toFixed(1) || '0.0'} ({giller.completedDeliveries || 0}건 완료)
                </Text>
              </View>
            </View>
          </View>

          {/* 안내 메시지 */}
          <View style={styles.noticeContainer}>
            <Text style={styles.noticeTitle}>💬 채팅으로 조율하세요</Text>
            <Text style={styles.noticeText}>
              길러님과 채팅으로 상세 시간과 장소를 조율해주세요.
            </Text>
            <Text style={styles.noticeText}>
              정확한 픽업 시간과 장소를 미리 정하시면 배송이 원활합니다.
            </Text>
          </View>

          {/* 버튼 */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={handleGoToChat}
            >
              <IconWrapper name="chatbubbles" size={24} color={Colors.white} emoji="💬" />
              <Text style={styles.buttonText}>채팅 시작하기</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={handleViewRequestDetail}
            >
              <Text style={styles.secondaryButtonText}>요청 상세 보기</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // 매칭 대기 화면
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 로딩 인디케이터 */}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingTitle}>길러를 찾고 있습니다...</Text>
          <Text style={styles.loadingMessage}>
            해당 경로를 운행하는 길러에게 알림을 보냈습니다.
          </Text>
        </View>

        {/* 알림 전송 상태 */}
        {notificationSent && !notificationError && (
          <View style={styles.successContainer}>
            <IconWrapper name="notifications" size={30} color={Colors.success} emoji="🔔" />
            <Text style={styles.successText}>
              알림 전송 완료!
            </Text>
            <Text style={styles.successSubtext}>
              주변 길러들에게 요청 알림을 보냈습니다.
            </Text>
          </View>
        )}
        {notificationError && (
          <View style={styles.errorContainer}>
            <IconWrapper name="alert-circle" size={30} color={Colors.error} emoji="⚠️" />
            <Text style={styles.errorText}>{notificationError}</Text>
          </View>
        )}
        {showNoMatchMessage && noMatchMessage && (
          <View style={styles.pendingContainer}>
            <Text style={styles.pendingIcon}>🔎</Text>
            <View style={styles.pendingTextWrap}>
              <Text style={styles.pendingTitle}>아직 매칭 대기 중입니다</Text>
              <Text style={styles.pendingText}>{noMatchMessage}</Text>
            </View>
          </View>
        )}

        {/* 경로 정보 */}
        {(pickupStationName || deliveryStationName) && (
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <IconWrapper name="map-outline" size={20} color={Colors.primary} emoji="📍" />
              <Text style={styles.infoText}>
                {pickupStationName} → {deliveryStationName}
              </Text>
            </View>
          </View>
        )}

        {/* 안내사항 */}
        <View style={styles.noticeContainer}>
          <Text style={styles.noticeTitle}>⏰ 대기 중</Text>
          <View style={styles.noticeList}>
            <Text style={styles.noticeItem}>• 길러가 요청을 확인하면 매칭됩니다.</Text>
            <Text style={styles.noticeItem}>• 매칭되면 알림으로 알려드립니다.</Text>
            <Text style={styles.noticeItem}>• 홈으로 가셔도 알림을 받을 수 있습니다.</Text>
          </View>
        </View>

        {/* 버튼 */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={handleGoHome}
          >
            <Text style={styles.secondaryButtonText}>홈으로 가기</Text>
            <Text style={styles.buttonSubtext}>
              알림을 받으면 매칭 완료 화면이 나타납니다
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.tertiaryButton]}
            onPress={handleViewRequestDetail}
          >
            <Text style={styles.tertiaryButtonText}>요청 상세 보기</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  iconContainer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 30,
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
  loadingTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginTop: 20,
    marginBottom: 8,
  },
  loadingMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  successText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginLeft: 12,
    flex: 1,
  },
  successSubtext: {
    fontSize: 12,
    color: '#666',
    marginLeft: 48,
    marginTop: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EF5350',
  },
  errorText: {
    fontSize: 14,
    color: '#C62828',
    marginLeft: 12,
    flex: 1,
  },
  pendingContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFDE7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FBC02D',
  },
  pendingIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  pendingTextWrap: {
    flex: 1,
  },
  pendingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#8D6E00',
    marginBottom: 4,
  },
  pendingText: {
    fontSize: 13,
    color: '#6D4C41',
    lineHeight: 19,
  },
  infoCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    fontSize: 16,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  gillerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gillerDetails: {
    flex: 1,
  },
  gillerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  gillerRating: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  noticeContainer: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E65100',
    marginBottom: 12,
  },
  noticeText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  noticeList: {
    gap: 8,
  },
  noticeItem: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  buttonContainer: {
    gap: 12,
    marginTop: 20,
  },
  button: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.white,
  },
  secondaryButton: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.gray300,
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  tertiaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  tertiaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  buttonSubtext: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
});
