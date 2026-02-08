/**
 * Create Request Screen
 * 배송 요청 생성 화면 (4단계 스텝)
 * 디자인 토큰 적용 완료
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { getAllStations } from '../../services/config-service';
import { createRequest, calculateDeliveryFee } from '../../services/request-service';
import { requireUserId } from '../../services/firebase';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';
import type { Station } from '../../types/config';
import type { StationInfo, PackageSize, PackageWeight } from '../../types/request';
import TimePicker from '../../components/common/TimePicker';

function convertStationToInfo(station: Station): StationInfo {
  const firstLine = station.lines[0];
  return {
    id: station.stationId,
    stationId: station.stationId,
    stationName: station.stationName,
    line: firstLine?.lineName || '',
    lineCode: firstLine?.lineCode || '',
    lat: station.location.latitude,
    lng: station.location.longitude,
  };
}

// 무게를 PackageWeight로 변환
function convertWeightToPackageWeight(weight: number): PackageWeight {
  if (weight <= 1) return 'light' as PackageWeight;
  if (weight <= 5) return 'medium' as PackageWeight;
  return 'extra' as PackageWeight;
}

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
}

type Step = 1 | 2 | 3 | 4;

type UrgencyLevel = 'normal' | 'fast' | 'urgent';

interface UrgencyOption {
  level: UrgencyLevel;
  label: string;
  description: string;
  surchargeMultiplier: number;
  timeWindow: string;
}

const URGENCY_OPTIONS: UrgencyOption[] = [
  {
    level: 'normal',
    label: '보통',
    description: '30분 이후 픽업',
    surchargeMultiplier: 0,
    timeWindow: '30분 이후',
  },
  {
    level: 'fast',
    label: '빠름',
    description: '15~30분 내 픽업',
    surchargeMultiplier: 0.2,
    timeWindow: '15~30분 내',
  },
  {
    level: 'urgent',
    label: '매우 빠름',
    description: '15분 내 픽업',
    surchargeMultiplier: 0.5,
    timeWindow: '15분 내',
  },
];

export default function CreateRequestScreen({ navigation }: Props) {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [stations, setStations] = useState<Station[]>([]);
  const [showStationPicker, setShowStationPicker] = useState(false);
  const [pickerType, setPickerType] = useState<'pickup' | 'delivery'>('pickup');

  // Form data
  const [pickupStation, setPickupStation] = useState<Station | null>(null);
  const [deliveryStation, setDeliveryStation] = useState<Station | null>(null);
  const [packageSize, setPackageSize] = useState<PackageSize>('small' as PackageSize);
  const [weight, setWeight] = useState('');
  const [description, setDescription] = useState('');
  const [isFragile, setIsFragile] = useState(false);
  const [isPerishable, setIsPerishable] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [pickupTime, setPickupTime] = useState('12:00');
  const [deliveryTime, setDeliveryTime] = useState('14:00');
  const [urgency, setUrgency] = useState<UrgencyLevel>('normal');

  // Calculated values
  const [deliveryFee, setDeliveryFee] = useState<{
    baseFee: number;
    distanceFee: number;
    sizeFee: number;
    weightFee: number;
    totalFee: number;
    estimatedTime: number;
    urgencyFee?: number;
  } | null>(null);

  // Themed styles
  const styles = useMemo(() => createStyles(Colors, Typography, Spacing, BorderRadius), []);

  useEffect(() => {
    loadStations();
  }, []);

  useEffect(() => {
    if (pickupStation && deliveryStation && weight) {
      calculateFee();
    }
  }, [pickupStation, deliveryStation, packageSize, weight, urgency]);

  const loadStations = async () => {
    try {
      const data = await getAllStations();
      setStations(data);
    } catch (error) {
      Alert.alert('오류', '역 목록을 불러오지 못했습니다.');
      console.error('Error loading stations:', error);
    }
  };

  const calculateFee = async () => {
    if (!pickupStation || !deliveryStation || !weight) return;

    try {
      const pickupInfo = convertStationToInfo(pickupStation);
      const deliveryInfo = convertStationToInfo(deliveryStation);

      const fee = await calculateDeliveryFee(
        pickupInfo,
        deliveryInfo,
        packageSize,
        parseFloat(weight)
      );

      const urgencyOption = URGENCY_OPTIONS.find(opt => opt.level === urgency);
      const urgencyFee = Math.round(fee.baseFee * (urgencyOption?.surchargeMultiplier || 0));

      const totalFee = fee.totalFee + urgencyFee;

      setDeliveryFee({
        ...fee,
        totalFee,
        urgencyFee,
      });
    } catch (error) {
      console.error('Error calculating delivery fee:', error);
      const baseFee = 3000;
      const distanceFee = 800;
      const weightFeeValue = parseFloat(weight) * 100;
      const sizeFeeValue = packageSize === 'small' ? 0 : packageSize === 'medium' ? 500 : packageSize === 'large' ? 1000 : 2000;

      const urgencyOption = URGENCY_OPTIONS.find(opt => opt.level === urgency);
      const urgencyFee = Math.round(baseFee * (urgencyOption?.surchargeMultiplier || 0));

      const subtotal = baseFee + distanceFee + weightFeeValue + sizeFeeValue + urgencyFee;
      const vat = Math.round(subtotal * 0.1);

      setDeliveryFee({
        baseFee,
        distanceFee,
        sizeFee: sizeFeeValue,
        weightFee: weightFeeValue,
        totalFee: subtotal + vat,
        estimatedTime: 30,
        urgencyFee,
      });
    }
  };

  const validateStep1 = (): boolean => {
    if (!pickupStation) {
      Alert.alert('오류', '픽업 역을 선택해주세요.');
      return false;
    }
    if (!deliveryStation) {
      Alert.alert('오류', '배송 역을 선택해주세요.');
      return false;
    }
    if (pickupStation.stationId === deliveryStation.stationId) {
      Alert.alert('오류', '픽업 역과 배송 역이 같을 수 없습니다.');
      return false;
    }
    return true;
  };

  const validateStep2 = (): boolean => {
    if (!weight || parseFloat(weight) <= 0) {
      Alert.alert('오류', '무게를 입력해주세요.');
      return false;
    }
    if (!description || description.trim().length === 0) {
      Alert.alert('오류', '설명을 입력해주세요.');
      return false;
    }
    return true;
  };

  const validateStep3 = (): boolean => {
    if (!recipientName || recipientName.trim().length === 0) {
      Alert.alert('오류', '수신자 이름을 입력해주세요.');
      return false;
    }
    const phoneRegex = /^010-\d{4}-\d{4}$/;
    if (!phoneRegex.test(recipientPhone)) {
      Alert.alert('오류', '전화번호 형식이 올바르지 않습니다. (010-XXXX-XXXX)');
      return false;
    }
    const pickupDate = new Date();
    const [pickupHour, pickupMinute] = pickupTime.split(':').map(Number);
    pickupDate.setHours(pickupHour, pickupMinute, 0, 0);

    const deliveryDate = new Date();
    const [deliveryHour, deliveryMinute] = deliveryTime.split(':').map(Number);
    deliveryDate.setHours(deliveryHour, deliveryMinute, 0, 0);

    if (deliveryDate <= pickupDate) {
      Alert.alert('오류', '배송 마감 시간은 픽업 마감 시간보다 늦어야 합니다.');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !validateStep2()) return;
    if (currentStep === 3 && !validateStep3()) return;

    if (currentStep < 4) {
      setCurrentStep((currentStep + 1) as Step);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as Step);
    } else {
      navigation.goBack();
    }
  };

  const handleSubmit = async () => {
    if (!pickupStation || !deliveryStation || !deliveryFee) return;

    setLoading(true);
    try {
      const pickupInfo = convertStationToInfo(pickupStation);
      const deliveryInfo = convertStationToInfo(deliveryStation);
      const userId = requireUserId();

      const [pickupHour, pickupMinute] = pickupTime.split(':').map(Number);
      const pickupDeadline = new Date();
      pickupDeadline.setHours(pickupHour, pickupMinute, 0, 0);

      const [deliveryHour, deliveryMinute] = deliveryTime.split(':').map(Number);
      const deliveryDeadline = new Date();
      deliveryDeadline.setHours(deliveryHour, deliveryMinute, 0, 0);

      // PackageInfo 생성
      const packageInfo = {
        size: packageSize,
        weight: convertWeightToPackageWeight(parseFloat(weight)),
        description: `${description}${isFragile ? ' (깨지기 쉬움)' : ''}${isPerishable ? ' (부패하기 쉬움)' : ''}`,
      };

      // urgency 매핑
      const urgencyMap: Record<UrgencyLevel, 'low' | 'medium' | 'high'> = {
        normal: 'low',
        fast: 'medium',
        urgent: 'high',
      };

      await createRequest({
        requesterId: userId,
        pickupStation: pickupInfo,
        deliveryStation: deliveryInfo,
        packageInfo,
        fee: deliveryFee.totalFee,
        preferredTime: {
          departureTime: pickupTime,
          arrivalTime: deliveryTime,
        },
        deadline: deliveryDeadline,
        urgency: urgencyMap[urgency],
      });

      Alert.alert(
        '성공',
        '배송 요청이 생성되었습니다.',
        [
          {
            text: '확인',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      Alert.alert('오류', '배송 요청 생성에 실패했습니다.');
      console.error('Error creating request:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStationPicker = () => (
    <Modal
      visible={showStationPicker}
      transparent
      animationType="slide"
      onRequestClose={() => setShowStationPicker(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {pickerType === 'pickup' ? '픽업 역 선택' : '배송 역 선택'}
            </Text>
            <TouchableOpacity onPress={() => setShowStationPicker(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.stationList}>
            {stations.map((station) => (
              <TouchableOpacity
                key={station.stationId}
                style={styles.stationItem}
                onPress={() => {
                  if (pickerType === 'pickup') {
                    setPickupStation(station);
                  } else {
                    setDeliveryStation(station);
                  }
                  setShowStationPicker(false);
                }}
              >
                <Text style={styles.stationName}>{station.stationName}</Text>
                <Text style={styles.stationLine}>{station.lines[0]?.lineName || ''}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>🚇 역 선택</Text>
      <Text style={styles.stepDesc}>픽업 역과 배송 역을 선택해주세요.</Text>

      <TouchableOpacity
        style={styles.inputButton}
        onPress={() => {
          setPickerType('pickup');
          setShowStationPicker(true);
        }}
      >
        <Text style={styles.inputButtonText}>
          {pickupStation ? pickupStation.stationName : '픽업 역 선택'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.inputButton}
        onPress={() => {
          setPickerType('delivery');
          setShowStationPicker(true);
        }}
      >
        <Text style={styles.inputButtonText}>
          {deliveryStation ? deliveryStation.stationName : '배송 역 선택'}
        </Text>
      </TouchableOpacity>

      {pickupStation && deliveryStation && deliveryFee && (
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            예상 소요시간: 약 {deliveryFee.estimatedTime}분
          </Text>
        </View>
      )}
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>📦 패키지 정보</Text>
      <Text style={styles.stepDesc}>패키지 크기와 무게를 입력해주세요.</Text>

      <Text style={styles.label}>크기</Text>
      <View style={styles.sizeSelector}>
        {(['small', 'medium', 'large', 'xl'] as PackageSize[]).map((size) => (
          <TouchableOpacity
            key={size}
            style={[
              styles.sizeButton,
              packageSize === size && styles.sizeButtonActive,
            ]}
            onPress={() => setPackageSize(size)}
          >
            <Text
              style={[
                styles.sizeButtonText,
                packageSize === size && styles.sizeButtonTextActive,
              ]}
            >
              {size === 'small' ? '소형' : size === 'medium' ? '중형' : size === 'large' ? '대형' : '특대'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>무게 (kg)</Text>
      <TextInput
        style={styles.input}
        value={weight}
        onChangeText={setWeight}
        placeholder="예: 3.5"
        keyboardType="decimal-pad"
      />

      <Text style={styles.label}>설명</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={description}
        onChangeText={setDescription}
        placeholder="물건에 대한 간단한 설명"
        multiline
        numberOfLines={3}
      />

      <View style={styles.switchContainer}>
        <TouchableOpacity
          style={[styles.switchButton, isFragile && styles.switchButtonActive]}
          onPress={() => setIsFragile(!isFragile)}
        >
          <Text
            style={[styles.switchButtonText, isFragile && styles.switchButtonTextActive]}
          >
            {isFragile ? '✓ ' : ''}깨지기 쉬움
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.switchButton, isPerishable && styles.switchButtonActive]}
          onPress={() => setIsPerishable(!isPerishable)}
        >
          <Text
            style={[styles.switchButtonText, isPerishable && styles.switchButtonTextActive]}
          >
            {isPerishable ? '✓ ' : ''}부패하기 쉬움
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>긴급도</Text>
      <View style={styles.urgencyContainer}>
        {URGENCY_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.level}
            style={[
              styles.urgencyButton,
              urgency === option.level && styles.urgencyButtonActive,
            ]}
            onPress={() => setUrgency(option.level)}
          >
            <Text style={[
              styles.urgencyLabel,
              urgency === option.level && styles.urgencyLabelActive
            ]}>
              {option.label}
            </Text>
            <Text style={[
              styles.urgencyDesc,
              urgency === option.level && styles.urgencyDescActive
            ]}>
              {option.description}
            </Text>
            {option.surchargeMultiplier > 0 && (
              <Text style={styles.urgencySurcharge}>
                +{Math.round(option.surchargeMultiplier * 100)}% 추가 요금
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {deliveryFee && (
        <View style={styles.feePreviewCard}>
          <Text style={styles.feePreviewTitle}>예상 배송비</Text>
          <Text style={styles.feePreviewAmount}>{deliveryFee.totalFee.toLocaleString()}원</Text>
          {deliveryFee.urgencyFee && deliveryFee.urgencyFee > 0 && (
            <Text style={styles.feePreviewUrgency}>
              긴급 surcharge: +{deliveryFee.urgencyFee.toLocaleString()}원
            </Text>
          )}
        </View>
      )}
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>👤 수신자 정보</Text>
      <Text style={styles.stepDesc}>수신자의 연락처를 입력해주세요.</Text>

      <Text style={styles.label}>이름</Text>
      <TextInput
        style={styles.input}
        value={recipientName}
        onChangeText={setRecipientName}
        placeholder="홍길동"
      />

      <Text style={styles.label}>전화번호</Text>
      <TextInput
        style={styles.input}
        value={recipientPhone}
        onChangeText={(text) => {
          const cleaned = text.replace(/\D/g, '');
          let formatted = cleaned;
          if (cleaned.length >= 3) {
            formatted = cleaned.slice(0, 3) + '-' + cleaned.slice(3);
          }
          if (cleaned.length >= 7) {
            formatted = formatted.slice(0, 8) + '-' + cleaned.slice(7, 11);
          }
          setRecipientPhone(formatted);
        }}
        placeholder="010-1234-5678"
        keyboardType="phone-pad"
        maxLength={13}
      />

      <TimePicker
        label="픽업 마감 시간"
        value={pickupTime}
        onChange={setPickupTime}
        placeholder="픽업 시간을 선택해주세요"
        minuteInterval={10}
      />

      <TimePicker
        label="배송 마감 시간"
        value={deliveryTime}
        onChange={setDeliveryTime}
        placeholder="배송 시간을 선택해주세요"
        minuteInterval={10}
      />
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>📋 배송 요약</Text>
      <Text style={styles.stepDesc}>모든 정보를 확인하고 요청해주세요.</Text>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>🚇 경로</Text>
          <Text style={styles.summaryValue}>
            {pickupStation?.stationName} → {deliveryStation?.stationName}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>📦 패키지</Text>
          <Text style={styles.summaryValue}>
            {packageSize === 'small' ? '소형' : packageSize === 'medium' ? '중형' : packageSize === 'large' ? '대형' : '특대'} ({weight}kg)
            {isFragile && ' 🔴'}
            {isPerishable && ' 🟠'}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>👤 수신자</Text>
          <Text style={styles.summaryValue}>
            {recipientName} ({recipientPhone})
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>⏰ 시간</Text>
          <Text style={styles.summaryValue}>
            {pickupTime} → {deliveryTime}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>⚡ 긴급도</Text>
          <Text style={styles.summaryValue}>
            {URGENCY_OPTIONS.find(opt => opt.level === urgency)?.label}
          </Text>
        </View>

        {deliveryFee && (
          <>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>💵 배송비</Text>
              <Text style={styles.summaryValueTotal}>{deliveryFee.totalFee.toLocaleString()}원</Text>
            </View>
            <View style={styles.feeBreakdown}>
              <Text style={styles.feeItem}>기본: {deliveryFee.baseFee.toLocaleString()}원</Text>
              <Text style={styles.feeItem}>거리: {deliveryFee.distanceFee.toLocaleString()}원</Text>
              <Text style={styles.feeItem}>무게: {deliveryFee.weightFee.toLocaleString()}원</Text>
              <Text style={styles.feeItem}>크기: {deliveryFee.sizeFee.toLocaleString()}원</Text>
              {deliveryFee.urgencyFee && deliveryFee.urgencyFee > 0 && (
                <Text style={styles.feeItemUrgency}>긴급 surcharge: +{deliveryFee.urgencyFee.toLocaleString()}원</Text>
              )}
              <Text style={styles.feeItem}>VAT: {Math.round(deliveryFee.totalFee * 0.1).toLocaleString()}원</Text>
            </View>
          </>
        )}
      </View>

      <TouchableOpacity
        style={[styles.nextButton, styles.submitButton]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.nextButtonText}>요청하기</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressDot}>
        <View style={[styles.dot, currentStep >= 1 && styles.dotActive]} />
        <Text style={[styles.progressLabel, currentStep >= 1 && styles.progressLabelActive]}>
          역
        </Text>
      </View>
      <View style={[styles.progressLine, currentStep >= 2 && styles.progressLineActive]} />
      <View style={styles.progressDot}>
        <View style={[styles.dot, currentStep >= 2 && styles.dotActive]} />
        <Text style={[styles.progressLabel, currentStep >= 2 && styles.progressLabelActive]}>
          패키지
        </Text>
      </View>
      <View style={[styles.progressLine, currentStep >= 3 && styles.progressLineActive]} />
      <View style={styles.progressDot}>
        <View style={[styles.dot, currentStep >= 3 && styles.dotActive]} />
        <Text style={[styles.progressLabel, currentStep >= 3 && styles.progressLabelActive]}>
          수신자
        </Text>
      </View>
      <View style={[styles.progressLine, currentStep >= 4 && styles.progressLineActive]} />
      <View style={styles.progressDot}>
        <View style={[styles.dot, currentStep >= 4 && styles.dotActive]} />
        <Text style={[styles.progressLabel, currentStep >= 4 && styles.progressLabelActive]}>
          확인
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>새 배송 요청</Text>
        <View style={styles.headerSpacer} />
      </View>

      {renderProgressBar()}

      <ScrollView style={styles.content}>
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
      </ScrollView>

      {currentStep < 4 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleNext}
          >
            <Text style={styles.nextButtonText}>다음</Text>
          </TouchableOpacity>
        </View>
      )}

      {renderStationPicker()}
    </View>
  );
}

// 스타일 생성 함수 (디자인 토큰 활용)
function createStyles(
  colors: typeof Colors,
  typo: typeof Typography,
  space: typeof Spacing,
  radius: typeof BorderRadius
) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.gray100,
      flex: 1,
    },
    header: {
      alignItems: 'center',
      backgroundColor: colors.white,
      borderBottomColor: colors.gray300,
      borderBottomWidth: 1,
      flexDirection: 'row',
      paddingHorizontal: space.lg,
      paddingVertical: space.md,
    },
    backButton: {
      width: 40,
    },
    backButtonText: {
      color: colors.textPrimary,
      fontSize: typo.fontSize.xl,
    },
    headerTitle: {
      color: colors.textPrimary,
      flex: 1,
      fontSize: typo.fontSize.xl,
      fontWeight: typo.fontWeight.bold,
      textAlign: 'center',
    },
    headerSpacer: {
      width: 40,
    },
    progressContainer: {
      alignItems: 'center',
      backgroundColor: colors.white,
      borderBottomColor: colors.gray300,
      borderBottomWidth: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      paddingVertical: space.lg,
    },
    progressDot: {
      alignItems: 'center',
    },
    dot: {
      backgroundColor: colors.gray300,
      borderRadius: radius.sm,
      height: 8,
      marginBottom: space.xs,
      width: 8,
    },
    dotActive: {
      backgroundColor: colors.primary,
    },
    progressLabel: {
      color: colors.gray500,
      fontSize: typo.fontSize.sm,
    },
    progressLabelActive: {
      color: colors.primary,
      fontWeight: typo.fontWeight.semibold,
    },
    progressLine: {
      backgroundColor: colors.gray300,
      height: 2,
      marginHorizontal: space.xs,
      width: 32,
    },
    progressLineActive: {
      backgroundColor: colors.primary,
    },
    content: {
      flex: 1,
      padding: space.lg,
    },
    stepContainer: {
      paddingBottom: space.lg,
    },
    stepTitle: {
      color: colors.textPrimary,
      fontSize: typo.fontSize['3xl'],
      fontWeight: typo.fontWeight.bold,
      marginBottom: space.sm,
    },
    stepDesc: {
      color: colors.textSecondary,
      fontSize: typo.fontSize.base,
      marginBottom: space.xxl,
    },
    label: {
      color: colors.textPrimary,
      fontSize: typo.fontSize.base,
      fontWeight: typo.fontWeight.semibold,
      marginBottom: space.sm,
      marginTop: space.lg,
    },
    inputButton: {
      backgroundColor: colors.white,
      borderColor: colors.gray300,
      borderRadius: radius.md,
      borderWidth: 1,
      marginBottom: space.md,
      padding: space.lg,
    },
    inputButtonText: {
      color: colors.textPrimary,
      fontSize: typo.fontSize.lg,
    },
    input: {
      backgroundColor: colors.white,
      borderColor: colors.gray300,
      borderRadius: radius.md,
      borderWidth: 1,
      fontSize: typo.fontSize.lg,
      padding: space.lg,
    },
    textArea: {
      height: 80,
      textAlignVertical: 'top',
    },
    sizeSelector: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: space.sm,
      marginBottom: space.lg,
    },
    sizeButton: {
      alignItems: 'center',
      backgroundColor: colors.white,
      borderColor: colors.gray300,
      borderRadius: radius.md,
      borderWidth: 1,
      flex: 1,
      minWidth: '45%',
      padding: space.md,
    },
    sizeButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    sizeButtonText: {
      color: colors.textPrimary,
      fontSize: typo.fontSize.base,
    },
    sizeButtonTextActive: {
      color: colors.white,
      fontWeight: typo.fontWeight.semibold,
    },
    switchContainer: {
      flexDirection: 'row',
      gap: space.md,
      marginTop: space.lg,
    },
    switchButton: {
      alignItems: 'center',
      backgroundColor: colors.white,
      borderColor: colors.gray300,
      borderRadius: radius.md,
      borderWidth: 1,
      flex: 1,
      padding: space.md,
    },
    switchButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    switchButtonText: {
      color: colors.textPrimary,
      fontSize: typo.fontSize.base,
    },
    switchButtonTextActive: {
      color: colors.white,
      fontWeight: typo.fontWeight.semibold,
    },
    urgencyContainer: {
      gap: space.sm,
      marginTop: space.sm,
    },
    urgencyButton: {
      backgroundColor: colors.white,
      borderColor: colors.gray300,
      borderRadius: radius.md,
      borderWidth: 1,
      padding: space.md,
    },
    urgencyButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    urgencyLabel: {
      color: colors.textPrimary,
      fontSize: typo.fontSize.lg,
      fontWeight: typo.fontWeight.bold,
      marginBottom: space.xs,
    },
    urgencyLabelActive: {
      color: colors.white,
    },
    urgencyDesc: {
      color: colors.textSecondary,
      fontSize: typo.fontSize.sm,
      marginBottom: space.xs,
    },
    urgencyDescActive: {
      color: colors.white,
    },
    urgencySurcharge: {
      color: colors.accent,
      fontSize: typo.fontSize.sm,
      fontWeight: typo.fontWeight.semibold,
    },
    infoCard: {
      backgroundColor: colors.primaryLight,
      borderRadius: radius.md,
      marginTop: space.lg,
      padding: space.lg,
    },
    infoText: {
      color: colors.primaryDark,
      fontSize: typo.fontSize.base,
    },
    feePreviewCard: {
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      borderRadius: radius.md,
      marginTop: space.lg,
      padding: space.lg,
    },
    feePreviewTitle: {
      color: colors.primaryDark,
      fontSize: typo.fontSize.sm,
      marginBottom: space.xs,
    },
    feePreviewAmount: {
      color: colors.primary,
      fontSize: typo.fontSize['2xl'],
      fontWeight: typo.fontWeight.bold,
    },
    feePreviewUrgency: {
      color: colors.accent,
      fontSize: typo.fontSize.sm,
      marginTop: space.xs,
    },
    summaryCard: {
      backgroundColor: colors.white,
      borderColor: colors.gray300,
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: space.lg,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: space.md,
    },
    summaryLabel: {
      color: colors.textSecondary,
      fontSize: typo.fontSize.base,
    },
    summaryValue: {
      color: colors.textPrimary,
      flex: 1,
      fontSize: typo.fontSize.base,
      fontWeight: typo.fontWeight.semibold,
      textAlign: 'right',
    },
    summaryValueTotal: {
      color: colors.primary,
      flex: 1,
      fontSize: typo.fontSize.xl,
      fontWeight: typo.fontWeight.bold,
      textAlign: 'right',
    },
    summaryDivider: {
      backgroundColor: colors.gray300,
      height: 1,
      marginVertical: space.md,
    },
    feeBreakdown: {
      backgroundColor: colors.gray100,
      borderRadius: radius.md,
      marginTop: space.sm,
      padding: space.md,
    },
    feeItem: {
      color: colors.textSecondary,
      fontSize: typo.fontSize.sm,
      marginBottom: space.xs,
    },
    feeItemUrgency: {
      color: colors.accent,
      fontSize: typo.fontSize.sm,
      marginBottom: space.xs,
    },
    footer: {
      backgroundColor: colors.white,
      borderTopColor: colors.gray300,
      borderTopWidth: 1,
      padding: space.lg,
    },
    nextButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      padding: space.lg,
    },
    nextButtonText: {
      color: colors.white,
      fontSize: typo.fontSize.lg,
      fontWeight: typo.fontWeight.bold,
    },
    submitButton: {
      backgroundColor: colors.secondary,
      marginTop: space.lg,
    },
    // Modal styles
    modalContainer: {
      backgroundColor: colors.overlay,
      flex: 1,
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.white,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      maxHeight: '70%',
    },
    modalHeader: {
      alignItems: 'center',
      borderBottomColor: colors.gray300,
      borderBottomWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      padding: space.lg,
    },
    modalTitle: {
      color: colors.textPrimary,
      fontSize: typo.fontSize.xl,
      fontWeight: typo.fontWeight.bold,
    },
    modalClose: {
      color: colors.textSecondary,
      fontSize: typo.fontSize['5xl'],
    },
    stationList: {
      padding: space.lg,
    },
    stationItem: {
      alignItems: 'center',
      backgroundColor: colors.white,
      borderColor: colors.gray300,
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: space.sm,
      padding: space.lg,
    },
    stationName: {
      color: colors.textPrimary,
      fontSize: typo.fontSize.lg,
    },
    stationLine: {
      color: colors.textSecondary,
      fontSize: typo.fontSize.base,
    },
  });
}
