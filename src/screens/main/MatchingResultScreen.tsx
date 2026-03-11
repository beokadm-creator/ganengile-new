import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme';
import * as requestService from '../../services/request-service';

type MatchingResultRouteParams = {
  MatchingResult: {
    requestId: string;
    pickupStationName?: string;
    deliveryStationName?: string;
  };
};

type RequestStatus = 'pending' | 'matched' | 'in_progress' | 'completed' | 'cancelled';

export const MatchingResultScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<MatchingResultRouteParams, 'MatchingResult'>>();
  const { requestId, pickupStationName, deliveryStationName } = route.params;

  const [status, setStatus] = useState<RequestStatus>('pending');
  const [loading, setLoading] = useState(true);
  const [giller, setGiller] = useState<any>(null);
  const [notificationSent, setNotificationSent] = useState(false);

  // 요청 상태 실시간 감시
  useEffect(() => {
    const unsubscribe = requestService.subscribeToRequest(requestId, (request) => {
      if (request) {
        setStatus(request.status);
        if (request.status === 'matched' && (request as any).matchedGillerId) {
          // 문서에 giller 정보가 같이 포함되어 있다고 가정하거나 별도로 가져와야 함
          setGiller((request as any).giller || { name: '길러', rating: 5.0 });
        }
        setLoading(false);
      }
    });

    // 길러들에게 푸시 알림 전송
    const sendNotifications = async () => {
      try {
        await requestService.notifyGillers(requestId);
        setNotificationSent(true);
      } catch (error) {
        console.error('푸시 알림 전송 실패:', error);
      }
    };

    sendNotifications();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [requestId]);

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
  if (status === 'matched' && giller) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* 성공 아이콘 */}
          <View style={styles.iconContainer}>
            <Ionicons name="checkmark-circle" size={100} color={Colors.success} />
          </View>

          <Text style={styles.title}>길러 매칭 완료!</Text>
          <Text style={styles.message}>
            {giller.name || '길러'}님과 매칭되었습니다.
          </Text>

          {/* 길러 정보 카드 */}
          <View style={styles.infoCard}>
            <View style={styles.gillerInfo}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={40} color={Colors.primary} />
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
              <Ionicons name="chatbubbles" size={24} color={Colors.white} />
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

        {/* 알림 전송 완료 메시지 */}
        {notificationSent && (
          <View style={styles.successContainer}>
            <Ionicons name="notifications" size={30} color={Colors.success} />
            <Text style={styles.successText}>
              알림 전송 완료!
            </Text>
            <Text style={styles.successSubtext}>
              주변 길러들에게 요청 알림을 보냈습니다.
            </Text>
          </View>
        )}

        {/* 경로 정보 */}
        {(pickupStationName || deliveryStationName) && (
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="map-outline" size={20} color={Colors.primary} />
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
            <Text style={styles.noticeItem}>• 매칭되면 알림로 알려드립니다.</Text>
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
