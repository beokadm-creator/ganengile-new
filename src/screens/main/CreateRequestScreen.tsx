import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AppTopBar from '../../components/common/AppTopBar';
import AddressSearchModal from '../../components/common/AddressSearchModal';
import DatePickerModal from '../../components/common/DatePickerModal';
import NearbyStationRecommendationsModal, {
  type NearbyStationRecommendation,
} from '../../components/common/NearbyStationRecommendationsModal';
import TimePicker from '../../components/common/TimePicker';
import { OptimizedStationSelectModal } from '../../components/OptimizedStationSelectModal';
import { useUser } from '../../contexts/UserContext';
import {
  analyzeRequestDraftWithAI,
  generatePricingQuotesForBeta1Input,
  type Beta1AIAnalysisResponse,
  type Beta1AIQuoteResponse,
} from '../../services/beta1-ai-service';
import { geocodeRoadAddress } from '../../services/address-geocode-service';
import {
  buildBeta1BasePricing,
  buildBeta1QuoteCards,
  applyAIQuoteResponseToCards,
  createBeta1Request,
  type Beta1QuoteCard,
} from '../../services/beta1-orchestration-service';
import {
  getAllStations,
  getRecipientContactPrivacyConfig,
  type RecipientContactPrivacyConfig,
} from '../../services/config-service';
import { requireUserId } from '../../services/firebase';
import { locationService } from '../../services/location-service';
import { confirmPhoneOtp, requestPhoneOtp } from '../../services/otp-service';
import { pickPhotoFromLibrary, takePhoto, uploadPhotoWithThumbnail } from '../../services/photo-service';
import { getPricingPolicyConfig } from '../../services/pricing-policy-config-service';
import { resolvePricingContextForRequest } from '../../services/pricing-context-service';
import { getRoutePricingOverrideByStations } from '../../services/route-pricing-override-service';
import { addRecentAddress, getRecentAddresses, getSavedAddresses } from '../../services/profile-service';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';
import type { Station } from '../../types/config';
import type { MainStackNavigationProp, MainStackParamList } from '../../types/navigation';
import type { SavedAddress } from '../../types/profile';
import type { StationInfo } from '../../types/request';
import {
  deleteCreateRequestProgress,
  loadCreateRequestProgress,
  saveCreateRequestProgress,
  type CreateRequestDraft,
} from '../../utils/draft-storage';
import type { SharedPricingPolicyConfig } from '../../../shared/pricing-policy';
import type { RequestPricingContext } from '../../types/request';

type LocationMode = 'station' | 'address';
type PackageSize = 'small' | 'medium' | 'large' | 'xl';
type PickerType = 'pickup' | 'delivery';
type AddressTarget = 'pickup' | 'delivery' | null;
type StationCandidate = {
  station: Station;
  name: string;
  line: string;
  latitude: number;
  longitude: number;
};
type NearbyPickerState = {
  target: PickerType;
  title: string;
  description: string;
  recommendations: NearbyStationRecommendation[];
};
type Props = {
  navigation: MainStackNavigationProp;
  route?: { params?: MainStackParamList['CreateRequest'] };
};

function parseEtaMinutes(label: string): number {
  const matched = label.match(/(\d+)/);
  return matched ? Number(matched[1]) : 0;
}

const CLEAN_SIZE_OPTIONS: Array<{ value: PackageSize; label: string }> = [
  { value: 'small', label: '소형' },
  { value: 'medium', label: '중형' },
  { value: 'large', label: '대형' },
  { value: 'xl', label: '특대형' },
];

const FALLBACK_RECIPIENT_PRIVACY_CONFIG: RecipientContactPrivacyConfig = {
  safeNumberEnabled: true,
  providerName: '관리자 설정 예정',
  policyTitle: '수령인 개인정보 제공 동의',
  policyEffectiveDate: '2026-04-03',
  thirdPartyConsentRequired: true,
  guidance:
    '수령인 연락처는 안심번호로 전환되어 전달되며, 실제 번호는 관리자 설정 API를 통해 안전하게 관리됩니다.',
};

function normalizePhoneNumber(phoneNumber: string): string {
  return phoneNumber.replace(/\D/g, '');
}

function formatPhoneDigits(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function splitReservationSchedule(value?: string) {
  const trimmed = (value ?? '').trim();
  const matched = trimmed.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})$/);
  if (!matched) {
    return { date: '', time: trimmed };
  }

  return { date: matched[1], time: matched[2] };
}

function combineReservationSchedule(date: string, time: string) {
  const trimmedDate = date.trim();
  const trimmedTime = time.trim();

  if (!trimmedDate && !trimmedTime) return '';
  if (!trimmedDate) return trimmedTime;
  if (!trimmedTime) return trimmedDate;
  return `${trimmedDate} ${trimmedTime}`;
}

function normalizeAISize(size?: string): PackageSize | null {
  return size === 'small' || size === 'medium' || size === 'large' || size === 'xl' ? size : null;
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

function getStationCoordinates(station: Station) {
  const location = station.location as
    | { lat?: number; lng?: number; latitude?: number; longitude?: number }
    | undefined;

  return {
    latitude: location?.latitude ?? location?.lat ?? null,
    longitude: location?.longitude ?? location?.lng ?? null,
  };
}

function hasUsableCoordinates(latitude: number | null, longitude: number | null) {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude !== 0 &&
    longitude !== 0
  );
}

function getStationCandidates(stations: Station[]): StationCandidate[] {
  return stations
    .filter((station) => {
      const { latitude, longitude } = getStationCoordinates(station);
      return hasUsableCoordinates(latitude, longitude);
    })
    .map((station) => {
      const { latitude, longitude } = getStationCoordinates(station);
      return {
        station,
        name: station.stationName,
        line: station.lines[0]?.lineName ?? '',
        latitude: latitude ?? 0,
        longitude: longitude ?? 0,
      };
    });
}

function toLocationRef(mode: LocationMode, station: StationInfo, addressText: string) {
  return {
    type: mode,
    stationId: station.stationId,
    stationName: station.stationName,
    addressText: mode === 'address' ? addressText : undefined,
    latitude: station.lat,
    longitude: station.lng,
  } as const;
}

function formatDetailedAddress(roadAddress: string, detailAddress: string) {
  const road = roadAddress.trim();
  const detail = detailAddress.trim();
  if (!road) return '';
  return detail ? `${road} ${detail}` : road;
}

function hasDraftableContent(input: {
  pickupStation: Station | null;
  deliveryStation: Station | null;
  pickupRoadAddress: string;
  pickupDetailAddress: string;
  deliveryRoadAddress: string;
  deliveryDetailAddress: string;
  photoRefs: string[];
  packageItemName: string;
  packageDescription: string;
  recipientName: string;
  recipientPhone: string;
  pickupLocationDetail: string;
  storageLocation: string;
  specialInstructions: string;
  itemValue: string;
  preferredPickupDate: string;
  preferredPickupTime: string;
}) {
  return Boolean(
    input.pickupStation ||
      input.deliveryStation ||
      input.pickupRoadAddress.trim() ||
      input.pickupDetailAddress.trim() ||
      input.deliveryRoadAddress.trim() ||
      input.deliveryDetailAddress.trim() ||
      input.photoRefs.length > 0 ||
      input.packageItemName.trim() ||
      input.packageDescription.trim() ||
      input.recipientName.trim() ||
      input.recipientPhone.trim() ||
      input.pickupLocationDetail.trim() ||
      input.storageLocation.trim() ||
      input.specialInstructions.trim() ||
      input.itemValue.trim() ||
      input.preferredPickupDate.trim() ||
      input.preferredPickupTime.trim()
  );
}

