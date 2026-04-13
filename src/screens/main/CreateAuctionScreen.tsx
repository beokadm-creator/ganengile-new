import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import OptimizedStationSelectModal from '../../components/OptimizedStationSelectModal';
import { getAllStations } from '../../services/config-service';
import { requireUserId } from '../../services/firebase';
import { calculatePhase1DeliveryFee, type PackageSizeType } from '../../services/pricing-service';
import { createAuction } from '../../services/auction-service';
import { BorderRadius, Colors, Spacing, Typography } from '../../theme';
import type { SharedPackageSize } from '../../../shared/pricing-config';
import type { Station } from '../../types/config';
import type { MainStackNavigationProp } from '../../types/navigation';
import type { StationInfo } from '../../types/request';

function toStationInfo(station: Station): StationInfo {
  return {
    id: station.stationId,
    stationId: station.stationId,
    stationName: station.stationName,
    line: station.lines[0]?.lineName ?? '',
    lineCode: station.lines[0]?.lineCode ?? '',
    lat: station.location.latitude,
    lng: station.location.longitude,
  };
}

const PACKAGE_SIZES: Array<{ value: SharedPackageSize; label: string }> = [
  { value: 'small', label: '소형 (쇼핑백)' },
  { value: 'medium', label: '중형 (일반 상자)' },
  { value: 'large', label: '대형 (우체국 5호)' },
  { value: 'xl', label: '특대형 (캐리어)' },
  { value: 'extra_large', label: '엑스라지' },
];

function SelectorRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.selectorRow}>
      <Text style={styles.selectorLabel}>{label}</Text>
      <Text style={styles.selectorValue}>{value}</Text>
    </TouchableOpacity>
  );
}

