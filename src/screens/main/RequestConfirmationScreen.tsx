/**
 * Request Confirmation Screen
 * 배송 요청 완료 후 안내 화면
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme';

// 웹에서는 아이콘 대신 텍스트/이모지 사용
const IconWrapper = ({ name, size, color, emoji }: { name: string; size: number; color: string; emoji?: string }) => {
  if (Platform.OS === 'web' || emoji) {
    return <Text style={{ fontSize: size, color }}>{emoji || '📦'}</Text>;
  }
  return <Ionicons name={name as any} size={size} color={color} />;
};

type RequestConfirmationRouteParams = {
  RequestConfirmation: {
    requestId: string;
    pickupStationName?: string;
    deliveryStationName?: string;
    deliveryFee?: {
      totalFee: number;
      estimatedTime: number;
    };
  };
};

export default function RequestConfirmationScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RequestConfirmationRouteParams, 'RequestConfirmation'>>();
  const { requestId, pickupStationName, deliveryStationName, deliveryFee } = route.params;

  const [loading, setLoading] = useState(false);

  const handleStartMatching = () => {
    navigation.navigate('MatchingResult' as any, {
      requestId,
      pickupStationName,
      deliveryStationName
    });
  };

  const handleViewRequest = () => {
    navigation.navigate('RequestDetail' as any, {
      requestId,
    });
  };

  const handleGoHome = () => {
    navigation.navigate('Tabs', { screen: 'Home' } as any);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 성공 아이콘 */}
        <View style={styles.iconContainer}>
          <IconWrapper name="checkmark-circle" size={80} color={Colors.success} emoji="✅" />
        </View>

        {/* 메시지 */}
        <Text style={styles.title}>배송 요청 완료!</Text>
        <Text style={styles.message}>
          요청하신 배송이 등록되었습니다.
        </Text>

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

        {/* 배송비 정보 */}
        {deliveryFee && (
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <IconWrapper name="cash-outline" size={20} color={Colors.primary} emoji="💰" />
              <View>
                <Text style={styles.feeAmount}>
                  {deliveryFee.totalFee.toLocaleString()}원
                </Text>
                <Text style={styles.feeNote}>
                  예상 소요 시간: {deliveryFee.estimatedTime}분
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* 주의사항 */}
        <View style={styles.noticeContainer}>
          <Text style={styles.noticeTitle}>⚠️ 이용 안내</Text>
          <View style={styles.noticeList}>
            <Text style={styles.noticeItem}>• 길러 매칭은 최대 1분 소요됩니다.</Text>
            <Text style={styles.noticeItem}>• 매칭이 완료되면 길러에게 연락이 갑니다.</Text>
            <Text style={styles.noticeItem}>• 길러가 배송을 수락하면 배송이 시작됩니다.</Text>
            <Text style={styles.noticeItemImportant}>• 부재하거나 위법한 물건은 배송할 수 없습니다.</Text>
          </View>
        </View>

        {/* 요청 ID */}
        <View style={styles.requestIdCard}>
          <Text style={styles.requestIdLabel}>요청 ID</Text>
          <Text style={styles.requestId}>{requestId}</Text>
        </View>

        {/* 버튼 그룹 */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleStartMatching}
          >
            <Text style={styles.primaryButtonText}>길러 매칭 시작</Text>
            <Text style={styles.buttonSubtext}>길러에게 알림 보내기</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={handleGoHome}
          >
            <Text style={styles.secondaryButtonText}>홈으로 가기</Text>
            <Text style={styles.buttonSubtext}>요청 상태는 홈에서 확인</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

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
  feeAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  feeNote: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
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
  noticeList: {
    gap: 8,
  },
  noticeItem: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  noticeItemImportant: {
    fontSize: 14,
    color: '#D84315',
    fontWeight: '500',
    lineHeight: 20,
  },
  requestIdCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  requestIdLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  requestId: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  buttonContainer: {
    gap: 12,
  },
  button: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    minWidth: '100%',
  },
  primaryButton: {
    backgroundColor: Colors.primary,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.white,
    marginBottom: 4,
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
  buttonSubtext: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
});