function fromPrefillStation(station?: StationInfo): Station | null {
  if (!station) return null;
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
    location: { latitude: station.lat, longitude: station.lng },
    facilities: { hasElevator: false, hasEscalator: false, wheelchairAccessible: false },
    isActive: true,
    region: '수도권',
    priority: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function fromDraftStation(station?: CreateRequestDraft['pickupStation']): Station | null {
  if (!station) return null;
  return fromPrefillStation({
    id: station.stationId,
    stationId: station.stationId,
    stationName: station.stationName,
    line: station.line ?? '',
    lineCode: station.lineCode ?? '',
    lat: station.lat,
    lng: station.lng,
  });
}

function fallbackStation(kind: PickerType): Station {
  const isPickup = kind === 'pickup';
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
    location: { latitude: isPickup ? 37.5665 : 37.5704, longitude: isPickup ? 126.978 : 126.991 },
    facilities: { hasElevator: false, hasEscalator: false, wheelchairAccessible: false },
    isActive: true,
    region: '수도권',
    priority: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function CreateRequestScreen({ navigation, route }: Props) {
  const { user, refreshUser } = useUser();
  const params = route?.params;
  const prefill = params?.prefill;
  const prefilledReservation = splitReservationSchedule(prefill?.preferredPickupTime);

  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerType, setPickerType] = useState<PickerType>('pickup');
  const [nearbyPicker, setNearbyPicker] = useState<NearbyPickerState | null>(null);
  const [addressTarget, setAddressTarget] = useState<AddressTarget>(null);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [resolvingLocation, setResolvingLocation] = useState<PickerType | null>(null);
  const [resolvingAddressStation, setResolvingAddressStation] = useState<PickerType | null>(null);

  const [pickupMode, setPickupMode] = useState<LocationMode>(prefill?.pickupMode ?? 'station');
  const [deliveryMode, setDeliveryMode] = useState<LocationMode>(prefill?.deliveryMode ?? 'station');
  const [pickupStation, setPickupStation] = useState<Station | null>(() => fromPrefillStation(prefill?.pickupStation));
  const [deliveryStation, setDeliveryStation] = useState<Station | null>(() => fromPrefillStation(prefill?.deliveryStation));
  const [pickupRoadAddress, setPickupRoadAddress] = useState(prefill?.pickupRoadAddress ?? '');
  const [pickupDetailAddress, setPickupDetailAddress] = useState(prefill?.pickupDetailAddress ?? '');
  const [deliveryRoadAddress, setDeliveryRoadAddress] = useState(prefill?.deliveryRoadAddress ?? '');
  const [deliveryDetailAddress, setDeliveryDetailAddress] = useState(prefill?.deliveryDetailAddress ?? '');
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [recentAddresses, setRecentAddresses] = useState<SavedAddress[]>([]);

  const [photoUrl, setPhotoUrl] = useState<string | null>(prefill?.photoRefs?.[0] ?? null);
  const [photoRefs, setPhotoRefs] = useState<string[]>(prefill?.photoRefs ?? []);
  const [aiResult, setAiResult] = useState<Beta1AIAnalysisResponse | null>(null);
  const [aiQuoteResponse, setAiQuoteResponse] = useState<Beta1AIQuoteResponse | null>(null);
  const [aiQuotesLoading, setAiQuotesLoading] = useState(false);

  const [requestMode, setRequestMode] = useState<'immediate' | 'reservation'>(
    params?.mode === 'reservation' ? 'reservation' : 'immediate'
  );
  const [packageItemName, setPackageItemName] = useState('');
  const [packageCategory, _setPackageCategory] = useState('');
  const [packageDescription, setPackageDescription] = useState(prefill?.packageDescription ?? '');
  const [packageSize, setPackageSize] = useState<PackageSize>(prefill?.packageSize ?? 'small');
  const [weightKg, setWeightKg] = useState(String(prefill?.weightKg ?? 1));
  const [itemValue, setItemValue] = useState(prefill?.itemValue ? String(prefill.itemValue) : '');
  const [recipientName, setRecipientName] = useState(prefill?.recipientName ?? '');
  const [recipientPhone, setRecipientPhone] = useState(prefill?.recipientPhone ?? '');
  const [pickupLocationDetail, setPickupLocationDetail] = useState(prefill?.pickupLocationDetail ?? '');
  const [storageLocation, setStorageLocation] = useState(prefill?.storageLocation ?? '');
  const [specialInstructions, setSpecialInstructions] = useState(prefill?.specialInstructions ?? '');
  const [directMode, setDirectMode] = useState<'none' | 'requester_to_station' | 'locker_assisted'>(
    prefill?.directParticipationMode ?? 'none'
  );
  const [urgency, setUrgency] = useState<'normal' | 'fast' | 'urgent'>(prefill?.urgency ?? 'fast');
  const [preferredPickupDate, setPreferredPickupDate] = useState(prefilledReservation.date);
  const [preferredPickupTime, setPreferredPickupTime] = useState(prefilledReservation.time);
  const [preferredArrivalTime, _setPreferredArrivalTime] = useState(prefill?.preferredArrivalTime ?? '');
  const [reservationCalendarVisible, setReservationCalendarVisible] = useState(false);
  const [selectedQuoteType, setSelectedQuoteType] = useState<Beta1QuoteCard['quoteType']>('balanced');
  const [contactPhoneNumber, setContactPhoneNumber] = useState(
    formatPhoneDigits(user?.phoneVerification?.phoneNumber ?? user?.phoneNumber ?? '')
  );
  const [contactOtpSessionId, setContactOtpSessionId] = useState<string | null>(null);
  const [contactOtpCode, setContactOtpCode] = useState('');
  const [contactOtpHintCode, setContactOtpHintCode] = useState<string | null>(null);
  const [contactOtpDestination, setContactOtpDestination] = useState('');
  const [contactOtpExpiresAt, setContactOtpExpiresAt] = useState<string | null>(null);
  const [contactOtpSending, setContactOtpSending] = useState(false);
  const [contactOtpVerifying, setContactOtpVerifying] = useState(false);
  const [verifiedPhoneOverride, setVerifiedPhoneOverride] = useState<string | null>(null);
  const [recipientPrivacyConfig, setRecipientPrivacyConfig] = useState<RecipientContactPrivacyConfig>(
    FALLBACK_RECIPIENT_PRIVACY_CONFIG
  );
  const [recipientConsentChecked, setRecipientConsentChecked] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const draftHydratedRef = useRef(false);
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const depositPhotoNoticeShownRef = useRef(false);
  const quoteSelectionTouchedRef = useRef(false);
  const aiQuoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiQuoteRequestIdRef = useRef(0);

  useEffect(() => {
    const run = async () => {
      try {
        const list = await getAllStations();
        setStations(list);
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        const config = await getRecipientContactPrivacyConfig();
        setRecipientPrivacyConfig(config);
        setRecipientConsentChecked(config.thirdPartyConsentRequired === false);
      } catch (error) {
        console.error('Failed to load recipient privacy config', error);
      }
    };

    void run();
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!user?.uid) return;
      try {
        const [saved, recent] = await Promise.all([
          getSavedAddresses(user.uid),
          getRecentAddresses(user.uid),
        ]);
        setSavedAddresses(saved);
        setRecentAddresses(recent);
      } catch (error) {
        console.error('Failed to load address options', error);
      }
    };
    void run();
  }, [user?.uid]);

  useEffect(() => {
    setContactPhoneNumber(formatPhoneDigits(user?.phoneVerification?.phoneNumber ?? user?.phoneNumber ?? ''));
  }, [user?.phoneNumber, user?.phoneVerification?.phoneNumber]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (prefill || params?.sourceRequestId) {
        draftHydratedRef.current = true;
        return;
      }

      const draft = await loadCreateRequestProgress();
      if (!mounted) return;

      if (draft) {
        setRequestMode(draft.requestMode);
        setPickupMode(draft.pickupMode);
        setDeliveryMode(draft.deliveryMode);
        setPickupStation(fromDraftStation(draft.pickupStation));
        setDeliveryStation(fromDraftStation(draft.deliveryStation));
        setPickupRoadAddress(draft.pickupRoadAddress);
        setPickupDetailAddress(draft.pickupDetailAddress);
        setDeliveryRoadAddress(draft.deliveryRoadAddress);
        setDeliveryDetailAddress(draft.deliveryDetailAddress);
        setPhotoUrl(draft.photoUrl);
        setPhotoRefs(draft.photoRefs);
        setPackageItemName(draft.packageItemName);
        _setPackageCategory(draft.packageCategory);
        setPackageDescription(draft.packageDescription);
        setPackageSize(draft.packageSize);
        setWeightKg(draft.weightKg);
        setItemValue(draft.itemValue);
        setRecipientName(draft.recipientName);
        setRecipientPhone(draft.recipientPhone);
        setPickupLocationDetail(draft.pickupLocationDetail);
        setStorageLocation(draft.storageLocation);
        setSpecialInstructions(draft.specialInstructions);
        setDirectMode(draft.directMode);
        setUrgency(draft.urgency);
        setPreferredPickupDate(draft.preferredPickupDate);
        setPreferredPickupTime(draft.preferredPickupTime);
        _setPreferredArrivalTime(draft.preferredArrivalTime);
        setContactPhoneNumber(draft.contactPhoneNumber);
        setRecipientConsentChecked(draft.recipientConsentChecked);
        setDraftRestored(true);
      }

      draftHydratedRef.current = true;
    };

    void run();

    return () => {
      mounted = false;
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current);
      }
    };
  }, [params?.sourceRequestId, prefill]);

  const normalizedContactPhone = normalizePhoneNumber(contactPhoneNumber);
  const normalizedVerifiedPhone = normalizePhoneNumber(
    verifiedPhoneOverride ?? user?.phoneVerification?.phoneNumber ?? ''
  );
  const hasLockedVerifiedPhone =
    user?.phoneVerification?.verified === true && normalizedVerifiedPhone.length > 0;
  const isOnboardingComplete = user?.hasCompletedOnboarding === true;
  const isPhoneVerified =
    (verifiedPhoneOverride != null || user?.phoneVerification?.verified === true) &&
    normalizedVerifiedPhone.length > 0 &&
    normalizedVerifiedPhone === normalizedContactPhone;
  const desiredArrivalSchedule =
    requestMode === 'reservation'
      ? combineReservationSchedule(preferredPickupDate, preferredPickupTime)
      : preferredArrivalTime;
  const resolvedPreferredPickupTime =
    requestMode === 'reservation'
      ? combineReservationSchedule(preferredPickupDate, preferredPickupTime)
      : preferredPickupTime || 'now';
  const [pricingPolicy, setPricingPolicy] = useState<SharedPricingPolicyConfig | null>(null);
  const [routeOverride, setRouteOverride] = useState<Awaited<ReturnType<typeof getRoutePricingOverrideByStations>>>(null);
  const [pricingContext, setPricingContext] = useState<RequestPricingContext | null>(null);

  useEffect(() => {
    void getPricingPolicyConfig().then(setPricingPolicy).catch((error) => {
      console.error('Failed to load pricing policy config', error);
    });
  }, []);

  useEffect(() => {
    if (!pickupStation?.stationId || !deliveryStation?.stationId) {
      setRouteOverride(null);
      return;
    }

    void getRoutePricingOverrideByStations({
      pickupStationId: pickupStation.stationId,
      deliveryStationId: deliveryStation.stationId,
      requestMode,
    }).then(setRouteOverride).catch((error) => {
      console.error('Failed to load route pricing override', error);
      setRouteOverride(null);
    });
  }, [deliveryStation?.stationId, pickupStation?.stationId, requestMode]);

  const deterministicQuotes = useMemo(() => {
    const origin = pickupStation ?? stations[0] ?? fallbackStation('pickup');
    const destination = deliveryStation ?? stations[1] ?? fallbackStation('delivery');

    return buildBeta1QuoteCards({
      requesterUserId: user?.uid ?? 'preview',
      requestMode,
      originType: pickupMode,
      destinationType: deliveryMode,
      pickupStation: toStationInfo(origin),
      deliveryStation: toStationInfo(destination),
      pickupRoadAddress: pickupRoadAddress || undefined,
      pickupDetailAddress: pickupDetailAddress || undefined,
      deliveryRoadAddress: deliveryRoadAddress || undefined,
      deliveryDetailAddress: deliveryDetailAddress || undefined,
      selectedPhotoIds: photoRefs,
      packageItemName: packageItemName || undefined,
      packageCategory: packageCategory || undefined,
      packageDescription: packageDescription || '물품 설명',
      packageSize,
      weightKg: Math.max(0.1, Number(weightKg || 0)),
      itemValue: Number(itemValue || 0),
      recipientName: recipientName || '수령인',
      recipientPhone: recipientPhone || '010-0000-0000',
      pickupLocationDetail: pickupLocationDetail || undefined,
      storageLocation: storageLocation || undefined,
      specialInstructions: specialInstructions || undefined,
      urgency: requestMode === 'reservation' ? 'normal' : urgency,
      selectedQuoteType: 'balanced',
      directParticipationMode: directMode,
      preferredPickupTime: resolvedPreferredPickupTime,
      preferredArrivalTime: desiredArrivalSchedule,
      pricingContextOverride: pricingContext ?? undefined,
      aiAnalysisOverride: aiResult
        ? {
            provider: aiResult.provider,
            model: aiResult.model,
            confidence: aiResult.confidence,
            fallbackUsed: aiResult.fallbackUsed,
            result: aiResult.result,
          }
        : undefined,
    }, pricingPolicy ?? undefined, routeOverride);
  }, [
    stations,
    user?.uid,
    requestMode,
    pickupMode,
    deliveryMode,
    pickupStation,
    deliveryStation,
    pickupRoadAddress,
    pickupDetailAddress,
    deliveryRoadAddress,
    deliveryDetailAddress,
    photoRefs,
    packageItemName,
    packageCategory,
    packageDescription,
    packageSize,
    weightKg,
    itemValue,
    recipientName,
    recipientPhone,
    pickupLocationDetail,
    storageLocation,
    specialInstructions,
    urgency,
    directMode,
    resolvedPreferredPickupTime,
    desiredArrivalSchedule,
    aiResult,
    pricingContext,
    pricingPolicy,
    routeOverride,
  ]);

  const quotes = useMemo(() => {
    if (!aiQuoteResponse) {
      return deterministicQuotes;
    }

    return applyAIQuoteResponseToCards(deterministicQuotes, aiQuoteResponse).quoteCards;
  }, [aiQuoteResponse, deterministicQuotes]);

  useEffect(() => {
    if (!user?.uid || !pricingPolicy || !pickupStation || !deliveryStation) {
      setAiQuoteResponse(null);
      setAiQuotesLoading(false);
      return;
    }

    if (aiQuoteTimerRef.current) {
      clearTimeout(aiQuoteTimerRef.current);
    }

    aiQuoteTimerRef.current = setTimeout(() => {
      const requestId = aiQuoteRequestIdRef.current + 1;
      aiQuoteRequestIdRef.current = requestId;

      const run = async () => {
        try {
          setAiQuotesLoading(true);
          const response = await generatePricingQuotesForBeta1Input({
            requesterUserId: user.uid,
            pickupStation: toStationInfo(pickupStation),
            deliveryStation: toStationInfo(deliveryStation),
            packageDescription: packageDescription || '물품 설명',
            itemValue: Number(itemValue || 0),
            weightKg: Math.max(0.1, Number(weightKg || 0)),
            packageSize,
            requestMode,
            preferredPickupTime: resolvedPreferredPickupTime,
            preferredArrivalTime: desiredArrivalSchedule,
            urgency: requestMode === 'reservation' ? 'normal' : urgency,
            directParticipationMode: directMode,
            basePricing: buildBeta1BasePricing(
              {
                requesterUserId: user.uid,
                requestMode,
                originType: pickupMode,
                destinationType: deliveryMode,
                pickupStation: toStationInfo(pickupStation),
                deliveryStation: toStationInfo(deliveryStation),
                pickupRoadAddress: pickupRoadAddress || undefined,
                pickupDetailAddress: pickupDetailAddress || undefined,
                deliveryRoadAddress: deliveryRoadAddress || undefined,
                deliveryDetailAddress: deliveryDetailAddress || undefined,
                selectedPhotoIds: photoRefs,
                packageItemName: packageItemName || undefined,
                packageCategory: packageCategory || undefined,
                packageDescription: packageDescription || '물품 설명',
                packageSize,
                weightKg: Math.max(0.1, Number(weightKg || 0)),
                itemValue: Number(itemValue || 0),
                recipientName: recipientName || '수령인',
                recipientPhone: recipientPhone || '010-0000-0000',
                pickupLocationDetail: pickupLocationDetail || undefined,
                storageLocation: storageLocation || undefined,
                specialInstructions: specialInstructions || undefined,
                urgency: requestMode === 'reservation' ? 'normal' : urgency,
                selectedQuoteType: 'balanced',
                directParticipationMode: directMode,
                preferredPickupTime: resolvedPreferredPickupTime,
                preferredArrivalTime: desiredArrivalSchedule,
                pricingContextOverride: pricingContext ?? undefined,
              },
              pricingPolicy
            ),
          });

          if (aiQuoteRequestIdRef.current !== requestId) {
            return;
          }

          setAiQuoteResponse(response);

          if (!quoteSelectionTouchedRef.current) {
            const applied = applyAIQuoteResponseToCards(deterministicQuotes, response);
            setSelectedQuoteType(applied.recommendedQuoteType);
          }
        } catch (error) {
          console.error('Failed to generate AI pricing quotes', error);
          if (aiQuoteRequestIdRef.current === requestId) {
            setAiQuoteResponse(null);
          }
        } finally {
          if (aiQuoteRequestIdRef.current === requestId) {
            setAiQuotesLoading(false);
          }
        }
      };

      void run();
    }, 500);

    return () => {
      aiQuoteRequestIdRef.current += 1;
      if (aiQuoteTimerRef.current) {
        clearTimeout(aiQuoteTimerRef.current);
      }
    };
  }, [
    user?.uid,
    pricingPolicy,
    pickupStation,
    deliveryStation,
    packageDescription,
    itemValue,
    weightKg,
    packageSize,
    requestMode,
    resolvedPreferredPickupTime,
    desiredArrivalSchedule,
    urgency,
    directMode,
    pricingContext,
    pickupMode,
    deliveryMode,
    pickupRoadAddress,
    pickupDetailAddress,
    deliveryRoadAddress,
    deliveryDetailAddress,
    photoRefs,
    packageItemName,
    packageCategory,
    recipientName,
    recipientPhone,
    pickupLocationDetail,
    storageLocation,
    specialInstructions,
    deterministicQuotes,
  ]);

  useEffect(() => {
    if (!pickupStation || !deliveryStation) {
      setPricingContext(null);
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const nextContext = await resolvePricingContextForRequest({
          pickupStationName: pickupStation.stationName,
          deliveryStationName: deliveryStation.stationName,
          pickupLat: toStationInfo(pickupStation).lat,
          pickupLng: toStationInfo(pickupStation).lng,
          deliveryLat: toStationInfo(deliveryStation).lat,
          deliveryLng: toStationInfo(deliveryStation).lng,
          preferredPickupTime: resolvedPreferredPickupTime,
          requestMode,
          urgency: requestMode === 'reservation' ? 'normal' : urgency,
        });

        if (!cancelled) {
          setPricingContext(nextContext);
        }
      } catch (error) {
        console.error('Failed to resolve pricing context', error);
        if (!cancelled) {
          setPricingContext(null);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [deliveryStation, pickupStation, requestMode, resolvedPreferredPickupTime, urgency]);

  const hasItemValue = Number(itemValue || 0) > 0;

  useEffect(() => {
    if (hasItemValue && photoRefs.length === 0 && !depositPhotoNoticeShownRef.current) {
      depositPhotoNoticeShownRef.current = true;
      Alert.alert(
        '사진이 필요합니다',
        '물건 가치를 입력하면 보증금 적용을 위해 사진을 올려야 합니다. 지금 촬영하거나 앨범에서 골라주세요.'
      );
    }

    if (!hasItemValue || photoRefs.length > 0) {
      depositPhotoNoticeShownRef.current = false;
    }
  }, [hasItemValue, photoRefs.length]);

  useEffect(() => {
    quoteSelectionTouchedRef.current = false;
  }, [requestMode, pickupStation?.stationId, deliveryStation?.stationId]);

  const submitDisabled =
    !user?.uid ||
    !isOnboardingComplete ||
    !pickupStation ||
    !deliveryStation ||
    (hasItemValue && photoRefs.length === 0) ||
    !packageDescription.trim() ||
    !recipientName.trim() ||
    !recipientPhone.trim() ||
    (pickupMode === 'address' && (!pickupRoadAddress.trim() || !pickupDetailAddress.trim())) ||
    (deliveryMode === 'address' && (!deliveryRoadAddress.trim() || !deliveryDetailAddress.trim())) ||
    !isPhoneVerified ||
    (recipientPrivacyConfig.thirdPartyConsentRequired && !recipientConsentChecked) ||
    (requestMode === 'reservation' && (!preferredPickupDate.trim() || !preferredPickupTime.trim()));

  const missingItems = useMemo(() => {
    const items: string[] = [];
    if (!user?.uid) items.push('로그인이 필요합니다');
    if (!isOnboardingComplete) items.push('이용자 정보 입력(온보딩)이 필요합니다');
    if (!pickupStation) items.push('출발역을 선택해 주세요');
    if (!deliveryStation) items.push('도착역을 선택해 주세요');
    if (hasItemValue && photoRefs.length === 0) items.push('물품 가치를 입력하셨습니다. 보증금 적용을 위해 사진이 필요합니다');
    if (!packageDescription.trim()) items.push('물품 설명을 입력해 주세요');
    if (!recipientName.trim()) items.push('수령인 이름을 입력해 주세요');
    if (!recipientPhone.trim()) items.push('수령인 연락처를 입력해 주세요');
    if (pickupMode === 'address' && (!pickupRoadAddress.trim() || !pickupDetailAddress.trim()))
      items.push('출발지 주소를 완성해 주세요');
    if (deliveryMode === 'address' && (!deliveryRoadAddress.trim() || !deliveryDetailAddress.trim()))
      items.push('도착지 주소를 완성해 주세요');
    if (!isPhoneVerified) items.push('휴대폰 번호 인증을 완료해 주세요');
    if (recipientPrivacyConfig.thirdPartyConsentRequired && !recipientConsentChecked)
      items.push('수령인 정보 제공 동의에 체크해 주세요');
    if (requestMode === 'reservation' && (!preferredPickupDate.trim() || !preferredPickupTime.trim()))
      items.push('예약 날짜와 시간을 선택해 주세요');
    return items;
  }, [
    user?.uid, isOnboardingComplete, pickupStation, deliveryStation,
    photoRefs.length, hasItemValue, packageDescription, recipientName, recipientPhone,
    pickupLocationDetail, storageLocation, specialInstructions,
    pickupMode, pickupRoadAddress, pickupDetailAddress,
    deliveryMode, deliveryRoadAddress, deliveryDetailAddress,
    isPhoneVerified, recipientPrivacyConfig.thirdPartyConsentRequired, recipientConsentChecked,
    requestMode, preferredPickupDate, preferredPickupTime,
  ]);

  function buildDraftPayload(): CreateRequestDraft {
    return {
      step: 1,
      requestMode,
      pickupMode,
      deliveryMode,
      pickupStation: pickupStation ? toStationInfo(pickupStation) : null,
      deliveryStation: deliveryStation ? toStationInfo(deliveryStation) : null,
      pickupRoadAddress,
      pickupDetailAddress,
      deliveryRoadAddress,
      deliveryDetailAddress,
      photoUrl,
      photoRefs,
      packageItemName,
      packageCategory,
      packageDescription,
      packageSize,
      weightKg,
      itemValue,
      recipientName,
      recipientPhone,
      pickupLocationDetail,
      storageLocation,
      specialInstructions,
      urgency,
      directMode,
      preferredPickupDate,
      preferredPickupTime,
      preferredArrivalTime,
      contactPhoneNumber,
      recipientConsentChecked,
    };
  }

  useEffect(() => {
    if (!draftHydratedRef.current || !user?.uid || saving) return;

    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
    }

    draftSaveTimerRef.current = setTimeout(() => {
      if (
        !hasDraftableContent({
          pickupStation,
          deliveryStation,
          pickupRoadAddress,
          pickupDetailAddress,
          deliveryRoadAddress,
          deliveryDetailAddress,
          photoRefs,
          packageItemName,
          packageDescription,
          recipientName,
          recipientPhone,
          pickupLocationDetail,
          storageLocation,
          specialInstructions,
          itemValue,
          preferredPickupDate,
          preferredPickupTime,
        })
      ) {
        void deleteCreateRequestProgress();
        setDraftSaving(false);
        return;
      }

      setDraftSaving(true);
      void saveCreateRequestProgress(buildDraftPayload()).finally(() => setDraftSaving(false));
    }, 500);

    return () => {
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current);
      }
    };
  }, [
    user?.uid,
    saving,
    requestMode,
    pickupMode,
    deliveryMode,
    pickupStation,
    deliveryStation,
    pickupRoadAddress,
    pickupDetailAddress,
    deliveryRoadAddress,
    deliveryDetailAddress,
    photoUrl,
    photoRefs,
    packageItemName,
    packageCategory,
    packageDescription,
    packageSize,
    weightKg,
    itemValue,
    recipientName,
    recipientPhone,
    pickupLocationDetail,
    storageLocation,
    specialInstructions,
    urgency,
    directMode,
    preferredPickupDate,
    preferredPickupTime,
    preferredArrivalTime,
    contactPhoneNumber,
    recipientConsentChecked,
  ]);

  async function handleClearDraft() {
    await deleteCreateRequestProgress();
    setDraftRestored(false);
    Alert.alert('이어쓰기 기록을 지웠습니다', '지금 화면에서 다시 입력한 내용만 남습니다.');
  }

  async function handleSaveDraftNow() {
    if (
      !hasDraftableContent({
        pickupStation,
        deliveryStation,
        pickupRoadAddress,
        pickupDetailAddress,
        deliveryRoadAddress,
        deliveryDetailAddress,
        photoRefs,
        packageItemName,
        packageDescription,
        recipientName,
        recipientPhone,
        pickupLocationDetail,
        storageLocation,
        specialInstructions,
        itemValue,
        preferredPickupDate,
        preferredPickupTime,
      })
    ) {
      Alert.alert('임시 저장', '먼저 이어서 작성할 내용을 조금이라도 입력해 주세요.');
      return;
    }

    setDraftSaving(true);
    try {
      await saveCreateRequestProgress(buildDraftPayload());
      setDraftRestored(true);
      Alert.alert('임시 저장됨', '다음에 돌아오면 이어서 작성할 수 있습니다.');
    } finally {
      setDraftSaving(false);
    }
  }

  function buildNearbyRecommendations(latitude: number, longitude: number): NearbyStationRecommendation[] {
    return locationService
      .findNearestStations(
        {
          latitude,
          longitude,
          accuracy: 0,
          altitude: null,
          speed: null,
          heading: null,
        },
        getStationCandidates(stations),
        4
      )
      .map((item) => ({
        station: item.station.station,
        distanceMeters: item.distanceMeters,
      }));
  }

  async function handleUseCurrentLocation(target: PickerType) {
    try {
      setResolvingLocation(target);
      const currentLocation = await locationService.getCurrentLocation();
      if (!currentLocation) {
        Alert.alert('위치 권한이 필요합니다', '기기의 위치 권한을 허용한 뒤 다시 시도해 주세요.');
        return;
      }

      const recommendations = buildNearbyRecommendations(
        currentLocation.latitude,
        currentLocation.longitude
      );

      if (recommendations.length === 0) {
        Alert.alert('가까운 역을 찾지 못했습니다', '잠시 후 다시 시도해 주세요.');
        return;
      }

      setNearbyPicker({
        target,
        title: target === 'pickup' ? '출발역을 선택해 주세요' : '도착역을 선택해 주세요',
        description: '현재 위치 기준으로 가까운 역 4곳을 추천해 드립니다.',
        recommendations,
      });
    } catch (error) {
      console.error('Failed to resolve nearest station', error);
      Alert.alert('위치 기반 추천 실패', '현재 위치를 확인한 뒤 다시 시도해 주세요.');
    } finally {
      setResolvingLocation(null);
    }
  }

  async function handleRecommendStationFromAddress(target: PickerType, roadAddress: string) {
    const trimmedAddress = roadAddress.trim();
    if (!trimmedAddress) {
      Alert.alert('도로명 주소가 필요합니다', '주소를 먼저 선택한 뒤 다시 시도해 주세요.');
      return;
    }

    try {
      setResolvingAddressStation(target);
      const geocoded = await geocodeRoadAddress(trimmedAddress);
      if (!geocoded) {
        Alert.alert(
          '주소 좌표를 찾지 못했습니다',
          '이 주소 주변 역을 바로 찾지 못했어요. 다른 주소를 선택하거나 직접 노선을 골라 주세요.'
        );

        setPickerType(target);
        setPickerVisible(true);
        return;
      }

      const recommendations = buildNearbyRecommendations(geocoded.latitude, geocoded.longitude);
      if (recommendations.length === 0) {
        Alert.alert(
          '주변 역 추천이 없습니다',
          '직접 노선을 선택할 수 있도록 역 선택 화면을 열어 드릴게요.'
        );

        setPickerType(target);
        setPickerVisible(true);
        return;
      }

      setNearbyPicker({
        target,
        title: target === 'pickup' ? '출발역을 선택해 주세요' : '도착역을 선택해 주세요',
        description: '입력한 도로명 주소 기준으로 가까운 역을 추천해 드립니다.',
        recommendations,
      });
    } catch (error) {
      console.error('Failed to resolve nearest station from address', error);
      Alert.alert(
        '주소 기반 역 추천 실패',
        error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.'
      );
    } finally {
      setResolvingAddressStation(null);
    }
  }

  function handleBack() {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('Tabs', {
      screen: requestMode === 'reservation' ? 'Requests' : 'Home',
    });
  }

  async function uploadSelectedPhoto(localUri: string | null) {
    if (!localUri) return;

    try {
      const requesterUserId = user?.uid ?? requireUserId();
      const uploaded = await uploadPhotoWithThumbnail(localUri, requesterUserId, 'request-item');
      setPhotoUrl(uploaded.url);
      setPhotoRefs((prev) => [uploaded.url, ...prev.filter((item) => item !== uploaded.url)]);
      setAiResult(null);
    } catch (error) {
      console.error(error);
      Alert.alert('사진 업로드 실패', '사진을 업로드하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  }

  async function handleUploadPhotoFromCamera() {
    try {
      const localUri = await takePhoto();
      await uploadSelectedPhoto(localUri);
    } catch (error) {
      console.error(error);
      Alert.alert('사진 촬영 실패', '카메라를 열지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  }

  async function handleUploadPhotoFromLibrary() {
    try {
      const localUri = await pickPhotoFromLibrary();
      await uploadSelectedPhoto(localUri);
    } catch (error) {
      console.error(error);
      Alert.alert('사진 선택 실패', '앨범에서 사진을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  }

  async function handleAI() {
    if (!photoUrl) {
      Alert.alert('사진이 필요해요', '먼저 물건 사진을 올린 뒤 AI 작성 도움을 사용할 수 있어요.');
      return;
    }

    const origin = toStationInfo(pickupStation ?? stations[0] ?? fallbackStation('pickup'));
    const destination = toStationInfo(deliveryStation ?? stations[1] ?? fallbackStation('delivery'));
    const pickupAddress = formatDetailedAddress(pickupRoadAddress, pickupDetailAddress);
    const deliveryAddress = formatDetailedAddress(deliveryRoadAddress, deliveryDetailAddress);

    setAiLoading(true);
    try {
      const result = await analyzeRequestDraftWithAI({
        requesterUserId: user?.uid ?? requireUserId(),
        requestMode,
        originRef: toLocationRef(pickupMode, origin, pickupAddress),
        destinationRef: toLocationRef(deliveryMode, destination, deliveryAddress),
        packageDraft: {
          itemName: packageItemName || undefined,
          description: packageDescription || undefined,
          estimatedValue: itemValue ? Number(itemValue) : undefined,
          estimatedWeightKg: weightKg ? Number(weightKg) : undefined,
          estimatedSize: packageSize,
        },
        recipient: {
          name: recipientName || undefined,
          phone: recipientPhone || undefined,
        },
        preferredSchedule: {
          pickupTime: resolvedPreferredPickupTime || undefined,
          arrivalTime: preferredArrivalTime || undefined,
        },
      });

      setAiResult(result);

      if (result.result.itemName) setPackageItemName(result.result.itemName);
      if (result.result.description) setPackageDescription(result.result.description);
      if (typeof result.result.estimatedValue === 'number' && result.result.estimatedValue > 0) {
        setItemValue(String(Math.round(result.result.estimatedValue)));
      }
      if (typeof result.result.estimatedWeightKg === 'number' && result.result.estimatedWeightKg > 0) {
        setWeightKg(String(result.result.estimatedWeightKg));
      }

      const aiSize = normalizeAISize(result.result.estimatedSize);
      if (aiSize) setPackageSize(aiSize);
    } catch (error) {
      console.error(error);
      Alert.alert('AI 작성 실패', 'AI 초안을 만들지 못했습니다. 직접 입력해서 계속 진행할 수 있어요.');
    } finally {
      setAiLoading(false);
    }
  }

  async function handleRequestContactOtp() {
    if (hasLockedVerifiedPhone && normalizedContactPhone === normalizedVerifiedPhone) {
      Alert.alert('이미 인증된 번호입니다', '이 번호는 다시 인증할 필요가 없습니다.');
      return;
    }

    const normalized = normalizedContactPhone;
    if (!/^010\d{8}$/.test(normalized)) {
      Alert.alert('휴대폰 번호', '010으로 시작하는 올바른 휴대폰 번호를 먼저 입력해 주세요.');
      return;
    }

    setContactOtpSending(true);
    try {
      const result = await requestPhoneOtp(normalized);
      if (result.alreadyVerified) {
        setVerifiedPhoneOverride(normalized);
        setContactOtpSessionId(null);
        setContactOtpCode('');
        setContactOtpHintCode(null);
        setContactOtpDestination(result.maskedDestination);
        setContactOtpExpiresAt(result.expiresAt);
        void refreshUser();
        Alert.alert('이미 인증된 번호입니다', '이 계정에서 이미 인증된 번호라 바로 사용할 수 있습니다.');
        return;
      }
      setContactOtpSessionId(result.sessionId);
      setContactOtpCode('');
      setContactOtpHintCode(result.testCode ?? null);
      setContactOtpDestination(result.maskedDestination);
      setContactOtpExpiresAt(result.expiresAt);
      Alert.alert(
        '인증번호를 보냈습니다',
        result.testCode ? `개발용 코드: ${result.testCode}` : `${result.maskedDestination} 번호로 전송했습니다.`
      );
    } catch (error) {
      Alert.alert('인증번호 전송 실패', error instanceof Error ? error.message : '인증번호를 보내지 못했습니다.');
    } finally {
      setContactOtpSending(false);
    }
  }

  async function handleVerifyContactOtp() {
    if (!user?.uid) {
      Alert.alert('로그인이 필요합니다', '다시 로그인한 뒤 휴대폰 인증을 진행해 주세요.');
      return;
    }

    if (!contactOtpSessionId) {
      Alert.alert('인증번호를 먼저 받아주세요', '휴대폰 인증 전 인증번호를 먼저 요청해 주세요.');
      return;
    }

    if (!/^\d{6}$/.test(contactOtpCode.trim())) {
      Alert.alert('인증번호', '인증번호 6자리를 입력해 주세요.');
      return;
    }

    setContactOtpVerifying(true);
    try {
      const normalized = normalizedContactPhone;
      await confirmPhoneOtp({
        sessionId: contactOtpSessionId,
        phoneNumber: normalized,
        code: contactOtpCode,
      });

      setVerifiedPhoneOverride(normalized);
      setContactOtpSessionId(null);
      setContactOtpCode('');
      setContactOtpHintCode(null);
      setContactOtpDestination('');
      setContactOtpExpiresAt(null);
      void refreshUser();
      Alert.alert('휴대폰 인증 완료', '이제 배송 요청을 계속 진행할 수 있습니다.');
    } catch (error) {
      Alert.alert('휴대폰 인증 실패', error instanceof Error ? error.message : '휴대폰 번호를 인증하지 못했습니다.');
    } finally {
      setContactOtpVerifying(false);
    }
  }

  async function handleSubmit() {
    if (!user?.uid) {
      Alert.alert('로그인이 필요합니다', '다시 로그인한 뒤 배송 요청을 진행해 주세요.');
      return;
    }

    if (!isOnboardingComplete) {
      Alert.alert('이용 시작 준비가 필요합니다', '첫 배송 요청 전에 이용자 정보와 약관 동의를 완료해 주세요.');
      return;
    }

    if (submitDisabled || !pickupStation || !deliveryStation) {
      const summary = missingItems.slice(0, 4).join('\n• ');
      Alert.alert('입력 확인', summary ? `• ${summary}` : '입력 항목을 다시 확인해 주세요.');
      return;
    }

    setSaving(true);
    try {
      if (pickupMode === 'address' && user?.uid) {
        await addRecentAddress(user.uid, {
          label: '최근 출발지',
          roadAddress: pickupRoadAddress,
          detailAddress: pickupDetailAddress,
        });
      }
      if (deliveryMode === 'address' && user?.uid) {
        await addRecentAddress(user.uid, {
          label: '최근 도착지',
          roadAddress: deliveryRoadAddress,
          detailAddress: deliveryDetailAddress,
        });
      }

      const result = await createBeta1Request({
        requesterUserId: user?.uid ?? requireUserId(),
        requestMode,
        sourceRequestId: params?.sourceRequestId,
        originType: pickupMode,
        destinationType: deliveryMode,
        pickupStation: toStationInfo(pickupStation),
        deliveryStation: toStationInfo(deliveryStation),
        pickupRoadAddress: pickupRoadAddress || undefined,
        pickupDetailAddress: pickupDetailAddress || undefined,
        deliveryRoadAddress: deliveryRoadAddress || undefined,
        deliveryDetailAddress: deliveryDetailAddress || undefined,
        selectedPhotoIds: photoRefs,
        packageItemName: packageItemName || undefined,
        packageCategory: packageCategory || undefined,
        packageDescription,
        packageSize,
        weightKg: Math.max(0.1, Number(weightKg || 0)),
        itemValue: Number(itemValue || 0),
        recipientName,
        recipientPhone,
        pickupLocationDetail: pickupLocationDetail || undefined,
        storageLocation: storageLocation || undefined,
        specialInstructions: specialInstructions || undefined,
        urgency: requestMode === 'reservation' ? 'normal' : urgency,
        selectedQuoteType,
        directParticipationMode: directMode,
        preferredPickupTime: resolvedPreferredPickupTime,
        preferredArrivalTime: preferredArrivalTime || undefined,
        aiAnalysisOverride: aiResult
          ? {
              provider: aiResult.provider,
              model: aiResult.model,
              confidence: aiResult.confidence,
              fallbackUsed: aiResult.fallbackUsed,
              result: aiResult.result,
            }
          : undefined,
        aiQuoteOverride: aiQuoteResponse ?? undefined,
        pricingContextOverride: pricingContext ?? undefined,
      });

      const selected = result.quoteCards.find((card) => card.quoteType === selectedQuoteType) ?? result.quoteCards[0];
      await deleteCreateRequestProgress();
      setDraftRestored(false);

      navigation.replace('RequestConfirmation', {
        requestId: result.requestId,
        pickupStationName:
          pickupMode === 'address'
            ? `${formatDetailedAddress(pickupRoadAddress, pickupDetailAddress)} · ${pickupStation.stationName}`
            : pickupStation.stationName,
        deliveryStationName:
          deliveryMode === 'address'
            ? `${formatDetailedAddress(deliveryRoadAddress, deliveryDetailAddress)} · ${deliveryStation.stationName}`
            : deliveryStation.stationName,
        deliveryFee: selected
          ? {
              totalFee: Number(selected.pricing.publicPrice),
              estimatedTime: parseEtaMinutes(selected.etaLabel),
            }
          : undefined,
      });
    } catch (error) {
      console.error(error);
      Alert.alert(
        '요청 생성 실패',
        error instanceof Error ? error.message : '요청을 만드는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.muted}>요청 화면을 준비하고 있어요.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppTopBar title={requestMode === 'reservation' ? '예약 요청' : '배송 요청'} onBack={handleBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Block title="요청 방식">
          <View style={styles.row}>
            <Chip label="지금 바로" active={requestMode === 'immediate'} onPress={() => setRequestMode('immediate')} />
            <Chip label="예약하기" active={requestMode === 'reservation'} onPress={() => setRequestMode('reservation')} />
          </View>
        </Block>

        <Block title="출발 정보">
          <View style={styles.row}>
            <Chip label="역에서 시작" active={pickupMode === 'station'} onPress={() => setPickupMode('station')} />
            <Chip label="주소에서 시작" active={pickupMode === 'address'} onPress={() => setPickupMode('address')} />
          </View>
          {pickupMode === 'address' ? (
            <View style={styles.column}>
              <AddressQuickPick
                title="저장한 주소"
                addresses={savedAddresses}
                onSelect={(address) => {
                  setPickupRoadAddress(address.roadAddress);
                  setPickupDetailAddress(address.detailAddress);
                  void handleRecommendStationFromAddress('pickup', address.roadAddress);
                }}
              />
              <AddressQuickPick
                title="최근 사용 주소"
                addresses={recentAddresses}
                onSelect={(address) => {
                  setPickupRoadAddress(address.roadAddress);
                  setPickupDetailAddress(address.detailAddress);
                  void handleRecommendStationFromAddress('pickup', address.roadAddress);
                }}
              />
              <TouchableOpacity style={styles.selector} onPress={() => setAddressTarget('pickup')}>
                <Text style={styles.selectorLabel}>도로명 주소</Text>
                <Text style={styles.selectorValue}>{pickupRoadAddress || '주소 검색으로 선택'}</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                value={pickupDetailAddress}
                onChangeText={setPickupDetailAddress}
                placeholder="출발지 상세 주소"
                placeholderTextColor={Colors.gray400}
              />
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  void handleRecommendStationFromAddress('pickup', pickupRoadAddress);
                }}
                disabled={resolvingAddressStation === 'pickup'}
              >
                {resolvingAddressStation === 'pickup' ? (
                  <ActivityIndicator color={Colors.primary} />
                ) : (
                  <Text style={styles.secondaryButtonText}>주소 기준으로 가까운 출발역 추천</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.selector}
            onPress={() => {
              setPickerType('pickup');
              setPickerVisible(true);
            }}
          >
            <Text style={styles.selectorLabel}>{pickupMode === 'address' ? '가까운 출발역' : '출발역'}</Text>
            <Text style={styles.selectorValue}>{pickupStation?.stationName ?? '출발역 선택'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              void handleUseCurrentLocation('pickup');
            }}
            disabled={resolvingLocation === 'pickup'}
          >
            {resolvingLocation === 'pickup' ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <Text style={styles.secondaryButtonText}>현재 위치로 가까운 출발역 추천</Text>
            )}
          </TouchableOpacity>
        </Block>

        <Block title="도착 정보">
          <View style={styles.row}>
            <Chip label="역으로 도착" active={deliveryMode === 'station'} onPress={() => setDeliveryMode('station')} />
            <Chip label="주소로 도착" active={deliveryMode === 'address'} onPress={() => setDeliveryMode('address')} />
          </View>
          {deliveryMode === 'address' ? (
            <View style={styles.column}>
              <AddressQuickPick
                title="저장한 주소"
                addresses={savedAddresses}
                onSelect={(address) => {
                  setDeliveryRoadAddress(address.roadAddress);
                  setDeliveryDetailAddress(address.detailAddress);
                  void handleRecommendStationFromAddress('delivery', address.roadAddress);
                }}
              />
              <AddressQuickPick
                title="최근 사용 주소"
                addresses={recentAddresses}
                onSelect={(address) => {
                  setDeliveryRoadAddress(address.roadAddress);
                  setDeliveryDetailAddress(address.detailAddress);
                  void handleRecommendStationFromAddress('delivery', address.roadAddress);
                }}
              />
              <TouchableOpacity style={styles.selector} onPress={() => setAddressTarget('delivery')}>
                <Text style={styles.selectorLabel}>도로명 주소</Text>
                <Text style={styles.selectorValue}>{deliveryRoadAddress || '주소 검색으로 선택'}</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                value={deliveryDetailAddress}
                onChangeText={setDeliveryDetailAddress}
                placeholder="도착지 상세 주소"
                placeholderTextColor={Colors.gray400}
              />
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  void handleRecommendStationFromAddress('delivery', deliveryRoadAddress);
                }}
                disabled={resolvingAddressStation === 'delivery'}
              >
                {resolvingAddressStation === 'delivery' ? (
                  <ActivityIndicator color={Colors.primary} />
                ) : (
                  <Text style={styles.secondaryButtonText}>주소 기준으로 가까운 도착역 추천</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.selector}
            onPress={() => {
              setPickerType('delivery');
              setPickerVisible(true);
            }}
          >
            <Text style={styles.selectorLabel}>{deliveryMode === 'address' ? '가까운 도착역' : '도착역'}</Text>
            <Text style={styles.selectorValue}>{deliveryStation?.stationName ?? '도착역 선택'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              void handleUseCurrentLocation('delivery');
            }}
            disabled={resolvingLocation === 'delivery'}
          >
            {resolvingLocation === 'delivery' ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <Text style={styles.secondaryButtonText}>현재 위치로 가까운 도착역 추천</Text>
            )}
          </TouchableOpacity>
        </Block>

        <Block title={photoUrl ? '물건 사진 ✓' : hasItemValue ? '물건 사진 (필수)' : '물건 사진 (선택)'}>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.primaryButton, styles.flexButton]} onPress={() => void handleUploadPhotoFromCamera()}>
              <Text style={styles.primaryButtonText}>{photoUrl ? '다시 촬영' : '사진 찍기'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryButton, styles.flexButton]} onPress={() => void handleUploadPhotoFromLibrary()}>
              <Text style={styles.secondaryButtonText}>앨범에서 선택</Text>
            </TouchableOpacity>
          </View>
          {hasItemValue && !photoUrl ? (
            <Text style={styles.muted}>⚠️ 물품 가치를 입력하셨습니다. 보증금 적용을 위해 사진이 필요합니다.</Text>
          ) : !photoUrl ? (
            <Text style={styles.muted}>사진을 올리면 AI가 물품 설명을 작성해 드립니다. 없이도 진행할 수 있습니다.</Text>
          ) : null}
          {photoUrl ? <Image source={{ uri: photoUrl }} style={styles.previewImage} /> : null}
          <TouchableOpacity
            style={[styles.secondaryButton, !photoUrl && styles.disabled]}
            onPress={() => void handleAI()}
            disabled={!photoUrl}
          >
            <Text style={styles.secondaryButtonText}>AI에게 설명 맡기기</Text>
          </TouchableOpacity>
          {photoUrl ? <Text style={styles.muted}>AI 분석은 선택 기능이며 직접 입력해서 진행할 수도 있습니다.</Text> : null}
        </Block>

        <Block title="물품 정보">
          <TextInput
            style={styles.input}
            value={packageItemName}
            onChangeText={setPackageItemName}
            placeholder="물품명"
            placeholderTextColor={Colors.gray400}
          />
          <TextInput
            style={styles.input}
            value={packageDescription}
            onChangeText={setPackageDescription}
            placeholder="예: 서류 봉투, 작은 박스, 노트북 가방"
            placeholderTextColor={Colors.gray400}
          />
          {aiResult ? (
            <View style={styles.aiBox}>
              <Text style={styles.aiTitle}>AI 분석 결과</Text>
              <Text style={styles.muted}>신뢰도 {Math.round(aiResult.confidence * 100)}%</Text>
            </View>
          ) : null}
          <View style={styles.row}>
            {CLEAN_SIZE_OPTIONS.map((size) => (
              <Chip
                key={size.value}
                label={size.label}
                active={packageSize === size.value}
                onPress={() => setPackageSize(size.value)}
              />
            ))}
          </View>
          <TextInput
            style={styles.input}
            value={weightKg}
            onChangeText={setWeightKg}
            keyboardType="decimal-pad"
            placeholder="무게(kg)"
            placeholderTextColor={Colors.gray400}
          />
          <TextInput
            style={styles.input}
            value={itemValue}
            onChangeText={setItemValue}
            keyboardType="number-pad"
            placeholder="물품 가치(선택)"
            placeholderTextColor={Colors.gray400}
          />
        </Block>

        <Block title="시간과 진행 방식">
          {requestMode === 'reservation' ? (
            <>
              <TouchableOpacity style={styles.selector} onPress={() => setReservationCalendarVisible(true)}>
                <Text style={styles.selectorLabel}>물건 희망 도착 날짜</Text>
                <Text style={styles.selectorValue}>{preferredPickupDate || '날짜 선택'}</Text>
              </TouchableOpacity>
              <TimePicker
                label="물건 희망 도착 시간"
                value={preferredPickupTime}
                onChange={setPreferredPickupTime}
                placeholder="시간 선택"
                minuteInterval={10}
              />
              <Text style={styles.muted}>
                희망 도착 날짜와 시간만 선택하면 됩니다. 세부 조율은 매칭 후 안내됩니다.
              </Text>
            </>
          ) : (
            <View style={styles.row}>
              {([
                { value: 'normal', label: '일반' },
                { value: 'fast', label: '빠름' },
                { value: 'urgent', label: '긴급' },
              ] as const).map((level) => (
                <Chip
                  key={level.value}
                  label={level.label}
                  active={urgency === level.value}
                  onPress={() => setUrgency(level.value)}
                />
              ))}
            </View>
          )}
          <View style={styles.column}>
            <Chip label="길러에게 맡기기" active={directMode === 'none'} onPress={() => setDirectMode('none')} />
            <Chip
              label="출발역까지 직접 전달"
              active={directMode === 'requester_to_station'}
              onPress={() => setDirectMode('requester_to_station')}
            />
            <Chip
              label="사물함 포함"
              active={directMode === 'locker_assisted'}
              onPress={() => setDirectMode('locker_assisted')}
            />
          </View>
        </Block>

        <Block title="인계와 수령 정보">
          <TextInput
            style={styles.input}
            value={pickupLocationDetail}
            onChangeText={setPickupLocationDetail}
            placeholder={
              directMode === 'requester_to_station'
                ? '만날 위치 안내'
                : '픽업 위치 안내'
            }
            placeholderTextColor={Colors.gray400}
          />
          {directMode === 'locker_assisted' ? (
            <TextInput
              style={styles.input}
              value={storageLocation}
              onChangeText={setStorageLocation}
              placeholder="사물함 위치 또는 번호"
              placeholderTextColor={Colors.gray400}
            />
          ) : null}
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={specialInstructions}
            onChangeText={setSpecialInstructions}
            placeholder="추가 요청사항"
            placeholderTextColor={Colors.gray400}
            multiline
          />
          <TextInput
            style={styles.input}
            value={recipientName}
            onChangeText={setRecipientName}
            placeholder="수령인 이름"
            placeholderTextColor={Colors.gray400}
          />
          <TextInput
            style={styles.input}
            value={recipientPhone}
            onChangeText={setRecipientPhone}
            keyboardType="phone-pad"
            placeholder="수령인 연락처"
            placeholderTextColor={Colors.gray400}
          />
          <View style={styles.noticeBox}>
            <Text style={styles.noticeTitle}>안심번호 안내</Text>
            <Text style={styles.noticeBody}>{recipientPrivacyConfig.guidance}</Text>
            <Text style={styles.noticeMeta}>
              제공 방식: {recipientPrivacyConfig.safeNumberEnabled ? '안심번호 전환' : '관리자 설정 확인 필요'} · 운영 설정: {recipientPrivacyConfig.providerName}
            </Text>
            <Text style={styles.noticeMeta}>
              적용 약관: {recipientPrivacyConfig.policyTitle} ({recipientPrivacyConfig.policyEffectiveDate})
            </Text>
          </View>
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setRecipientConsentChecked((current) => !current)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, recipientConsentChecked && styles.checkboxChecked]}>
              <Text style={styles.checkboxMark}>{recipientConsentChecked ? '✓' : ''}</Text>
            </View>
            <Text style={styles.checkboxLabel}>
              수령인 정보의 안심번호 전환 및 제3자 정보 제공에 동의합니다.
            </Text>
          </TouchableOpacity>
        </Block>

        <Block title="휴대폰 인증">
          <Text style={styles.muted}>
            가입은 가볍게 유지하고, 실제 배송 요청 전에 연락 가능한 휴대폰만 확인합니다.
          </Text>
          <TextInput
            style={styles.input}
            value={contactPhoneNumber}
            onChangeText={(value) => {
              if (hasLockedVerifiedPhone) {
                return;
              }
              const formatted = formatPhoneDigits(value);
              setContactPhoneNumber(formatted);
              if (normalizePhoneNumber(formatted) !== normalizedVerifiedPhone) {
                setVerifiedPhoneOverride(null);
                setContactOtpSessionId(null);
                setContactOtpCode('');
                setContactOtpHintCode(null);
                setContactOtpDestination('');
                setContactOtpExpiresAt(null);
              }
            }}
            keyboardType="phone-pad"
            placeholder="010-1234-5678"
            placeholderTextColor={Colors.gray400}
            editable={!hasLockedVerifiedPhone}
          />
          {hasLockedVerifiedPhone ? (
            <>
              <Text style={styles.selectorValue}>이미 인증된 휴대폰입니다.</Text>
              <Text style={styles.muted}>번호 변경은 프로필에서만 가능합니다.</Text>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('ProfileEdit')}>
                <Text style={styles.secondaryButtonText}>프로필에서 번호 변경</Text>
              </TouchableOpacity>
            </>
          ) : isPhoneVerified ? (
            <Text style={styles.selectorValue}>이미 인증된 휴대폰입니다.</Text>
          ) : (
            <>
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.flexInput]}
                  value={contactOtpCode}
                  onChangeText={setContactOtpCode}
                  keyboardType="number-pad"
                  placeholder="인증번호 6자리"
                  placeholderTextColor={Colors.gray400}
                />
                <TouchableOpacity
                  style={[styles.secondaryButton, styles.otpInlineButton]}
                  onPress={() => void handleRequestContactOtp()}
                  disabled={contactOtpSending}
                >
                  {contactOtpSending ? (
                    <ActivityIndicator color={Colors.primary} />
                  ) : (
                    <Text style={styles.secondaryButtonText}>{contactOtpSessionId ? '재전송' : '인증번호 받기'}</Text>
                  )}
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => void handleVerifyContactOtp()}
                disabled={contactOtpVerifying || !contactOtpSessionId}
              >
                {contactOtpVerifying ? (
                  <ActivityIndicator color={Colors.primary} />
                ) : (
                  <Text style={styles.secondaryButtonText}>휴대폰 인증 완료</Text>
                )}
              </TouchableOpacity>
              {contactOtpDestination ? <Text style={styles.muted}>전송 대상: {contactOtpDestination}</Text> : null}
              {contactOtpExpiresAt ? (
                <Text style={styles.muted}>만료 시간: {new Date(contactOtpExpiresAt).toLocaleTimeString()}</Text>
              ) : null}
              {contactOtpHintCode ? <Text style={styles.muted}>개발용 코드: {contactOtpHintCode}</Text> : null}
            </>
          )}
        </Block>

        <Text style={styles.sectionHeader}>예상 금액</Text>
        {quotes.map((card) => (
          <TouchableOpacity
            key={card.quoteType}
            style={[styles.quoteCard, selectedQuoteType === card.quoteType && styles.quoteCardSelected]}
            onPress={() => {
              quoteSelectionTouchedRef.current = true;
              setSelectedQuoteType(card.quoteType);
            }}
          >
            <View style={styles.quoteHeader}>
              <View style={styles.quoteTextWrap}>
                <Text style={styles.quoteLabel}>{card.label}</Text>
                <Text style={styles.quoteHeadline}>{card.headline}</Text>
                {aiQuotesLoading ? <Text style={styles.quoteEngineHint}>추천 엔진 반영 중</Text> : null}
                <Text style={styles.muted}>{card.recommendationReason}</Text>
              </View>
              <View style={styles.quotePriceWrap}>
                <Text style={styles.quotePrice}>{card.priceLabel}</Text>
                <Text style={styles.muted}>{card.etaLabel}</Text>
              </View>
            </View>
            <View style={styles.quoteBreakdown}>
              <QuoteBreakdownRow label="기본요금" value={card.pricing.baseFee} />
              <QuoteBreakdownRow label="거리요금" value={card.pricing.distanceFee} />
              <QuoteBreakdownRow label="무게요금" value={card.pricing.weightFee} />
              <QuoteBreakdownRow label="크기요금" value={card.pricing.sizeFee} />
              <QuoteBreakdownRow label="긴급가산" value={card.pricing.urgencySurcharge} />
              <QuoteBreakdownRow label="주소픽업" value={card.pricing.addressPickupFee} />
              <QuoteBreakdownRow label="주소도착" value={card.pricing.addressDropoffFee} />
              <QuoteBreakdownRow label="사물함" value={card.pricing.lockerFee} />
              <QuoteBreakdownRow label="서비스수수료" value={card.pricing.serviceFee} />
              <QuoteBreakdownRow label="부가세" value={card.pricing.vat} />
              <View style={styles.quoteDivider} />
              <QuoteBreakdownRow label="예상금액 합계" value={card.pricing.publicPrice} strong />
            </View>
          </TouchableOpacity>
        ))}

        {missingItems.length > 0 && (
          <View style={styles.missingCard}>
            <Text style={styles.missingTitle}>아래 항목을 완성하면 요청할 수 있습니다</Text>
            {missingItems.map((item) => (
              <View key={item} style={styles.missingRow}>
                <Text style={styles.missingDot}>•</Text>
                <Text style={styles.missingText}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        {(draftRestored || draftSaving) && (
          <View style={styles.draftCard}>
            <Text style={styles.draftTitle}>{draftRestored ? '이전 작성 내용을 이어서 불러왔습니다' : '입력 중인 내용을 임시 저장하고 있습니다'}</Text>
            <TouchableOpacity style={styles.draftAction} onPress={() => void handleClearDraft()}>
              <Text style={styles.draftActionText}>이어쓰기 기록 지우기</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[styles.primaryButton, submitDisabled && styles.disabled]}
          onPress={() => void handleSubmit()}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={Colors.white} />
          ) : submitDisabled ? (
            <Text style={styles.primaryButtonText}>부족한 항목 확인하기</Text>
          ) : (
            <Text style={styles.primaryButtonText}>배송 요청하기</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => void handleSaveDraftNow()} disabled={saving || draftSaving}>
          <Text style={styles.secondaryButtonText}>{draftSaving ? '저장 중...' : '임시 저장하기'}</Text>
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
        title="역 선택"
      />

      <AddressSearchModal
        visible={addressTarget === 'pickup'}
        title="출발지 도로명 주소 검색"
        onClose={() => setAddressTarget(null)}
        onSelectAddress={(item) => {
          setPickupRoadAddress(item.roadAddress);
          void handleRecommendStationFromAddress('pickup', item.roadAddress);
        }}
      />

      <AddressSearchModal
        visible={addressTarget === 'delivery'}
        title="도착지 도로명 주소 검색"
        onClose={() => setAddressTarget(null)}
        onSelectAddress={(item) => {
          setDeliveryRoadAddress(item.roadAddress);
          void handleRecommendStationFromAddress('delivery', item.roadAddress);
        }}
      />

      <NearbyStationRecommendationsModal
        visible={nearbyPicker !== null}
        title={nearbyPicker?.title ?? ''}
        description={nearbyPicker?.description}
        recommendations={nearbyPicker?.recommendations ?? []}
        onClose={() => setNearbyPicker(null)}
        onSelectStation={(station) => {
          if (nearbyPicker?.target === 'pickup') {
            setPickupStation(station);
          } else if (nearbyPicker?.target === 'delivery') {
            setDeliveryStation(station);
          }
          setNearbyPicker(null);
        }}
      />

      <DatePickerModal
        visible={reservationCalendarVisible}
        value={preferredPickupDate}
        title="물건 희망 도착 날짜"
        onClose={() => setReservationCalendarVisible(false)}
        onSelect={setPreferredPickupDate}
      />

      <Modal visible={aiLoading} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.modalTitle}>AI가 작성 중입니다</Text>
            <Text style={styles.modalBody}>
              사진과 주소, 지하철 조건을 바탕으로 물품 설명과 예상 정보를 정리하고 있습니다. 잠시만 기다려 주세요.
            </Text>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function AddressQuickPick({
  title,
  addresses,
  onSelect,
}: {
  title: string;
  addresses: SavedAddress[];
  onSelect: (address: SavedAddress) => void;
}) {
  if (addresses.length === 0) return null;

  return (
    <View style={styles.quickPickWrap}>
      <Text style={styles.quickPickTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickPickRow}>
        {addresses.slice(0, 5).map((address) => (
          <TouchableOpacity key={`${title}-${address.addressId}`} style={styles.quickPickChip} onPress={() => onSelect(address)}>
            <Text style={styles.quickPickLabel}>{address.label}</Text>
            <Text numberOfLines={1} style={styles.quickPickText}>{address.fullAddress}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function QuoteBreakdownRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <View style={styles.quoteBreakdownRow}>
      <Text style={[styles.quoteBreakdownLabel, strong && styles.quoteBreakdownLabelStrong]}>{label}</Text>
      <Text style={[styles.quoteBreakdownValue, strong && styles.quoteBreakdownValueStrong]}>
        {value.toLocaleString()}원
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: Colors.background,
  },
  content: { padding: Spacing.lg, gap: Spacing.md },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: 10,
    ...Shadows.sm,
  },
  cardTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
  },
  sectionHeader: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
    paddingTop: 4,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  column: { gap: 8 },
  chip: {
    minHeight: 42,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.gray50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  chipTextActive: {
    color: Colors.white,
  },
  input: {
    minHeight: 52,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    color: Colors.textPrimary,
  },
  flexInput: {
    flex: 1,
  },
  selector: {
    minHeight: 58,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
    gap: 4,
  },
  selectorLabel: {
    color: Colors.textSecondary,
    ...Typography.caption,
  },
  selectorValue: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  flexButton: {
    flex: 1,
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.gray50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontWeight: '800',
  },
  otpInlineButton: {
    minWidth: 110,
    paddingHorizontal: 16,
  },
  disabled: { opacity: 0.5 },
  muted: {
    color: Colors.textSecondary,
    ...Typography.caption,
  },
  multilineInput: {
    minHeight: 92,
    textAlignVertical: 'top',
    paddingTop: Spacing.md,
  },
  noticeBox: {
    gap: 6,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.gray50,
    padding: Spacing.md,
  },
  noticeTitle: {
    color: Colors.textPrimary,
    fontWeight: '800',
  },
  noticeBody: {
    color: Colors.textSecondary,
    ...Typography.bodySmall,
  },
  noticeMeta: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.xs,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkboxMark: {
    color: Colors.white,
    fontSize: Typography.fontSize.sm,
    fontWeight: '800',
  },
  checkboxLabel: {
    flex: 1,
    color: Colors.textPrimary,
    ...Typography.bodySmall,
  },
  quickPickWrap: { gap: 8 },
  quickPickTitle: { color: Colors.textSecondary, fontSize: Typography.fontSize.sm, fontWeight: '700' },
  quickPickRow: { gap: 8 },
  quickPickChip: {
    width: 180,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.gray50,
    padding: Spacing.sm,
    gap: 4,
  },
  quickPickLabel: { color: Colors.textPrimary, fontWeight: '800', fontSize: Typography.fontSize.sm },
  quickPickText: { color: Colors.textSecondary, ...Typography.caption },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.gray100,
  },
  aiBox: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    backgroundColor: Colors.gray50,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  aiTitle: {
    color: Colors.textPrimary,
    fontWeight: '800',
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
  quoteTextWrap: {
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
  quoteEngineHint: {
    color: Colors.primary,
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
  },
  quotePriceWrap: {
    alignItems: 'flex-end',
    gap: 4,
  },
  quotePrice: {
    color: Colors.textPrimary,
    fontWeight: '800',
  },
  quoteBreakdown: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 6,
  },
  quoteBreakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  quoteBreakdownLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
  },
  quoteBreakdownLabelStrong: {
    color: Colors.textPrimary,
    fontWeight: '800',
  },
  quoteBreakdownValue: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
  },
  quoteBreakdownValueStrong: {
    color: Colors.primary,
    fontSize: Typography.fontSize.base,
  },
  quoteDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  modalCard: {
    width: '100%',
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surface,
    padding: Spacing.xl,
    gap: Spacing.sm,
    alignItems: 'center',
    ...Shadows.sm,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalBody: {
    color: Colors.textSecondary,
    ...Typography.bodySmall,
    textAlign: 'center',
  },
  missingCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.gray50,
    padding: Spacing.lg,
    gap: 6,
    marginTop: Spacing.md,
  },
  missingTitle: {
    color: Colors.error,
    fontWeight: '800',
    fontSize: Typography.fontSize.sm,
    marginBottom: 4,
  },
  missingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  missingDot: {
    color: Colors.error,
    fontSize: Typography.fontSize.sm,
    lineHeight: 18,
  },
  missingText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 18,
  },
  draftCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.gray50,
    padding: Spacing.lg,
    gap: 10,
  },
  draftTitle: {
    color: Colors.textPrimary,
    fontWeight: '800',
    fontSize: Typography.fontSize.sm,
  },
  draftAction: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  draftActionText: {
    color: Colors.primary,
    fontWeight: '800',
    fontSize: Typography.fontSize.sm,
  },
});