export default function CreateAuctionScreen() {
  const navigation = useNavigation<MainStackNavigationProp>();
  const [stations, setStations] = useState<Station[]>([]);
  const [loadingStations, setLoadingStations] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickupStation, setPickupStation] = useState<Station | null>(null);
  const [deliveryStation, setDeliveryStation] = useState<Station | null>(null);
  const [pickupModalVisible, setPickupModalVisible] = useState(false);
  const [deliveryModalVisible, setDeliveryModalVisible] = useState(false);
  const [packageSize, setPackageSize] = useState<SharedPackageSize>('medium');
  const [weight, setWeight] = useState('1');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('30');

  useEffect(() => {
    let mounted = true;

    async function loadStations() {
      try {
        setLoadingStations(true);
        const result = await getAllStations();
        if (!mounted) return;
        setStations(result);
        setPickupStation(result[0] ?? null);
        setDeliveryStation(result[1] ?? null);
      } catch (error) {
        console.error('Failed to load stations:', error);
        Alert.alert('역 정보를 불러오지 못했습니다.', '잠시 후 다시 시도해 주세요.');
      } finally {
        if (mounted) {
          setLoadingStations(false);
        }
      }
    }

    void loadStations();

    return () => {
      mounted = false;
    };
  }, []);

  const estimatedFee = useMemo(() => {
    const numericWeight = Number.parseFloat(weight);
    if (!pickupStation || !deliveryStation || !Number.isFinite(numericWeight) || numericWeight <= 0) {
      return null;
    }

    return calculatePhase1DeliveryFee({
      stationCount: 5,
      weight: numericWeight,
      packageSize: packageSize as PackageSizeType,
      urgency: 'urgent',
    });
  }, [deliveryStation, packageSize, pickupStation, weight]);

  const submitDisabled =
    !pickupStation ||
    !deliveryStation ||
    pickupStation.stationId === deliveryStation.stationId ||
    !description.trim() ||
    !estimatedFee;

  const handleSubmit = async (): Promise<void> => {
    if (submitDisabled || !pickupStation || !deliveryStation || !estimatedFee) {
      Alert.alert('입력 확인', '출발역, 도착역, 물품 설명을 모두 입력해 주세요.');
      return;
    }

    try {
      setSaving(true);
      const userId = requireUserId();

      await createAuction({
        requesterId: userId,
        requesterName: '경매 요청자',
        gllerId: userId,
        gllerName: '경매 등록자',
        pickupStation: toStationInfo(pickupStation),
        deliveryStation: toStationInfo(deliveryStation),
        packageSize: packageSize === 'extra_large' ? 'xl' : packageSize,
        packageWeight: Number.parseFloat(weight),
        packageDescription: description.trim(),
        baseFee: estimatedFee.baseFee,
        distanceFee: estimatedFee.distanceFee,
        weightFee: estimatedFee.weightFee,
        sizeFee: estimatedFee.sizeFee,
        serviceFee: estimatedFee.serviceFee,
        durationMinutes: Number.parseInt(durationMinutes, 10) || 30,
      });

      Alert.alert('경매 요청이 등록되었습니다.', '즉시 매칭이 어려운 요청을 경매 보드에 올렸습니다.', [
        { text: '경매 보드 보기', onPress: () => navigation.navigate('AuctionList') },
      ]);
    } catch (error) {
      console.error('Failed to create auction:', error);
      Alert.alert('경매 요청 등록에 실패했습니다.', '잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  if (loadingStations) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.loadingText}>역 정보를 불러오고 있습니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>경매 요청</Text>
        <Text style={styles.subtitle}>즉시 매칭이 어려운 요청을 경매 보드에 다시 올릴 수 있습니다.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>이동 구간</Text>
        <SelectorRow
          label="출발역"
          value={pickupStation?.stationName ?? '출발역 선택'}
          onPress={() => setPickupModalVisible(true)}
        />
        <SelectorRow
          label="도착역"
          value={deliveryStation?.stationName ?? '도착역 선택'}
          onPress={() => setDeliveryModalVisible(true)}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>물품 정보</Text>
        <View style={styles.chipRow}>
          {PACKAGE_SIZES.map((item) => {
            const active = packageSize === item.value;
            return (
              <TouchableOpacity
                key={item.value}
                activeOpacity={0.85}
                onPress={() => setPackageSize(item.value)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TextInput
          style={styles.input}
          value={weight}
          onChangeText={setWeight}
          keyboardType="decimal-pad"
          placeholder="무게 (kg)"
        />
        <TextInput
          style={[styles.input, styles.descriptionInput]}
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="예: 서류 봉투, 노트북 파우치"
        />
        <TextInput
          style={styles.input}
          value={durationMinutes}
          onChangeText={setDurationMinutes}
          keyboardType="number-pad"
          placeholder="경매 진행 시간 (분)"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>예상 금액</Text>
        {estimatedFee ? (
          <View style={styles.feeSummary}>
            <Text style={styles.feeAmount}>{estimatedFee.totalFee.toLocaleString('ko-KR')}원</Text>
            <Text style={styles.feeHint}>
              기본 {estimatedFee.baseFee.toLocaleString('ko-KR')}원 + 거리 {estimatedFee.distanceFee.toLocaleString('ko-KR')}원 + 무게 {estimatedFee.weightFee.toLocaleString('ko-KR')}원
            </Text>
          </View>
        ) : (
          <Text style={styles.placeholderText}>물품 정보를 입력하면 예상 금액이 계산됩니다.</Text>
        )}
      </View>

      <TouchableOpacity
        activeOpacity={0.9}
        disabled={submitDisabled || saving}
        onPress={() => void handleSubmit()}
        style={[styles.primaryButton, (submitDisabled || saving) && styles.primaryButtonDisabled]}
      >
        {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryButtonText}>경매 요청 등록</Text>}
      </TouchableOpacity>

      <OptimizedStationSelectModal
        visible={pickupModalVisible}
        onClose={() => setPickupModalVisible(false)}
        onSelectStation={(station) => {
          setPickupStation(station);
          setPickupModalVisible(false);
        }}
        stations={stations}
        title="출발역 선택"
      />
      <OptimizedStationSelectModal
        visible={deliveryModalVisible}
        onClose={() => setDeliveryModalVisible(false)}
        onSelectStation={(station) => {
          setDeliveryStation(station);
          setDeliveryModalVisible(false);
        }}
        stations={stations}
        title="도착역 선택"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: Spacing['2xl'],
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.background,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
  },
  header: {
    gap: Spacing.xs,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize['2xl'],
    fontWeight: '800',
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: '700',
  },
  selectorRow: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.xs,
  },
  selectorLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.xs,
  },
  selectorValue: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
  },
  chipTextActive: {
    color: Colors.white,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
  },
  descriptionInput: {
    minHeight: 96,
    textAlignVertical: 'top',
    paddingTop: Spacing.md,
  },
  feeSummary: {
    gap: Spacing.xs,
  },
  feeAmount: {
    color: Colors.primary,
    fontSize: Typography.fontSize['2xl'],
    fontWeight: '800',
  },
  feeHint: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  placeholderText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
  },
  primaryButton: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.base,
    fontWeight: '800',
  },
});