/**
 * B2B Request Screen
 * B2B 배송 요청 생성 화면
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';
import OptimizedStationSelectModal from '../../components/OptimizedStationSelectModal';
import { B2BDeliveryService } from '../../services/b2b-delivery-service';
import { requireUserId } from '../../services/firebase';

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
}

interface Station {
  stationId: string;
  stationName: string;
  line: string;
}

export default function B2BRequestScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(false);
  const [pickupStation, setPickupStation] = useState<Station | null>(null);
  const [deliveryStation, setDeliveryStation] = useState<Station | null>(null);
  const [requestType, setRequestType] = useState<'immediate' | 'reserved'>('immediate');
  const [reservedTime, setReservedTime] = useState('');
  const [specialRequest, setSpecialRequest] = useState('');
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);

  // B2B 입력 필드 상태 추가
  const [pickupAddress, setPickupAddress] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [contractId, setContractId] = useState('default');
  const [weight, setWeight] = useState('1.0');

  const handleSubmit = async () => {
    // 유효성 검사
    if (!pickupStation || !deliveryStation) {
      Alert.alert('입력 오류', '출발역과 도착역을 모두 선택해주세요.');
      return;
    }

    if (pickupStation.stationId === deliveryStation.stationId) {
      Alert.alert('입력 오류', '출발역과 도착역이 같습니다.');
      return;
    }

    if (requestType === 'reserved' && !reservedTime) {
      Alert.alert('입력 오류', '예약 시간을 입력해주세요.');
      return;
    }

    // B2B 추가 필드 검증
    if (!pickupAddress.trim()) {
      Alert.alert('입력 오류', '출발지 주소를 입력해주세요.');
      return;
    }

    if (!deliveryAddress.trim()) {
      Alert.alert('입력 오류', '도착지 주소를 입력해주세요.');
      return;
    }

    const weightNum = parseFloat(weight);
    if (isNaN(weightNum) || weightNum <= 0) {
      Alert.alert('입력 오류', '올바른 중량을 입력해주세요. (0보다 커야 합니다)');
      return;
    }

    setLoading(true);

    try {
      const businessId = await requireUserId();

      // B2B 배송 요청 생성
      const deliveryId = await B2BDeliveryService.createDelivery({
        contractId,
        businessId,
        pickupLocation: {
          station: pickupStation.stationName,
          address: pickupAddress.trim(),
          latitude: 0,
          longitude: 0,
        },
        dropoffLocation: {
          station: deliveryStation.stationName,
          address: deliveryAddress.trim(),
          latitude: 0,
          longitude: 0,
        },
        scheduledTime: requestType === 'reserved' ? new Date(reservedTime) : new Date(),
        weight: weightNum,
        notes: specialRequest,
      });

      Alert.alert(
        '✅ 요청 완료',
        `B2B 배송 요청이 완료되었습니다.\n\n요청 ID: ${deliveryId}\n\nB2B 길러를 매칭 중입니다.`,
        [
          {
            text: '확인',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error: any) {
      console.error('B2B delivery request error:', error);
      Alert.alert('요청 실패', error.message || '다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>B2B 배송 요청</Text>
          <Text style={styles.subtitle}>
            기업 전용 길러가 빠르고 안전하게 배송합니다.
          </Text>
        </View>

        {/* Route Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 경로 설정</Text>

          {/* Pickup Station */}
          <TouchableOpacity
            style={styles.stationSelector}
            onPress={() => setShowPickupModal(true)}
          >
            <Text style={styles.stationLabel}>출발역</Text>
            <Text style={styles.stationValue}>
              {pickupStation ? pickupStation.stationName : '선택하세요'}
            </Text>
          </TouchableOpacity>

          {/* Delivery Station */}
          <TouchableOpacity
            style={styles.stationSelector}
            onPress={() => setShowDeliveryModal(true)}
          >
            <Text style={styles.stationLabel}>도착역</Text>
            <Text style={styles.stationValue}>
              {deliveryStation ? deliveryStation.stationName : '선택하세요'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Request Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⏰ 요청 유형</Text>

          <View style={styles.typeButtons}>
            <TouchableOpacity
              style={[styles.typeButton, requestType === 'immediate' && styles.typeButtonActive]}
              onPress={() => setRequestType('immediate')}
            >
              <Text style={[styles.typeButtonText, requestType === 'immediate' && styles.typeButtonTextActive]}>
                즉시 배송
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.typeButton, requestType === 'reserved' && styles.typeButtonActive]}
              onPress={() => setRequestType('reserved')}
            >
              <Text style={[styles.typeButtonText, requestType === 'reserved' && styles.typeButtonTextActive]}>
                예약 배송
              </Text>
            </TouchableOpacity>
          </View>

          {/* Reserved Time Input */}
          {requestType === 'reserved' && (
            <View style={styles.timeInput}>
              <Text style={styles.timeLabel}>예약 시간</Text>
              <TextInput
                style={styles.timeInputField}
                placeholder="YYYY-MM-DD HH:MM"
                value={reservedTime}
                onChangeText={setReservedTime}
              />
            </View>
          )}
        </View>

        {/* Special Request */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📝 특별 요청사항</Text>
          <TextInput
            style={styles.specialRequestInput}
            placeholder="배송 시 주의사항이 있나요?"
            value={specialRequest}
            onChangeText={setSpecialRequest}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* B2B 추가 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏢 B2B 배송 정보</Text>

          {/* 기업 계약 ID */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>기업 계약 ID</Text>
            <TextInput
              style={styles.textInput}
              placeholder="default"
              value={contractId}
              onChangeText={setContractId}
            />
          </View>

          {/* 출발지 주소 */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>출발지 주소</Text>
            <TextInput
              style={styles.textInput}
              placeholder="서울시 강남구 테헤란로 123"
              value={pickupAddress}
              onChangeText={setPickupAddress}
            />
          </View>

          {/* 도착지 주소 */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>도착지 주소</Text>
            <TextInput
              style={styles.textInput}
              placeholder="서울시 서초구 서초대로 456"
              value={deliveryAddress}
              onChangeText={setDeliveryAddress}
            />
          </View>

          {/* 중량 */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>중량 (kg)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="1.0"
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
            />
            <Text style={styles.inputNote}>
              * 위도/경도는 주소 입력 후 자동 변환됩니다 (Geocoding API)
            </Text>
          </View>
        </View>

        {/* Estimated Cost */}
        <View style={styles.costSection}>
          <Text style={styles.costLabel}>예상 비용</Text>
          <Text style={styles.costValue}>5,000원</Text>
          <Text style={styles.costNote}>* 실제 비용은 배송 완료 후 확정됩니다.</Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.submitButtonText}>요청하기</Text>
          )}
        </TouchableOpacity>

        {/* Station Select Modals */}
        <OptimizedStationSelectModal
          visible={showPickupModal}
          onClose={() => setShowPickupModal(false)}
          onSelect={(station) => {
            setPickupStation(station);
            setShowPickupModal(false);
          }}
          title="출발역 선택"
        />

        <OptimizedStationSelectModal
          visible={showDeliveryModal}
          onClose={() => setShowDeliveryModal(false)}
          onSelect={(station) => {
            setDeliveryStation(station);
            setShowDeliveryModal(false);
          }}
          title="도착역 선택"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  content: {
    padding: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    // @ts-ignore
    ...Typography.h1,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    // @ts-ignore
    ...Typography.body,
    color: Colors.text.secondary,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  stationSelector: {
    // @ts-ignore - Colors.white
    backgroundColor: (Colors as any).white,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  stationLabel: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  stationValue: {
    ...Typography.bodyBold,
    color: pickupStation || deliveryStation ? Colors.text.primary : Colors.text.tertiary,
    fontSize: 18,
  },
  typeButtons: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  typeButton: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginHorizontal: Spacing.xs,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  typeButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeButtonText: {
    ...Typography.bodyBold,
    color: Colors.text.secondary,
  },
  typeButtonTextActive: {
    color: Colors.white,
  },
  timeInput: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  timeLabel: {
    ...Typography.bodyBold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  timeInputField: {
    ...Typography.body,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  specialRequestInput: {
    ...Typography.body,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    height: 120,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  costSection: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  costLabel: {
    ...Typography.body,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  costValue: {
    ...Typography.h1,
    color: Colors.primary,
    fontWeight: 'bold',
    marginBottom: Spacing.xs,
  },
  costNote: {
    ...Typography.bodySmall,
    color: Colors.text.tertiary,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  submitButtonDisabled: {
    backgroundColor: Colors.border,
  },
  submitButtonText: {
    ...Typography.bodyBold,
    color: Colors.white,
    fontSize: 18,
  },
  // B2B 입력 필드 스타일
  inputContainer: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  textInput: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...Typography.body,
    color: Colors.text.primary,
  },
  inputNote: {
    ...Typography.bodySmall,
    color: Colors.text.tertiary,
    marginTop: Spacing.xs,
  },
});
