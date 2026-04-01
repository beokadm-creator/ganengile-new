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
import { MaterialIcons } from '@expo/vector-icons';
import AppTopBar from '../../components/common/AppTopBar';
import { OptimizedStationSelectModal } from '../../components/OptimizedStationSelectModal';
import {
  buildBeta1QuoteCards,
  createBeta1Request,
  type Beta1QuoteCard,
} from '../../services/beta1-orchestration-service';
import { getAllStations } from '../../services/config-service';
import { requireUserId } from '../../services/firebase';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';
import type { Station } from '../../types/config';
import type { MainStackParamList, MainStackNavigationProp } from '../../types/navigation';
import type { StationInfo } from '../../types/request';

type RequestPackageSize = 'small' | 'medium' | 'large' | 'xl';

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
  const location = station.location as { lat?: number; lng?: number; latitude?: number; longitude?: number } | undefined;

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

export default function CreateRequestScreen({ navigation, route }: Props) {
  const params = route?.params;
  const prefill = params?.prefill;
  const isReservationFlow = params?.mode === 'reservation';

  const [stations, setStations] = useState<Station[]>([]);
  const [loadingStations, setLoadingStations] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerType, setPickerType] = useState<'pickup' | 'delivery'>('pickup');

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
  const [urgency, setUrgency] = useState<'normal' | 'fast' | 'urgent'>(prefill?.urgency ?? (isReservationFlow ? 'normal' : 'fast'));
  const [requestMode, setRequestMode] = useState<'immediate' | 'reservation'>(isReservationFlow ? 'reservation' : 'immediate');
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
    const fallbackPickup =
      pickupStation ??
      (stations[0] ?? {
        stationId: 'preview-pickup',
        stationName: '출발역',
        lines: [{ lineCode: '1', lineName: '1호선' }],
        location: { lat: 37.5665, lng: 126.978 },
      });

    const fallbackDelivery =
      deliveryStation ??
      (stations[1] ?? {
        stationId: 'preview-delivery',
        stationName: '도착역',
        lines: [{ lineCode: '2', lineName: '2호선' }],
        location: { lat: 37.57, lng: 126.99 },
      });

    return buildBeta1QuoteCards({
      requesterUserId: 'preview',
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
      Alert.alert('입력 확인', '출발지, 도착지, 물품 설명, 수령인 정보와 예약 시간을 먼저 입력해 주세요.');
      return;
    }

    setSaving(true);
    try {
      const requesterUserId = requireUserId();
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
        preferredPickupTime: requestMode === 'reservation' ? preferredPickupTime : preferredPickupTime || '지금 바로',
        preferredArrivalTime: preferredArrivalTime || undefined,
      });

      const selectedQuoteCard = Array.isArray(result.quoteCards) ? result.quoteCards[0] : undefined;
      const deliveryFee =
        selectedQuoteCard && typeof selectedQuoteCard.pricing?.publicPrice === 'number'
          ? {
              totalFee: Number(selectedQuoteCard.pricing.publicPrice),
              estimatedTime: parseEtaMinutes(selectedQuoteCard.etaLabel),
            }
          : undefined;

      navigation.replace('RequestConfirmation', {
        requestId: result.requestId,
        pickupStationName: pickupStation?.stationName,
        deliveryStationName: deliveryStation?.stationName,
        deliveryFee,
      });
    } catch (error) {
      console.error('Failed to create request', error);
      Alert.alert('요청 생성 실패', '요청을 준비하는 중 문제가 발생했습니다.');
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
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppTopBar title={requestMode === 'reservation' ? '예약 요청' : '배송 요청'} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroKicker}>가는길에</Text>
          <Text style={styles.heroTitle}>
            {requestMode === 'reservation'
              ? '예약 요청을 만듭니다.'
              : '배송 요청을 만듭니다.'}
          </Text>
          <Text style={styles.heroSubtitle}>
            {requestMode === 'reservation'
              ? '시간만 정하면 됩니다.'
              : '출발역과 도착역을 선택해 주세요.'}
          </Text>
        </View>

        <SectionCard title="1. 요청 모드">
          <View style={styles.segmentRow}>
            <SegmentButton label="지금 바로" active={requestMode === 'immediate'} onPress={() => setRequestMode('immediate')} />
            <SegmentButton label="예약하기" active={requestMode === 'reservation'} onPress={() => setRequestMode('reservation')} />
          </View>
        </SectionCard>

        <SectionCard title="2. 이동 구간">
          <StationButton
            label="출발지"
            value={pickupStation ? pickupStation.stationName : '출발역 선택'}
            onPress={() => {
              setPickerType('pickup');
              setPickerVisible(true);
            }}
          />
          <StationButton
            label="도착지"
            value={deliveryStation ? deliveryStation.stationName : '도착역 선택'}
            onPress={() => {
              setPickerType('delivery');
              setPickerVisible(true);
            }}
          />
        </SectionCard>

        <SectionCard title="3. 물품 정보">
          <TextInput
            style={styles.textInput}
            value={packageDescription}
            onChangeText={setPackageDescription}
            placeholder="예: 노트북 파우치, 서류 봉투, 작은 박스"
            placeholderTextColor={Colors.gray400}
          />
          <View style={styles.segmentRow}>
            {(['small', 'medium', 'large'] as const).map((size) => (
              <SegmentButton key={size} label={size} active={packageSize === size} onPress={() => setPackageSize(size)} />
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

        <SectionCard title="4. 시간과 참여 방식">
          {requestMode === 'reservation' ? (
            <>
              <TextInput
                style={styles.textInput}
                value={preferredPickupTime}
                onChangeText={setPreferredPickupTime}
                placeholder="희망 출발 시간 예: 오늘 19:30"
                placeholderTextColor={Colors.gray400}
              />
              <TextInput
                style={styles.textInput}
                value={preferredArrivalTime}
                onChangeText={setPreferredArrivalTime}
                placeholder="희망 도착 시간(선택)"
                placeholderTextColor={Colors.gray400}
              />
            </>
          ) : (
            <View style={styles.segmentRow}>
              {(['normal', 'fast', 'urgent'] as const).map((level) => (
                <SegmentButton key={level} label={level} active={urgency === level} onPress={() => setUrgency(level)} />
              ))}
            </View>
          )}

          <View style={styles.segmentColumn}>
            <SegmentButton label="전체 맡기기" active={directMode === 'none'} onPress={() => setDirectMode('none')} />
            <SegmentButton
              label="출발역까지 직접 전달"
              active={directMode === 'requester_to_station'}
              onPress={() => setDirectMode('requester_to_station')}
            />
            <SegmentButton
              label="사물함 포함 우선"
              active={directMode === 'locker_assisted'}
              onPress={() => setDirectMode('locker_assisted')}
            />
          </View>
        </SectionCard>

        <SectionCard title="5. 수령인 정보">
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
          <Text style={styles.sectionHeaderTitle}>6. AI 가격 카드</Text>
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
              {selectedQuoteType === card.quoteType ? (
                <View style={styles.quoteBadge}>
                  <Text style={styles.quoteBadgeText}>선택됨</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.quoteMetaRow}>
              <Text style={styles.quotePrice}>{card.priceLabel}</Text>
              <Text style={styles.quoteEta}>{card.etaLabel}</Text>
            </View>
            <Text style={styles.quoteReason}>{card.recommendationReason}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.submitButton, submitDisabled && styles.submitButtonDisabled]}
          onPress={() => {
            void handleSubmit();
          }}
          disabled={submitDisabled || saving}
        >
          {saving ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.submitButtonText}>
              {requestMode === 'reservation' ? '예약 요청 확정' : '요청 확정'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <OptimizedStationSelectModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        stations={stations}
        onSelectStation={(station) => {
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

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function StationButton({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.stationButton} onPress={onPress}>
      <Text style={styles.stationLabel}>{label}</Text>
      <View style={styles.stationValueRow}>
        <Text style={styles.stationValue}>{value}</Text>
        <MaterialIcons name="chevron-right" size={24} color={Colors.gray400} />
      </View>
    </TouchableOpacity>
  );
}

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.segmentButton, active && styles.segmentButtonActive]} onPress={onPress}>
      <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.background,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: 48,
  },
  heroCard: {
    backgroundColor: Colors.primaryMint,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  heroKicker: {
    color: Colors.primary,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize['2xl'],
    fontWeight: '800',
    lineHeight: 32,
  },
  heroSubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 22,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
  },
  sectionBody: {
    gap: Spacing.sm,
  },
  helperText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 21,
  },
  stationButton: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 6,
  },
  stationLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  stationValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  stationValue: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: '700',
  },
  textInput: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  segmentColumn: {
    gap: Spacing.sm,
  },
  segmentButton: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.gray300,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
  },
  segmentButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryMint,
  },
  segmentButtonText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  segmentButtonTextActive: {
    color: Colors.primary,
    fontWeight: Typography.fontWeight.bold,
  },
  sectionHeader: {
    gap: 4,
    marginTop: Spacing.sm,
  },
  sectionHeaderTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    fontWeight: '800',
  },
  sectionHeaderText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 21,
  },
  quoteCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  quoteCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryMint,
  },
  quoteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  quoteHeaderText: {
    flex: 1,
    gap: 4,
  },
  quoteLabel: {
    color: Colors.primary,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    textTransform: 'uppercase',
  },
  quoteHeadline: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: '800',
    lineHeight: 22,
  },
  quoteBadge: {
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  quoteBadgeText: {
    color: Colors.white,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  quoteMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.md,
  },
  quotePrice: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    fontWeight: '800',
  },
  quoteEta: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
  },
  quoteReason: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 21,
  },
  submitButton: {
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    marginTop: Spacing.md,
  },
  submitButtonDisabled: {
    opacity: 0.45,
  },
  submitButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
  },
});



