import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import AppTopBar from '../../components/common/AppTopBar';
import { OptimizedStationSelectModal } from '../../components/OptimizedStationSelectModal';
import { useUser } from '../../contexts/UserContext';
import {
  buildBeta1QuoteCards,
  createBeta1Request,
  type Beta1QuoteCard,
} from '../../services/beta1-orchestration-service';
import { getAllStations } from '../../services/config-service';
import { requireUserId } from '../../services/firebase';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';
import type { Station } from '../../types/config';
import type { MainStackNavigationProp, MainStackParamList } from '../../types/navigation';
import type { StationInfo } from '../../types/request';

type RequestPackageSize = 'small' | 'medium' | 'large' | 'xl';
type PickerType = 'pickup' | 'delivery';

type Props = {
  navigation: MainStackNavigationProp;
  route?: {
    params?: MainStackParamList['CreateRequest'];
  };
};

function parseEtaMinutes(etaLabel: string): number {
  const matched = etaLabel.match(/(\d+)/);
  return matched ? Number(matched[1]) : 0;
}

function toStationInfo(station: Station): StationInfo {
  const line = station.lines?.[0];
  const location = station.location as
    | { lat?: number; lng?: number; latitude?: number; longitude?: number }
    | undefined;

  return {
    id: station.stationId || station.stationName,
    stationId: station.stationId || station.stationName,
    stationName: station.stationName,
    line: line?.lineName || '',
    lineCode: line?.lineCode || '',
    lat: location?.lat ?? location?.latitude ?? 37.5665,
    lng: location?.lng ?? location?.longitude ?? 126.978,
  };
}

