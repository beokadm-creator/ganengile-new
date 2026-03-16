import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { getAllStations, getTravelTimeConfig } from '../../services/config-service';
import { createAuction } from '../../services/auction-service';
import {
  calculatePhase1DeliveryFee,
} from '../../services/pricing-service';
import type { Phase1PricingParams, PackageSizeType } from '../../services/pricing-service';
import { OptimizedStationSelectModal } from '../../components/OptimizedStationSelectModal';
import AppTopBar from '../../components/common/AppTopBar';
import { requireUserId } from '../../services/firebase';
import { Colors } from '../../theme';
import type { Station } from '../../types/config';
import type { CreateAuctionData } from '../../types/auction';
import { AuctionType, AuctionStatus } from '../../types/auction';

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
}

export default function CreateAuctionScreen({ navigation }: Props) {
  const [currentStep, setCurrentStep] = useState<number>(1);
    const [loading, setLoading] = useState(false);
    const [loadingStations, setLoadingStations] = useState(true);
    const [stations, setStations] = useState<Station[]>([]);
    const [showStationPicker, setShowStationPicker] = useState(false);
    const [pickerType, setPickerType] = useState<'pickup' | 'delivery'>('pickup');
    const [pickupStation, setPickupStation] = useState<Station | null>(null);
    const [deliveryStation, setDeliveryStation] = useState<Station | null>(null);
    const [packageSize, setPackageSize] = useState<'small' | 'medium' | 'large' | 'xl'>('small');
    const [weight, setWeight] = useState('');
    const [description, setDescription] = useState('');
    const [durationMinutes, setDurationMinutes] = useState(30);

    const [errors, setErrors] = useState<Record<string, string>>({});

    const [deliveryFee, setDeliveryFee] = useState<{
      baseFee: number;
      distanceFee: number;
      sizeFee: number;
      weightFee: number;
      serviceFee: number;
      vat: number;
      totalFee: number;
      estimatedTime: number;
    } | null>(null);

    const styles = useMemo(() => createStyles(Colors), []);

    useEffect(() => {
      loadStations();
    }, []);

    useEffect(() => {
      if (pickupStation && deliveryStation && weight) {
        calculateFee();
      }
    }, [pickupStation, deliveryStation, packageSize, weight]);

    const loadStations = async () => {
      setLoadingStations(true);
      try {
        const data = await getAllStations();
        setStations(data);
      } catch (error) {
        console.error('Error loading stations:', error);
        Alert.alert('오류', '역 목록을 불러오는데 실패했습니다');
        setLoadingStations(false);
      }
    };

    const calculateFee = async () => {
      if (!pickupStation || !deliveryStation || !weight) return;

      try {
        const travelTimeData = await getTravelTimeConfig(
          pickupStation.stationId,
          deliveryStation.stationId
        );

        const travelTimeSeconds = travelTimeData?.normalTime ?? 1800;
        const travelTimeMinutes = Math.round(travelTimeSeconds / 60);
        const stationCount = Math.max(1, Math.round(travelTimeMinutes / 2.5));

        const pricingParams: Phase1PricingParams = {
          stationCount,
          weight: parseFloat(weight),
          packageSize: packageSize as PackageSizeType,
          urgency: 'normal',
        };

        const feeResult = calculatePhase1DeliveryFee(pricingParams);

        setDeliveryFee({
          baseFee: feeResult.baseFee,
          distanceFee: feeResult.distanceFee,
          sizeFee: feeResult.sizeFee,
          weightFee: feeResult.weightFee,
          serviceFee: feeResult.serviceFee,
          vat: feeResult.vat,
          totalFee: feeResult.totalFee,
          estimatedTime: travelTimeMinutes,
        });
      } catch (error) {
        console.error('Error calculating delivery fee:', error);
        const fallback = calculatePhase1DeliveryFee({
          stationCount: 5,
          weight: parseFloat(weight) || 1,
          packageSize: packageSize as PackageSizeType,
          urgency: 'normal',
        });
        setDeliveryFee({
          baseFee: fallback.baseFee,
          distanceFee: fallback.distanceFee,
          sizeFee: fallback.sizeFee,
          weightFee: fallback.weightFee,
          serviceFee: fallback.serviceFee,
          vat: fallback.vat,
          totalFee: fallback.totalFee,
          estimatedTime: 30,
        });
      }
    };

    const validateStep1 = useCallback((): boolean => {
      const newErrors: Record<string, string> = {};

      if (!pickupStation) {
        newErrors.pickupStation = '픽업 역을 선택해주세요.';
      }
      if (!deliveryStation) {
        newErrors.deliveryStation = '배송 역을 선택해주세요.';
      }

      const pickupId = pickupStation?.stationId;
      const deliveryId = deliveryStation?.stationId;

      if (pickupId && deliveryId && pickupId === deliveryId) {
        newErrors.deliveryStation = '픽업 역과 배송 역이 같을 수 없습니다.';
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    }, [pickupStation, deliveryStation]);

    const validateStep2 = useCallback((): boolean => {
      const newErrors: Record<string, string> = {};

      if (!weight || parseFloat(weight) <= 0) {
        newErrors.weight = '무게를 입력해주세요.';
      } else if (parseFloat(weight) > 30) {
        newErrors.weight = '무게는 30kg 이하여야 합니다.';
      }
      if (!description || description.trim().length === 0) {
        newErrors.description = '설명을 입력해주세요.';
      }
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    }, [weight, description]);

    const handleNext = () => {
      if (currentStep === 1 && !validateStep1()) return;
      if (currentStep === 2 && !validateStep2()) return;

      if (currentStep < 5) {
        setCurrentStep((currentStep + 1));
      }
    };

    const handleBack = () => {
      if (currentStep > 1) {
        setCurrentStep((currentStep - 1));
      } else {
        navigation.goBack();
      }
    };

    const handleSubmit = async () => {
      if (!pickupStation || !deliveryStation || !weight || !deliveryFee) {
        Alert.alert('오류', '모든 필수 정보를 입력해주세요.');
        return;
      }

      setLoading(true);

      try {
        const userId = requireUserId();

        const auctionData: CreateAuctionData = {
          gllerId: userId,
          gllerName: '사용자',
          pickupStation: {
            id: pickupStation.stationId,
            stationId: pickupStation.stationId,
            stationName: pickupStation.stationName,
            line: pickupStation.lines[0]?.lineName || '',
            lineCode: pickupStation.lines[0]?.lineCode || '',
            lat: pickupStation.location.latitude,
            lng: pickupStation.location.longitude,
          },
          deliveryStation: {
            id: deliveryStation.stationId,
            stationId: deliveryStation.stationId,
            stationName: deliveryStation.stationName,
            line: deliveryStation.lines[0]?.lineName || '',
            lineCode: deliveryStation.lines[0]?.lineCode || '',
            lat: deliveryStation.location.latitude,
            lng: deliveryStation.location.longitude,
          },
          packageSize,
          weight: parseFloat(weight),
          packageDescription: description,
          baseFee: deliveryFee.totalFee,
          distanceFee: deliveryFee.distanceFee,
          weightFee: deliveryFee.weightFee,
          sizeFee: deliveryFee.sizeFee,
          serviceFee: deliveryFee.serviceFee,
          durationMinutes,
        };

        await createAuction(auctionData);

        Alert.alert(
          '성공',
          '경매가 생성되었습니다!',
          [
            {
              text: '확인',
              onPress: () => {
                navigation.navigate('AuctionList' as never);
              },
            },
          ]
        );
      } catch (error) {
        console.error('Error creating auction:', error);
        Alert.alert('오류', error instanceof Error ? error.message : '경매 생성에 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    const handleStationSelect = (station: Station) => {
      setErrors((prev) => ({ ...prev, pickupStation: '', deliveryStation: '' }));
      if (pickerType === 'pickup') {
        setPickupStation(station);
      } else {
        setDeliveryStation(station);
      }
      setShowStationPicker(false);
    };

  const validateStep1 = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!pickupStation) {
      newErrors.pickupStation = '픽업 역을 선택해주세요.';
    }
    if (!deliveryStation) {
      newErrors.deliveryStation = '배송 역을 선택해주세요.';
    }

    const pickupId = pickupStation?.stationId;
    const deliveryId = deliveryStation?.stationId;

    if (pickupId && deliveryId && pickupId === deliveryId) {
      newErrors.deliveryStation = '픽업 역과 배송 역이 같을 수 없습니다.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [pickupStation, deliveryStation]);

  const validateStep2 = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!weight || parseFloat(weight) <= 0) {
      newErrors.weight = '무게를 입력해주세요.';
    } else if (parseFloat(weight) > 30) {
      newErrors.weight = '무게는 30kg 이하여야 합니다.';
    }
    if (!description || description.trim().length === 0) {
      newErrors.description = '설명을 입력해주세요.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [weight, description]);

  const handleNext = () => {
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !validateStep2()) return;

    if (currentStep < 5) {
      setCurrentStep((currentStep + 1));
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1));
    } else {
      navigation.goBack();
    }
  };

  const handleSubmit = async () => {
    if (!pickupStation || !deliveryStation || !weight || !deliveryFee) {
      Alert.alert('오류', '모든 필수 정보를 입력해주세요.');
      return;
    }

    setLoading(true);

    try {
      const userId = requireUserId();

      const auctionData: CreateAuctionData = {
        gllerId: userId,
        gllerName: '사용자',
        pickupStation: {
          id: pickupStation.stationId,
          stationId: pickupStation.stationId,
          stationName: pickupStation.stationName,
          line: pickupStation.lines[0]?.lineName || '',
          lineCode: pickupStation.lines[0]?.lineCode || '',
          lat: pickupStation.location.latitude,
          lng: pickupStation.location.longitude,
        },
        deliveryStation: {
          id: deliveryStation.stationId,
          stationId: deliveryStation.stationId,
          stationName: deliveryStation.stationName,
          line: deliveryStation.lines[0]?.lineName || '',
          lineCode: deliveryStation.lines[0]?.lineCode || '',
          lat: deliveryStation.location.latitude,
          lng: deliveryStation.location.longitude,
        },
        packageSize,
        weight: parseFloat(weight),
        packageDescription: description,
        baseFee: deliveryFee.totalFee,
        distanceFee: deliveryFee.distanceFee,
        weightFee: deliveryFee.weightFee,
        sizeFee: deliveryFee.sizeFee,
        serviceFee: deliveryFee.serviceFee,
        durationMinutes,
      };

      await createAuction(auctionData);

      Alert.alert(
        '성공',
        '경매가 생성되었습니다!',
        [
          {
            text: '확인',
            onPress: () => {
              navigation.navigate('AuctionList' as never);
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error creating auction:', error);
      Alert.alert('오류', error instanceof Error ? error.message : '경매 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleStationSelect = (station: Station) => {
    setErrors((prev) => ({ ...prev, pickupStation: '', deliveryStation: '' }));
    if (pickerType === 'pickup') {
      setPickupStation(station);
    } else {
      setDeliveryStation(station);
    }
    setShowStationPicker(false);
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>🚇 역 선택</Text>
      <Text style={styles.stepDesc}>픽업 역과 배송 역을 선택해주세요.</Text>

      <TouchableOpacity
        style={[styles.inputButton, errors.pickupStation && styles.inputButtonError]}
        onPress={() => {
          setPickerType('pickup');
          setShowStationPicker(true);
        }}
      >
        <Text style={styles.inputButtonText}>
          {pickupStation ? pickupStation.stationName : '픽업 역 선택'}
        </Text>
      </TouchableOpacity>
      {errors.pickupStation && <Text style={styles.errorText}>{errors.pickupStation}</Text>}

      <TouchableOpacity
        style={[styles.inputButton, errors.deliveryStation && styles.inputButtonError]}
        onPress={() => {
          setPickerType('delivery');
          setShowStationPicker(true);
        }}
      >
        <Text style={styles.inputButtonText}>
          {deliveryStation ? deliveryStation.stationName : '배송 역 선택'}
        </Text>
      </TouchableOpacity>
      {errors.deliveryStation && <Text style={styles.errorText}>{errors.deliveryStation}</Text>}

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
        {(['small', 'medium', 'large', 'xl'] as const).map((size) => (
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
        style={[styles.input, errors.weight && styles.inputError]}
        value={weight}
        onChangeText={setWeight}
        placeholder="예: 3.5"
        keyboardType="decimal-pad"
      />
      {errors.weight && <Text style={styles.errorText}>{errors.weight}</Text>}

      <Text style={styles.label}>설명</Text>
      <TextInput
        style={[styles.input, styles.textArea, errors.description && styles.inputError]}
        value={description}
        onChangeText={setDescription}
        placeholder="물건에 대한 간단한 설명"
        multiline
        numberOfLines={3}
      />
      {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}

      <Text style={styles.label}>경매 진행 시간 (분)</Text>
      <View style={styles.durationSelector}>
        {[15, 30, 60, 120].map((duration) => (
          <TouchableOpacity
            key={duration}
            style={[
              styles.durationButton,
              durationMinutes === duration && styles.durationButtonActive,
            ]}
            onPress={() => setDurationMinutes(duration)}
          >
            <Text
              style={[
                styles.durationButtonText,
                durationMinutes === duration && styles.durationButtonTextActive,
              ]}
            >
              {duration}분
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {deliveryFee && (
        <View style={styles.feePreviewCard}>
          <Text style={styles.feePreviewTitle}>예상 배송비 (기본 요금)</Text>
          <Text style={styles.feePreviewAmount}>{deliveryFee.totalFee.toLocaleString()}원</Text>
          <View style={styles.feeBreakdown}>
            <Text style={styles.feeBreakdownText}>
              기본: {deliveryFee.baseFee.toLocaleString()}원
            </Text>
            <Text style={styles.feeBreakdownText}>
              거리: {deliveryFee.distanceFee.toLocaleString()}원
            </Text>
            <Text style={styles.feeBreakdownText}>
              무게: {deliveryFee.weightFee.toLocaleString()}원
            </Text>
            <Text style={styles.feeBreakdownText}>
              {deliveryFee.sizeFee > 0
                ? `크기: ${deliveryFee.sizeFee.toLocaleString()}원`
                : '크기: 추가요금 없음'}
            </Text>
            <Text style={styles.feeBreakdownText}>
              서비스 수수료: {deliveryFee.serviceFee.toLocaleString()}원
            </Text>
            <Text style={styles.feeBreakdownText}>
              VAT: {deliveryFee.vat.toLocaleString()}원
            </Text>
          </View>
          <Text style={styles.feePreviewNote}>
            * 이 요금은 기본 요금이며, 더 빠른 배송을 원하시면 요금을 올려 입찰할 수 있습니다.
          </Text>
        </View>
      )}
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>📋 요약</Text>
      <Text style={styles.stepDesc}>입력하신 정보를 확인해주세요.</Text>

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
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>⏱ 경매 시간</Text>
          <Text style={styles.summaryValue}>{durationMinutes}분</Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>💵 기본 배송비</Text>
          <Text style={styles.summaryValueTotal}>
            {deliveryFee?.totalFee.toLocaleString()}원
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.nextButton, styles.submitButton]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.submitButtonText}>
            {loading ? '생성 중...' : '경매 생성'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderStep4 = () => renderStep3();
  const renderStep5 = () => renderStep3();

  if (loadingStations) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>역 목록 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppTopBar title="새 경매" onBack={handleBack} />

      <View style={styles.progressContainer}>
        <View style={styles.progressDot}>
          <View style={[styles.dot, currentStep >= 1 && styles.dotActive]} />
          <Text style={[styles.progressLabel, currentStep >= 1 && styles.progressLabelActive]}>역</Text>
        </View>
        <View style={[styles.progressLine, currentStep >= 2 && styles.progressLineActive]} />
        <View style={styles.progressDot}>
          <View style={[styles.dot, currentStep >= 2 && styles.dotActive]} />
          <Text style={[styles.progressLabel, currentStep >= 2 && styles.progressLabelActive]}>패키지</Text>
        </View>
        <View style={[styles.progressLine, currentStep >= 3 && styles.progressLineActive]} />
        <View style={styles.progressDot}>
          <View style={[styles.dot, currentStep >= 3 && styles.dotActive]} />
          <Text style={[styles.progressLabel, currentStep >= 3 && styles.progressLabelActive]}>확인</Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep >= 3 && renderStep3()}
      </ScrollView>

      {currentStep < 3 && (
        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>다음</Text>
        </TouchableOpacity>
      )}

      <OptimizedStationSelectModal
        visible={showStationPicker}
        stations={stations}
        onClose={() => setShowStationPicker(false)}
        onSelectStation={handleStationSelect}
        title={pickerType === 'pickup' ? '픽업 역 선택' : '배송 역 선택'}
      />
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: typeof Colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.gray100,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.white,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.gray300,
    },
    backButton: {
      width: 40,
    },
    backButtonText: {
    fontSize: 24,
      color: colors.textPrimary,
    },
    headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    color: colors.textPrimary,
    },
    headerSpacer: {
    width: 40,
    },
    progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: colors.white,
      borderBottomWidth: 1,
      borderBottomColor: colors.gray300,
    },
    progressDot: {
    alignItems: 'center',
    },
    dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gray300,
      marginBottom: 4,
    },
    dotActive: {
    backgroundColor: colors.primary,
    },
    progressLabel: {
    fontSize: 12,
      color: colors.gray500,
      marginTop: 4,
    },
    progressLabelActive: {
    color: colors.primary,
      fontWeight: '600',
    },
    progressLine: {
    width: 32,
    height: 2,
    backgroundColor: colors.gray300,
      marginHorizontal: 4,
    },
    progressLineActive: {
    backgroundColor: colors.primary,
    },
    content: {
    flex: 1,
      padding: 16,
    },
    stepContainer: {
    paddingBottom: 16,
    },
    stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
    color: colors.textPrimary,
    },
    stepDesc: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 24,
    },
    label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
    color: colors.textPrimary,
    },
    inputButton: {
    backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.gray300,
      borderRadius: 8,
      padding: 16,
      marginBottom: 12,
    },
    inputButtonError: {
    borderColor: colors.error,
    },
    inputButtonText: {
    fontSize: 18,
    color: colors.textPrimary,
    },
    errorText: {
    fontSize: 14,
    color: colors.error,
    marginTop: 4,
    },
    input: {
    backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.gray300,
      borderRadius: 8,
      padding: 16,
      fontSize: 18,
    },
    inputError: {
    borderColor: colors.error,
    },
    textArea: {
    height: 80,
      textAlignVertical: 'top',
    },
    charCount: {
    fontSize: 12,
    color: colors.gray500,
    textAlign: 'right',
      marginTop: 4,
    },
    sizeSelector: {
    flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
    },
    sizeButton: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.gray300,
      borderRadius: 8,
      padding: 12,
    },
    sizeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    },
    sizeButtonText: {
    fontSize: 16,
    color: colors.textPrimary,
    },
    sizeButtonTextActive: {
    color: colors.white,
      fontWeight: '600',
    },
    infoCard: {
    backgroundColor: colors.primaryLight,
      borderRadius: 8,
      padding: 16,
      marginTop: 16,
    },
    infoText: {
    fontSize: 16,
    color: colors.primary,
    },
    durationSelector: {
    flexDirection: 'row',
      gap: 8,
      marginTop: 8,
    },
    durationButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.gray300,
      borderRadius: 8,
      padding: 12,
    },
    durationButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    },
    durationButtonText: {
    fontSize: 14,
    color: colors.textPrimary,
    },
    durationButtonTextActive: {
    color: colors.white,
      fontWeight: '600',
    },
    feePreviewCard: {
    backgroundColor: colors.white,
      borderRadius: 12,
      padding: 16,
      marginTop: 16,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    feePreviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
      marginBottom: 8,
    },
    feePreviewAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
    },
    feeBreakdown: {
    marginTop: 12,
    },
    feeBreakdownText: {
    fontSize: 14,
    color: colors.textSecondary,
      marginBottom: 4,
    },
    feePreviewNote: {
    fontSize: 12,
    color: colors.textSecondary,
      marginTop: 8,
    },
    summaryCard: {
    backgroundColor: colors.white,
      borderRadius: 12,
      padding: 16,
    },
    summaryRow: {
    flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    },
    summaryValue: {
    fontSize: 16,
    color: colors.textPrimary,
      fontWeight: '500',
    },
    summaryValueTotal: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    },
    summaryDivider: {
    height: 1,
    backgroundColor: colors.gray200,
      marginVertical: 16,
    },
    nextButton: {
    backgroundColor: colors.primary,
      borderRadius: 12,
    padding: 16,
    alignItems: 'center',
      marginTop: 16,
    },
    nextButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
    },
    submitButton: {
    marginTop: 24,
    },
    submitButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
    },
    loadingContainer: {
    flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
    },
  });
}
