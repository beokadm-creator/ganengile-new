import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import LockerLocator from '../../components/delivery/LockerLocator';
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
  hasDraftableContent,
  type CreateRequestDraft,
} from '../../utils/draft-storage';
import { useCreateRequestStore } from './create-request/store/useCreateRequestStore';
import { usePhoneVerification } from './create-request/hooks/usePhoneVerification';
import { usePricingQuotes } from './create-request/hooks/usePricingQuotes';
import { useLocationResolution } from './create-request/hooks/useLocationResolution';
import { useRequestDraft } from './create-request/hooks/useRequestDraft';
import { Step1Location } from './create-request/steps/Step1Location';
import { Step2Item } from './create-request/steps/Step2Item';
import { Step3Recipient } from './create-request/steps/Step3Recipient';
import { Step4Quote } from './create-request/steps/Step4Quote';
import type { LocationMode, PackageSize, PickerType, AddressTarget, NearbyPickerState } from './create-request/types';

type Props = {
  navigation: MainStackNavigationProp;
  route?: { params?: MainStackParamList['CreateRequest'] };
};

import {
  normalizePhoneNumber,
  formatPhoneDigits,
  splitReservationSchedule,
  combineReservationSchedule,
} from '../../utils/format';

function parseEtaMinutes(label: string): number {
  const matched = label.match(/(\d+)/);
  return matched ? Number(matched[1]) : 0;
}



const FALLBACK_RECIPIENT_PRIVACY_CONFIG: RecipientContactPrivacyConfig = {
  safeNumberEnabled: true,
  providerName: '관리자 설정 예정',
  policyTitle: '수령인 개인정보 제공 동의',
  policyEffectiveDate: '2026-04-03',
  thirdPartyConsentRequired: true,
  guidance:
    '수령인 연락처는 안심번호로 전환되어 전달되며, 실제 번호는 관리자 설정 API를 통해 안전하게 관리됩니다.',
};