function fromPrefillStation(station?: StationInfo): Station | null {
  if (!station) {
    return null;
  }

  return {
    stationId: station.stationId,
    stationName: station.stationName,
    stationNameEnglish: station.stationName,
    isTransferStation: false,
    isExpressStop: false,
    isTerminus: false,
    lines: [
      {
        lineId: station.lineCode || station.line || 'line',
        lineCode: station.lineCode,
        lineName: station.line,
        lineColor: Colors.textSecondary,
        lineType: 'general',
      },
    ],
    location: {
      latitude: station.lat,
      longitude: station.lng,
    },
    facilities: {
      hasElevator: false,
      hasEscalator: false,
      wheelchairAccessible: false,
    },
    isActive: true,
    region: '서울',
    priority: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function getFallbackStation(type: PickerType): Station {
  const isPickup = type === 'pickup';
  return {
    stationId: isPickup ? 'preview-pickup' : 'preview-delivery',
    stationName: isPickup ? '출발역' : '도착역',
    stationNameEnglish: isPickup ? 'Pickup' : 'Dropoff',
    isTransferStation: false,
    isExpressStop: false,
    isTerminus: false,
    lines: [
      {
        lineId: isPickup ? '2' : '3',
        lineCode: isPickup ? '2' : '3',
        lineName: isPickup ? '2호선' : '3호선',
        lineColor: Colors.primary,
        lineType: 'general',
      },
    ],
    location: {
      latitude: isPickup ? 37.5665 : 37.5704,
      longitude: isPickup ? 126.978 : 126.991,
    },
    facilities: {
      hasElevator: false,
      hasEscalator: false,
      wheelchairAccessible: false,
    },
    isActive: true,
    region: '서울',
    priority: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function SegmentButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.segmentButton, active && styles.segmentButtonActive]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function StationButton({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.stationButton} onPress={onPress} activeOpacity={0.92}>
      <Text style={styles.stationLabel}>{label}</Text>
      <Text style={styles.stationValue}>{value}</Text>
    </TouchableOpacity>
  );
}

export default function CreateRequestScreen({ navigation, route }: Props) {
  const { user } = useUser();
  const params = route?.params;
  const prefill = params?.prefill;
  const isReservationFlow = params?.mode === 'reservation';

  const [stations, setStations] = useState<Station[]>([]);
  const [loadingStations, setLoadingStations] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerType, setPickerType] = useState<PickerType>('pickup');

  const [pickupStation, setPickupStation] = useState<Station | null>(() => fromPrefillStation(prefill?.pickupStation));
  const [deliveryStation, setDeliveryStation] = useState<Station | null>(() => fromPrefillStation(prefill?.deliveryStation));
  const [packageDescription, setPackageDescription] = useState(prefill?.packageDescription ?? '');
  const [packageSize, setPackageSize] = useState<RequestPackageSize>(prefill?.packageSize ?? 'small');
  const [weightKg, setWeightKg] = useState(String(prefill?.weightKg ?? 1));
  const [itemValue, setItemValue] = useState(prefill?.itemValue ? String(prefill.itemValue) : '');
  const [recipientName, setRecipientName] = useState(prefill?.recipientName ?? '');
  const [recipientPhone, setRecipientPhone] = useState(prefill?.recipientPhone ?? '');
  const [directMode, setDirectMode] = useState<'none' | 'requester_to_station' | 'locker_assisted'>(
    prefill?.directParticipationMode ?? 'none'
  );
  const [urgency, setUrgency] = useState<'normal' | 'fast' | 'urgent'>(
    prefill?.urgency ?? (isReservationFlow ? 'normal' : 'fast')
  );
  const [requestMode, setRequestMode] = useState<'immediate' | 'reservation'>(
    isReservationFlow ? 'reservation' : 'immediate'
  );
  const [preferredPickupTime, setPreferredPickupTime] = useState(prefill?.preferredPickupTime ?? '');
  const [preferredArrivalTime, setPreferredArrivalTime] = useState(prefill?.preferredArrivalTime ?? '');
  const [selectedQuoteType, setSelectedQuoteType] = useState<Beta1QuoteCard['quoteType']>(
    isReservationFlow ? 'balanced' : 'fastest'
  );

  useEffect(() => {
    const load = async () => {
      try {
        const nextStations = await getAllStations();
        setStations(nextStations);

        if (prefill?.pickupStation && !pickupStation) {
          const match = nextStations.find((station) => station.stationId === prefill.pickupStation?.stationId);
          if (match) {
            setPickupStation(match);
          }
        }

        if (prefill?.deliveryStation && !deliveryStation) {
          const match = nextStations.find((station) => station.stationId === prefill.deliveryStation?.stationId);
          if (match) {
            setDeliveryStation(match);
          }
        }
      } finally {
        setLoadingStations(false);
      }
    };

    void load();
  }, [deliveryStation, pickupStation, prefill?.deliveryStation, prefill?.pickupStation]);

  const quoteCards = useMemo<Beta1QuoteCard[]>(() => {
    const fallbackPickup = pickupStation ?? stations[0] ?? getFallbackStation('pickup');
    const fallbackDelivery = deliveryStation ?? stations[1] ?? getFallbackStation('delivery');

    return buildBeta1QuoteCards({
      requesterUserId: user?.uid ?? 'preview',
      requestMode,
      pickupStation: toStationInfo(fallbackPickup),
      deliveryStation: toStationInfo(fallbackDelivery),
      packageDescription: packageDescription || '물품 설명',
      packageSize,
      weightKg: Math.max(0.1, Number(weightKg || 0)),
      itemValue: Number(itemValue || 0),
      recipientName: recipientName || '수령인',
      recipientPhone: recipientPhone || '010-0000-0000',
      urgency: requestMode === 'reservation' ? 'normal' : urgency,
      selectedQuoteType,
      directParticipationMode: directMode,
      preferredPickupTime,
      preferredArrivalTime,
    });
  }, [
    deliveryStation,
    directMode,
    itemValue,
    packageDescription,
    packageSize,
    pickupStation,
    preferredArrivalTime,
    preferredPickupTime,
    recipientName,
    recipientPhone,
    requestMode,
    selectedQuoteType,
    stations,
    urgency,
    user?.uid,
    weightKg,
  ]);

  const submitDisabled =
    !pickupStation ||
    !deliveryStation ||
    !packageDescription.trim() ||
    !recipientName.trim() ||
    !recipientPhone.trim() ||
    (requestMode === 'reservation' && !preferredPickupTime.trim());

  async function handleSubmit() {
    if (submitDisabled || !pickupStation || !deliveryStation) {
      Alert.alert('입력 확인', '출발역, 도착역, 물품 정보, 수령인 정보를 확인해 주세요.');
      return;
    }

    if (pickupStation.stationId === deliveryStation.stationId) {
      Alert.alert('역 선택 확인', '출발역과 도착역은 서로 다르게 선택해 주세요.');
      return;
    }

    setSaving(true);
    try {
      const requesterUserId = user?.uid ?? requireUserId();
      const result = await createBeta1Request({
        requesterUserId,
        requestMode,
        sourceRequestId: params?.sourceRequestId,
        pickupStation: toStationInfo(pickupStation),
        deliveryStation: toStationInfo(deliveryStation),
        packageDescription,
        packageSize,
        weightKg: Math.max(0.1, Number(weightKg || 0)),
        itemValue: Number(itemValue || 0),
        recipientName,
        recipientPhone,
        urgency: requestMode === 'reservation' ? 'normal' : urgency,
        selectedQuoteType,
        directParticipationMode: directMode,
        preferredPickupTime:
          requestMode === 'reservation' ? preferredPickupTime : preferredPickupTime || '지금 바로',
        preferredArrivalTime: preferredArrivalTime || undefined,
      });

      const selectedQuoteCard =
        result.quoteCards.find((card) => card.quoteType === selectedQuoteType) ?? result.quoteCards[0];

      navigation.replace('RequestConfirmation', {
        requestId: result.requestId,
        pickupStationName: pickupStation.stationName,
        deliveryStationName: deliveryStation.stationName,
        deliveryFee: selectedQuoteCard
          ? {
              totalFee: Number(selectedQuoteCard.pricing.publicPrice),
              estimatedTime: parseEtaMinutes(selectedQuoteCard.etaLabel),
            }
          : undefined,
      });
    } catch (error) {
      console.error('Failed to create request', error);
      const isAuthError =
        error instanceof Error && /login|auth|로그인|세션|인증/i.test(error.message);

      Alert.alert(
        '요청 생성 실패',
        isAuthError
          ? '로그인 상태를 다시 확인한 뒤 요청을 생성해 주세요.'
          : '요청을 만드는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (loadingStations) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>요청 화면을 준비하고 있습니다.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppTopBar
        title={requestMode === 'reservation' ? '예약 요청' : '배송 요청'}
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroKicker}>가는길에</Text>
          <Text style={styles.heroTitle}>
            {requestMode === 'reservation' ? '예약 배송을 준비합니다.' : '배송 요청을 시작합니다.'}
          </Text>
          <Text style={styles.heroSubtitle}>
            {requestMode === 'reservation'
              ? '시간과 구간만 정하면 됩니다.'
              : '출발역과 도착역을 먼저 선택해 주세요.'}
          </Text>
        </View>

        <SectionCard title="요청 방식">
          <View style={styles.segmentRow}>
            <SegmentButton
              label="지금 바로"
              active={requestMode === 'immediate'}
              onPress={() => setRequestMode('immediate')}
            />
            <SegmentButton
              label="예약하기"
              active={requestMode === 'reservation'}
              onPress={() => setRequestMode('reservation')}
            />
          </View>
        </SectionCard>

        <SectionCard title="이동 구간">
          <StationButton
            label="출발역"
            value={pickupStation ? pickupStation.stationName : '출발역 선택'}
            onPress={() => {
              setPickerType('pickup');
              setPickerVisible(true);
            }}
          />
          <StationButton
            label="도착역"
            value={deliveryStation ? deliveryStation.stationName : '도착역 선택'}
            onPress={() => {
              setPickerType('delivery');
              setPickerVisible(true);
            }}
          />
        </SectionCard>

        <SectionCard title="물품 정보">
          <TextInput
            style={styles.textInput}
            value={packageDescription}
            onChangeText={setPackageDescription}
            placeholder="예: 서류 봉투, 작은 박스, 노트북 가방"
            placeholderTextColor={Colors.gray400}
          />
          <View style={styles.segmentRow}>
            {(['small', 'medium', 'large'] as const).map((size) => (
              <SegmentButton
                key={size}
                label={size}
                active={packageSize === size}
                onPress={() => setPackageSize(size)}
              />
            ))}
          </View>
          <TextInput
            style={styles.textInput}
            value={weightKg}
            onChangeText={setWeightKg}
            keyboardType="decimal-pad"
            placeholder="무게(kg)"
            placeholderTextColor={Colors.gray400}
          />
          <TextInput
            style={styles.textInput}
            value={itemValue}
            onChangeText={setItemValue}
            keyboardType="number-pad"
            placeholder="물품 가액(선택)"
            placeholderTextColor={Colors.gray400}
          />
        </SectionCard>

        <SectionCard title="시간과 참여 방식">
          {requestMode === 'reservation' ? (
            <>
              <TextInput
                style={styles.textInput}
                value={preferredPickupTime}
                onChangeText={setPreferredPickupTime}
                placeholder="예: 오늘 19:30"
                placeholderTextColor={Colors.gray400}
              />
              <TextInput
                style={styles.textInput}
                value={preferredArrivalTime}
                onChangeText={setPreferredArrivalTime}
                placeholder="도착 희망 시간(선택)"
                placeholderTextColor={Colors.gray400}
              />
            </>
          ) : (
            <View style={styles.segmentRow}>
              {(['normal', 'fast', 'urgent'] as const).map((level) => (
                <SegmentButton
                  key={level}
                  label={level}
                  active={urgency === level}
                  onPress={() => setUrgency(level)}
                />
              ))}
            </View>
          )}

          <View style={styles.segmentColumn}>
            <SegmentButton
              label="전부 맡기기"
              active={directMode === 'none'}
              onPress={() => setDirectMode('none')}
            />
            <SegmentButton
              label="출발역까지 직접 전달"
              active={directMode === 'requester_to_station'}
              onPress={() => setDirectMode('requester_to_station')}
            />
            <SegmentButton
              label="사물함 포함"
              active={directMode === 'locker_assisted'}
              onPress={() => setDirectMode('locker_assisted')}
            />
          </View>
        </SectionCard>

        <SectionCard title="수령인 정보">
          <TextInput
            style={styles.textInput}
            value={recipientName}
            onChangeText={setRecipientName}
            placeholder="수령인 이름"
            placeholderTextColor={Colors.gray400}
          />
          <TextInput
            style={styles.textInput}
            value={recipientPhone}
            onChangeText={setRecipientPhone}
            keyboardType="phone-pad"
            placeholder="수령인 연락처"
            placeholderTextColor={Colors.gray400}
          />
        </SectionCard>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderTitle}>가격 선택</Text>
        </View>

        {quoteCards.map((card) => (
          <TouchableOpacity
            key={card.quoteType}
            style={[styles.quoteCard, selectedQuoteType === card.quoteType && styles.quoteCardSelected]}
            onPress={() => setSelectedQuoteType(card.quoteType)}
            activeOpacity={0.92}
          >
            <View style={styles.quoteHeader}>
              <View style={styles.quoteHeaderText}>
                <Text style={styles.quoteLabel}>{card.label}</Text>
                <Text style={styles.quoteHeadline}>{card.headline}</Text>
              </View>
              <View style={styles.quotePriceWrap}>
                <Text style={styles.quotePrice}>{card.priceLabel}</Text>
                <Text style={styles.quoteEta}>{card.etaLabel}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.submitButton, submitDisabled && styles.submitButtonDisabled]}
          onPress={() => void handleSubmit()}
          disabled={submitDisabled || saving}
          activeOpacity={0.9}
        >
          {saving ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.submitButtonText}>요청 생성</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <OptimizedStationSelectModal
        visible={pickerVisible}
        stations={stations}
        onClose={() => setPickerVisible(false)}
        onSelectStation={(station: Station) => {
          if (pickerType === 'pickup') {
            setPickupStation(station);
          } else {
            setDeliveryStation(station);
          }
          setPickerVisible(false);
        }}
        title={pickerType === 'pickup' ? '출발역 선택' : '도착역 선택'}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.md },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: Spacing.md,
    color: Colors.textSecondary,
    ...Typography.body,
  },
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: 8,
    ...Shadows.sm,
  },
  heroKicker: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize['2xl'],
    fontWeight: '800',
  },
  heroSubtitle: {
    color: Colors.textSecondary,
    ...Typography.body,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
  },
  sectionHeader: {
    paddingTop: 4,
  },
  sectionHeaderTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  segmentColumn: {
    gap: 8,
  },
  segmentButton: {
    minHeight: 44,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.gray50,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  segmentButtonText: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  segmentButtonTextActive: {
    color: Colors.white,
  },
  stationButton: {
    minHeight: 58,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
    gap: 4,
  },
  stationLabel: {
    color: Colors.textSecondary,
    ...Typography.caption,
  },
  stationValue: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  textInput: {
    minHeight: 52,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    color: Colors.textPrimary,
  },
  quoteCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  quoteCardSelected: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  quoteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  quoteHeaderText: {
    flex: 1,
    gap: 6,
  },
  quoteLabel: {
    color: Colors.primary,
    fontWeight: '800',
  },
  quoteHeadline: {
    color: Colors.textPrimary,
    ...Typography.bodySmall,
  },
  quotePriceWrap: {
    alignItems: 'flex-end',
    gap: 4,
  },
  quotePrice: {
    color: Colors.textPrimary,
    fontWeight: '800',
  },
  quoteEta: {
    color: Colors.textSecondary,
    ...Typography.caption,
  },
  submitButton: {
    minHeight: 54,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
});