function normalizeAISize(size?: string): PackageSize | null {
  return size === 'small' || size === 'medium' || size === 'large' || size === 'xl' || size === 'extra_large' ? size : null;
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

function fromDraftStationInfo(station?: CreateRequestDraft['pickupStation']): StationInfo | null {
  if (!station) return null;
  return {
    id: station.stationId,
    stationId: station.stationId,
    stationName: station.stationName,
    line: station.line ?? '',
    lineCode: station.lineCode ?? '',
    lat: station.lat,
    lng: station.lng,
  };
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



export default function CreateRequestScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const { user, refreshUser } = useUser();
  const params = route?.params;
  const prefill = params?.prefill;
  const prefilledReservation = splitReservationSchedule(prefill?.preferredPickupTime);

  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [addressTarget, setAddressTarget] = useState<AddressTarget>(null);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [recentAddresses, setRecentAddresses] = useState<SavedAddress[]>([]);
  const [aiResult, setAiResult] = useState<Beta1AIAnalysisResponse | null>(null);
  const [showLockerLocator, setShowLockerLocator] = useState(false);
  const [reservationCalendarVisible, setReservationCalendarVisible] = useState(false);

  const {
    resolvingLocation,
    resolvingAddressStation,
    nearbyPicker,
    setNearbyPicker,
    pickerVisible,
    setPickerVisible,
    pickerType,
    setPickerType,
    handleUseCurrentLocation,
    handleRecommendStationFromAddress,
  } = useLocationResolution(stations);
  
  const {
    // Note: this hook manages OTP internal state so we don't return them here anymore.
    contactOtpSessionId,
    contactOtpCode,
    setContactOtpCode,
    contactOtpHintCode,
    contactOtpDestination,
    contactOtpExpiresAt,
    contactOtpSending,
    contactOtpVerifying,
    hasLockedVerifiedPhone,
    isPhoneVerified,
    handleRequestContactOtp,
    handleVerifyContactOtp,
    resetOtpState,
  } = usePhoneVerification();

  const [recipientPrivacyConfig, setRecipientPrivacyConfig] = useState<RecipientContactPrivacyConfig>(
    FALLBACK_RECIPIENT_PRIVACY_CONFIG
  );

  const {
    activeStep, setActiveStep,
    requestMode, setRequestMode,
    pickupMode, setPickupMode,
    pickupStation, setPickupStation,
    pickupRoadAddress, setPickupRoadAddress,
    pickupDetailAddress, setPickupDetailAddress,
    deliveryMode, setDeliveryMode,
    deliveryStation, setDeliveryStation,
    deliveryRoadAddress, setDeliveryRoadAddress,
    deliveryDetailAddress, setDeliveryDetailAddress,
    packageItemName, setPackageItemName,
    packageCategory, setPackageCategory: _setPackageCategory,
    packageDescription, setPackageDescription,
    packageSize, setPackageSize,
    weightKg, setWeightKg,
    itemValue, setItemValue,
    photoUrl, setPhotoUrl,
    photoRefs, setPhotoRefs,
    preferredPickupDate, setPreferredPickupDate,
    preferredPickupTime, setPreferredPickupTime,
    preferredArrivalTime, setPreferredArrivalTime: _setPreferredArrivalTime,
    urgency, setUrgency,
    recipientName, setRecipientName,
    recipientPhone, setRecipientPhone,
    recipientConsentChecked, setRecipientConsentChecked,
    pickupLocationDetail, setPickupLocationDetail,
    specialInstructions, setSpecialInstructions,
    directMode, setDirectMode,
    storageLocation, setStorageLocation,
    lockerId, setLockerId,
    contactPhoneNumber, setContactPhoneNumber,
    verifiedPhoneOverride, setVerifiedPhoneOverride,
    aiQuotesLoading, setAiQuotesLoading,
    selectedQuoteType, setSelectedQuoteType,
    draftRestored, setDraftRestored,
    draftSaving, setDraftSaving,
    hydrateFromDraft, hydrateFromPrefill, clearForm
  } = useCreateRequestStore();

  useEffect(() => {
    if (prefill || params?.mode === 'reservation') {
      hydrateFromPrefill(prefill, prefilledReservation);
    }
    return () => clearForm();
  }, []);

  const { draftHydratedRef, handleClearDraft, handleSaveDraftNow } = useRequestDraft();
  const depositPhotoNoticeShownRef = useRef(false);



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
        setPickupStation(fromDraftStationInfo(draft.pickupStation));
        setDeliveryStation(fromDraftStationInfo(draft.deliveryStation));
        
        hydrateFromDraft(draft);

        // Auto-advance step if draft is partially filled
        let restoredStep = draft.step ?? 1;
        if (restoredStep === 1) {
          if (draft.pickupStation && draft.deliveryStation) {
            restoredStep = 2;
            if (draft.packageSize && draft.weightKg && draft.itemValue) {
              restoredStep = 3;
              if (draft.recipientName && draft.recipientPhone && draft.recipientConsentChecked) {
                restoredStep = 4;
              }
            }
          }
        }
        
        setActiveStep(Math.min(Math.max(1, restoredStep), 4));
      }

      draftHydratedRef.current = true;
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [params?.sourceRequestId, prefill]);

  const isOnboardingComplete = user?.hasCompletedOnboarding === true;
  const {
    pricingPolicy,
    pricingContext,
    aiQuoteResponse,
    quotes,
    deterministicQuotes,
    resolvedPreferredPickupTime,
    desiredArrivalSchedule,
    quoteSelectionTouchedRef,
  } = usePricingQuotes();

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





  const handleContactPhoneChange = (value: string) => {
    if (hasLockedVerifiedPhone) {
      return;
    }
    const formatted = formatPhoneDigits(value);
    setContactPhoneNumber(formatted);
    if (normalizePhoneNumber(formatted) !== normalizePhoneNumber(
      verifiedPhoneOverride ?? user?.phoneVerification?.phoneNumber ?? ''
    )) {
      setVerifiedPhoneOverride(null);
      resetOtpState();
    }
  };
  useEffect(() => {
    // 활성화된 스텝이 변경될 때 약간의 딜레이를 두고 스크롤 이동
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [activeStep]);

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
      setPhotoRefs([uploaded.url, ...photoRefs.filter((item) => item !== uploaded.url)]);
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

    const origin = pickupStation ?? toStationInfo(stations[0] ?? fallbackStation('pickup'));
    const destination = deliveryStation ?? toStationInfo(stations[1] ?? fallbackStation('delivery'));
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
        pickupStation: pickupStation!,
        deliveryStation: deliveryStation!,
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
        lockerId: lockerId || undefined,
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
        pricingPolicyVersion: pricingPolicy?.version ?? undefined,
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

  const minQuotePrice = quotes.length > 0 ? Math.min(...quotes.map((q) => q.pricing.publicPrice)) : 0;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppTopBar title="배송 요청 만들기" onBack={handleBack} />

      <ScrollView ref={scrollViewRef} contentContainerStyle={[styles.content, { paddingBottom: 100 }]} showsVerticalScrollIndicator={false}>
        <Step1Location
          savedAddresses={savedAddresses}
          recentAddresses={recentAddresses}
          setAddressTarget={setAddressTarget}
          resolvingAddressStation={resolvingAddressStation}
          handleRecommendStationFromAddress={handleRecommendStationFromAddress}
          setPickerType={setPickerType}
          setPickerVisible={setPickerVisible}
          resolvingLocation={resolvingLocation}
          handleUseCurrentLocation={handleUseCurrentLocation}
        />

        <Step2Item
          handleUploadPhotoFromCamera={handleUploadPhotoFromCamera}
          handleUploadPhotoFromLibrary={handleUploadPhotoFromLibrary}
          handleAI={handleAI}
          aiResult={aiResult}
          setReservationCalendarVisible={setReservationCalendarVisible}
          hasItemValue={hasItemValue}
        />

        <Step3Recipient
          setShowLockerLocator={setShowLockerLocator}
          recipientPrivacyConfig={recipientPrivacyConfig}
          handleContactPhoneChange={handleContactPhoneChange}
          hasLockedVerifiedPhone={hasLockedVerifiedPhone}
          isPhoneVerified={isPhoneVerified}
          contactOtpCode={contactOtpCode}
          setContactOtpCode={setContactOtpCode}
          contactOtpSessionId={contactOtpSessionId}
          contactOtpSending={contactOtpSending}
          contactOtpVerifying={contactOtpVerifying}
          contactOtpDestination={contactOtpDestination}
          contactOtpExpiresAt={contactOtpExpiresAt}
          contactOtpHintCode={contactOtpHintCode}
          handleRequestContactOtp={handleRequestContactOtp}
          handleVerifyContactOtp={handleVerifyContactOtp}
          onNavigateToProfile={() => navigation.navigate('ProfileEdit')}
        />

        <Step4Quote
          quotes={quotes}
          quoteSelectionTouchedRef={quoteSelectionTouchedRef}
          missingItems={missingItems}
          handleClearDraft={handleClearDraft}
          submitDisabled={submitDisabled}
          handleSubmit={handleSubmit}
          saving={saving}
          handleSaveDraftNow={handleSaveDraftNow}
        />
       </ScrollView>

       {/* 하단 실시간 예상 요금바 */}
       {minQuotePrice > 0 && (
        <View style={[styles.floatingPriceBar, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
          <Text style={styles.floatingPriceLabel}>최소 예상 요금</Text>
          <Text style={styles.floatingPriceValue}>{minQuotePrice.toLocaleString()}원~</Text>
        </View>
       )}

      <OptimizedStationSelectModal
        visible={pickerVisible}
        stations={stations}
        onClose={() => setPickerVisible(false)}
        onSelectStation={(station: Station) => {
          if (pickerType === 'pickup') {
            setPickupStation(toStationInfo(station));
          } else {
            setDeliveryStation(toStationInfo(station));
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
            setPickupStation(toStationInfo(station));
          } else if (nearbyPicker?.target === 'delivery') {
            setDeliveryStation(toStationInfo(station));
          }
          setNearbyPicker(null);
        }}
      />

      <DatePickerModal
        visible={reservationCalendarVisible}
        value={preferredPickupDate}
        title="희망 도착 날짜"
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
      <Modal visible={showLockerLocator} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { width: '90%', height: '80%', padding: 0, overflow: 'hidden' }]}>
            <LockerLocator
              selectedStationId={pickupStation?.stationId}
              onLockerSelect={(locker) => {
                setLockerId(locker.lockerId);
                setStorageLocation(`${locker.stationName} ${locker.lockerId} (상태: ${locker.status})`);
                setShowLockerLocator(false);
              }}
              onClose={() => setShowLockerLocator(false)}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}



const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.background,
  },
  content: { padding: Spacing.lg, gap: Spacing.md },
  muted: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    width: '80%',
    backgroundColor: Colors.surface,
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  modalTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
  },
  modalBody: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  floatingPriceBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    ...Shadows.lg,
  },
  floatingPriceLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  floatingPriceValue: {
    color: Colors.primary,
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.extrabold,
  },
});
