/**
 * Create Request Screen
 * 배송 요청 생성 화면 (5단계 스텝)
 * 디자인 토큰 적용 완료
 * 개선사항: 네트워크 에러 처리, 진행 상태 저장, 더 나은 UX
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { getAllStations, getTravelTimeConfig, getStationConfig } from '../../services/config-service';
import { createRequest } from '../../services/request-service';
import {
  calculatePhase1DeliveryFee,
  estimateStationCountFromCoords,
  type Phase1PricingParams,
  type PackageSizeType,
} from '../../services/pricing-service';
import { getRealtimeFare } from '../../services/fare-service';
import { requireUserId } from '../../services/firebase';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';
import type { Station } from '../../types/config';
import type { StationInfo, PackageWeight } from '../../types/request';
import type { PackageSize } from '../../types/request';
import TimePicker from '../../components/common/TimePicker';
import AppTopBar from '../../components/common/AppTopBar';
import { OptimizedStationSelectModal } from '../../components/OptimizedStationSelectModal';
import ModeToggleSwitch from '../../components/onetime/ModeToggleSwitch';

// Utils
import { retryWithBackoff, retryFirebaseQuery } from '../../utils/retry-with-backoff';
import { showErrorAlert } from '../../utils/error-handler';
import { isNetworkAvailable } from '../../utils/network-detector';
import {
  saveCreateRequestProgress,
  loadCreateRequestProgress,
  deleteCreateRequestProgress,
  type CreateRequestDraft,
} from '../../utils/draft-storage';

function convertStationToInfo(station: Station): StationInfo {
  const firstLine = station.lines?.[0];
  // stationId가 없는 경우 stationName을 ID로 사용 (임시 해결책)
  const stationId = station.stationId || station.stationName;

  // Firebase location 데이터는 lng, lat 순서로 되어 있음
  let lat = 37.5546; // 기본값 (서울역)
  let lng = 126.9706; // 기본값 (서울역)

  if (station.location) {
    // Firebase 데이터: { lng: 127.0612, lat: 37.9175 }
    // 또는 표준 형식: { latitude: 37.9175, longitude: 127.0612 }
    const loc = station.location as any;
    if (loc.lat !== undefined) {
      lat = loc.lat as number;
      lng = loc.lng as number;
    } else if (loc.latitude !== undefined) {
      lat = loc.latitude as number;
      lng = loc.longitude as number;
    }
  }

  return {
    id: stationId,
    stationId: stationId,
    stationName: station.stationName,
    line: firstLine?.lineName || '',
    lineCode: firstLine?.lineCode || '',
    lat: lat,
    lng: lng,
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

type Step = 1 | 2 | 3 | 4 | 5;

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
    surchargeMultiplier: 0.1,
    timeWindow: '15~30분 내',
  },
  {
    level: 'urgent',
    label: '매우 빠름',
    description: '15분 내 픽업',
    surchargeMultiplier: 0.2,
    timeWindow: '15분 내',
  },
];

export default function CreateRequestScreen({ navigation }: Props) {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [loadingStations, setLoadingStations] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showDraftRestore, setShowDraftRestore] = useState(false);
  const [stations, setStations] = useState<Station[]>([]);
  const [showStationPicker, setShowStationPicker] = useState(false);
  const [pickerType, setPickerType] = useState<'pickup' | 'delivery'>('pickup');

  // Form data
  const [pickupStation, setPickupStation] = useState<Station | null>(null);
  const [deliveryStation, setDeliveryStation] = useState<Station | null>(null);
  const [packageSize, setPackageSize] = useState<PackageSize>('small' as PackageSize);
  const [weight, setWeight] = useState('');
  const [description, setDescription] = useState('');
  const [itemValue, setItemValue] = useState('');
  const [isFragile, setIsFragile] = useState(false);
  const [isPerishable, setIsPerishable] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [pickupTime, setPickupTime] = useState('12:00');
  const [deliveryTime, setDeliveryTime] = useState('14:00');
  const [urgency, setUrgency] = useState<UrgencyLevel>('normal');
  const [manualAdjustment] = useState(0);
  const [pickupLocationDetail, setPickupLocationDetail] = useState('');
  const [storageLocation, setStorageLocation] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const depositAmount = useMemo(() => {
    if (itemValue && parseFloat(itemValue) > 0) {
      return Math.round(parseFloat(itemValue) * 0.8);
    }
    return 0;
  }, [itemValue]);

  // Calculated values
  const [deliveryFee, setDeliveryFee] = useState<{
    baseFee: number;
    distanceFee: number;
    sizeFee: number;
    weightFee: number;
    publicFare?: number;
    serviceFee: number;
    vat: number;
    totalFee: number;
    estimatedTime: number;
    stationCount: number;
    estimationSource?: 'config' | 'gps' | 'fare' | 'default';
    urgencyFee?: number;
    urgencySurcharge?: number;
    manualAdjustment?: number;
    gillerFee: number;
    platformFee: number;
  } | null>(null);
  const [fareStatus, setFareStatus] = useState<'idle' | 'loading' | 'ok' | 'unavailable'>('idle');

  // Themed styles
  const styles = useMemo(() => createStyles(Colors, Typography, Spacing, BorderRadius), []);

  // Load stations and draft on mount
  useEffect(() => {
    loadStations();
    loadDraft();
  }, []);

  // Auto-save progress when form data changes
  useEffect(() => {
    const saveProgress = async () => {
      const draft: CreateRequestDraft = {
        step: currentStep,
        pickupStation,
        deliveryStation,
        packageSize,
        weight,
        description,
        isFragile,
        isPerishable,
        recipientName,
        recipientPhone,
        pickupTime,
        deliveryTime,
        urgency,
        pickupLocationDetail,
        storageLocation,
        specialInstructions,
      };
      await saveCreateRequestProgress(draft);
    };

    // Debounce save
    const timer = setTimeout(saveProgress, 1000);
    return () => clearTimeout(timer);
  }, [
    currentStep,
    pickupStation,
    deliveryStation,
    packageSize,
    weight,
    description,
    isFragile,
    isPerishable,
    recipientName,
    recipientPhone,
    pickupTime,
    deliveryTime,
    urgency,
    pickupLocationDetail,
    storageLocation,
    specialInstructions,
  ]);

  // Calculate fee when dependencies change
  useEffect(() => {
    if (pickupStation && deliveryStation && weight) {
      calculateFee();
    } else if (!weight || !pickupStation || !deliveryStation) {
      setDeliveryFee(null);
    }
  }, [pickupStation, deliveryStation, packageSize, weight, urgency, manualAdjustment]);

  const loadStations = async () => {
    setLoadingStations(true);
    try {
      const data = await retryFirebaseQuery(() => getAllStations());
      setStations(data);
    } catch (error) {
      console.error('Error loading stations:', error);
      showErrorAlert(error, '오류', () => loadStations());
    } finally {
      setLoadingStations(false);
    }
  };

  const loadDraft = async () => {
    try {
      console.log('Loading draft...');
      const draft = await loadCreateRequestProgress();
      console.log('Draft found:', draft);

      if (draft && draft.step > 1) {
        console.log('Setting showDraftRestore to true');
        setShowDraftRestore(true);
        // Store draft data for restore
        (window as any).__draftData = draft;
      } else {
        console.log('No valid draft found or step is 1');
      }
    } catch (error) {
      console.error('Error loading draft:', error);
    }
  };

  const restoreDraft = () => {
    const draft = (window as any).__draftData as CreateRequestDraft;
    if (draft) {
      console.log('Restoring draft:', {
        pickupStation: draft.pickupStation?.stationName,
        deliveryStation: draft.deliveryStation?.stationName,
        areSame: draft.pickupStation?.stationId === draft.deliveryStation?.stationId
      });
      
      // Validate station data before restoring
      if (draft.pickupStation && !draft.pickupStation.stationId) {
        console.warn('Draft has invalid pickupStation (missing stationId), discarding draft');
        discardDraft();
        return;
      }
      if (draft.deliveryStation && !draft.deliveryStation.stationId) {
        console.warn('Draft has invalid deliveryStation (missing stationId), discarding draft');
        discardDraft();
        return;
      }
      
      setCurrentStep(draft.step as Step);
      setPickupStation(draft.pickupStation);
      setDeliveryStation(draft.deliveryStation);
      setPackageSize(draft.packageSize as PackageSize);
      setWeight(draft.weight);
      setDescription(draft.description);
      setIsFragile(draft.isFragile);
      setIsPerishable(draft.isPerishable);
      setRecipientName(draft.recipientName);
      setRecipientPhone(draft.recipientPhone);
      setPickupTime(draft.pickupTime);
      setDeliveryTime(draft.deliveryTime);
      setUrgency(draft.urgency as UrgencyLevel);
      setPickupLocationDetail(draft.pickupLocationDetail);
      setStorageLocation(draft.storageLocation);
      setSpecialInstructions(draft.specialInstructions);
      setShowDraftRestore(false);
      
      if (draft.pickupStation && draft.deliveryStation && 
          draft.pickupStation.stationId === draft.deliveryStation.stationId) {
        setErrors({ deliveryStation: '픽업 역과 배송 역이 같을 수 없습니다. 다시 선택해주세요.' });
      }
    }
  };

  const discardDraft = async () => {
    await deleteCreateRequestProgress();
    setShowDraftRestore(false);
    delete (window as any).__draftData;
  };

  const getStationCountFromGPS = (pickup: Station, delivery: Station): number | null => {
    const loc1 = pickup.location as any;
    const loc2 = delivery.location as any;
    const lat1 = loc1?.lat ?? loc1?.latitude;
    const lng1 = loc1?.lng ?? loc1?.longitude;
    const lat2 = loc2?.lat ?? loc2?.latitude;
    const lng2 = loc2?.lng ?? loc2?.longitude;
    if (lat1 && lng1 && lat2 && lng2) {
      return estimateStationCountFromCoords(lat1, lng1, lat2, lng2);
    }
    return null;
  };

  const sanitizeWeightInput = (input: string) => {
    const normalized = input.replace(/,/g, '.').replace(/[^0-9.]/g, '');
    if (!normalized) return '';
    const firstDot = normalized.indexOf('.');
    let value = normalized;
    if (firstDot >= 0) {
      const head = normalized.slice(0, firstDot + 1);
      const tail = normalized.slice(firstDot + 1).replace(/\./g, '');
      const [intPart, decPart] = `${head}${tail}`.split('.');
      value = decPart ? `${intPart}.${decPart.slice(0, 2)}` : `${intPart}.`;
    }
    if (value.startsWith('.')) {
      value = `0${value}`;
    }
    return value;
  };

  const calculateFee = async () => {
    if (!pickupStation || !deliveryStation || !weight) {
      console.log('Missing required data for fee calculation:', {
        hasPickupStation: !!pickupStation,
        hasDeliveryStation: !!deliveryStation,
        hasWeight: !!weight,
        weight
      });
      return;
    }

    if (!pickupStation.stationId || !deliveryStation.stationId) {
      console.error('Invalid station data:', { pickupStation, deliveryStation });
      // stationId가 없어도 계산 시도
    }

    try {
      setFareStatus('loading');
      console.log('Starting fee calculation with weight:', weight);

      let travelTimeMinutes: number | null = null;
      let stationCount: number | null = null;
      let estimationSource: 'config' | 'gps' | 'fare' | 'default' | null = null;

      // Firebase에서 이동 시간 데이터 가져오기 시도
      if (pickupStation.stationId && deliveryStation.stationId) {
        try {
          let travelTimeData = await getTravelTimeConfig(
            pickupStation.stationId,
            deliveryStation.stationId
          );
          // 일부 구간은 단방향 데이터만 저장된 경우가 있어 역방향도 조회
          if (!travelTimeData) {
            travelTimeData = await getTravelTimeConfig(
              deliveryStation.stationId,
              pickupStation.stationId
            );
          }

          if (travelTimeData) {
            const travelTimeSeconds = travelTimeData.normalTime;
            travelTimeMinutes = Math.round(travelTimeSeconds / 60);
            stationCount = Math.max(2, Math.round((travelTimeMinutes || 0) / 2.5));
            estimationSource = 'config';
            console.log('Travel time data loaded (Firestore):', { travelTimeMinutes, stationCount });
          } else {
            // Firestore에 구간 데이터가 없으면 → GPS 좌표 기반 fallback
            const gpsCount = getStationCountFromGPS(pickupStation, deliveryStation);
            if (gpsCount !== null) {
              stationCount = gpsCount;
              travelTimeMinutes = stationCount * 2.5;
              estimationSource = 'gps';
              console.log('Travel time estimated (GPS fallback):', { stationCount, travelTimeMinutes });
            } else {
              console.log('No travel-time data and no coords; trying fare distance fallback');
            }
          }
        } catch (error) {
          console.log('Error loading travel time, trying fallbacks:', error);
        }
      }

      const weightRaw = parseFloat(weight);
      const weightValue = Number.isFinite(weightRaw) ? weightRaw : 0;
      if (weightValue <= 0) {
        setDeliveryFee(null);
        return;
      }
      console.log('Calculating fee with:', { stationCount, weight: weightValue, packageSize, urgency });

      let publicFare = 0;
      let fareDistanceKm: number | null = null;
      try {
        const [pickupConfig, deliveryConfig] = await Promise.all([
          pickupStation.stationId ? getStationConfig(pickupStation.stationId) : null,
          deliveryStation.stationId ? getStationConfig(deliveryStation.stationId) : null,
        ]);
        const dptreStnCd = pickupConfig?.fare?.stationCode || pickupConfig?.kric?.stationCode;
        const avrlStnCd = deliveryConfig?.fare?.stationCode || deliveryConfig?.kric?.stationCode;
        if ((dptreStnCd && avrlStnCd) || (pickupStation.stationName && deliveryStation.stationName)) {
          const fareResult = await getRealtimeFare(
            dptreStnCd,
            avrlStnCd,
            pickupStation.stationName,
            deliveryStation.stationName,
            { cacheOnly: true }
          );
          if (fareResult?.fare) {
            publicFare = fareResult.fare;
            setFareStatus('ok');
          } else {
            setFareStatus('unavailable');
            setDeliveryFee(null);
            return;
          }
          const movement = Number(fareResult?.raw?.mvmnDstc ?? NaN);
          if (Number.isFinite(movement) && movement > 0) {
            fareDistanceKm = movement;
          }
        } else {
          setFareStatus('unavailable');
          setDeliveryFee(null);
          return;
        }
      } catch (error) {
        console.log('Fare cache not available:', error);
        setFareStatus('unavailable');
        setDeliveryFee(null);
        return;
      }

      // 마지막 fallback: 운임 API의 이동거리(km)로 역수/시간 추정
      if ((!stationCount || !travelTimeMinutes) && fareDistanceKm && fareDistanceKm > 0) {
        const estimatedStationCount = Math.max(2, Math.round(fareDistanceKm / 1.2) + 1);
        if (!stationCount) stationCount = estimatedStationCount;
        if (!travelTimeMinutes) travelTimeMinutes = Math.max(8, Math.round(fareDistanceKm * 3));
        if (!estimationSource) estimationSource = 'fare';
      }

      if (!stationCount) {
        stationCount = 5;
      }
      if (!travelTimeMinutes) {
        travelTimeMinutes = Math.round(stationCount * 2.5);
      }
      if (!estimationSource) estimationSource = 'default';

      const pricingParams: Phase1PricingParams = {
        stationCount: stationCount,
        weight: weightValue,
        packageSize: packageSize as PackageSizeType,
        urgency,
        publicFare,
      };

      const feeResult = calculatePhase1DeliveryFee(pricingParams);
      console.log('Fee calculation result:', feeResult);

      setDeliveryFee({
        baseFee: feeResult.baseFee,
        distanceFee: feeResult.distanceFee,
        sizeFee: feeResult.sizeFee,
        weightFee: feeResult.weightFee,
        publicFare: feeResult.publicFare,
        serviceFee: feeResult.serviceFee,
        vat: feeResult.vat,
        totalFee: feeResult.totalFee,
        estimatedTime: travelTimeMinutes,
        stationCount,
        estimationSource,
        urgencyFee: feeResult.urgencySurcharge,
        urgencySurcharge: feeResult.urgencySurcharge,
        manualAdjustment: 0,
        gillerFee: feeResult.breakdown.gillerFee,
        platformFee: feeResult.breakdown.platformFee,
      });
    } catch (error) {
      console.error('Error calculating delivery fee:', error);
      setFareStatus('unavailable');
      setDeliveryFee(null);
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
    } else if (description.length > 200) {
      newErrors.description = '설명은 200자 이내로 입력해주세요.';
    }

    if (!itemValue || parseFloat(itemValue) < 0) {
      newErrors.itemValue = '물건 가치를 올바르게 입력해주세요.';
    } else if (parseFloat(itemValue) > 10000000) {
      newErrors.itemValue = '물건 가치는 10,000,000원 이하여야 합니다.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [weight, description, itemValue]);

  const validateStep3 = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!recipientName || recipientName.trim().length === 0) {
      newErrors.recipientName = '수신자 이름을 입력해주세요.';
    }

    const phoneRegex = /^010-\d{4}-\d{4}$/;
    if (!phoneRegex.test(recipientPhone)) {
      newErrors.recipientPhone = '전화번호 형식이 올바르지 않습니다. (010-XXXX-XXXX)';
    }

    const pickupDate = new Date();
    const [pickupHour, pickupMinute] = pickupTime.split(':').map(Number);
    pickupDate.setHours(pickupHour, pickupMinute, 0, 0);

    const deliveryDate = new Date();
    const [deliveryHour, deliveryMinute] = deliveryTime.split(':').map(Number);
    deliveryDate.setHours(deliveryHour, deliveryMinute, 0, 0);

    if (deliveryDate <= pickupDate) {
      newErrors.deliveryTime = '배송 마감 시간은 픽업 마감 시간보다 늦어야 합니다.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [recipientName, recipientPhone, pickupTime, deliveryTime]);

  const validateStep4 = useCallback((): boolean => {
    return true;
  }, []);

  const validateStep5 = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (pickupLocationDetail && pickupLocationDetail.length > 100) {
      newErrors.pickupLocationDetail = '만날 장소 상세는 100자 이내로 입력해주세요.';
    }
    if (storageLocation && storageLocation.length > 100) {
      newErrors.storageLocation = '보관 위치는 100자 이내로 입력해주세요.';
    }
    if (specialInstructions && specialInstructions.length > 200) {
      newErrors.specialInstructions = '특이사항은 200자 이내로 입력해주세요.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [pickupLocationDetail, storageLocation, specialInstructions]);

  const handleNext = () => {
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !validateStep2()) return;
    if (currentStep === 3 && !validateStep3()) return;
    if (currentStep === 4 && !validateStep4()) return;
    if (currentStep === 5 && !validateStep5()) return;

    if (currentStep < 5) {
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
    // 필수 필드 검증 및 피드백
    if (!pickupStation) {
      Alert.alert('알림', '픽업 역을 선택해주세요.');
      setCurrentStep(1);
      return;
    }
    if (!deliveryStation) {
      Alert.alert('알림', '배송 역을 선택해주세요.');
      setCurrentStep(1);
      return;
    }

    // stationId가 없는 경우 처리 (임시 해결책)
    const pickupId = pickupStation.stationId || pickupStation.stationName;
    const deliveryId = deliveryStation.stationId || deliveryStation.stationName;

    if (!pickupId || !deliveryId) {
      Alert.alert('오류', '역 정보가 올바르지 않습니다. 다시 선택해주세요.');
      setCurrentStep(1);
      return;
    }

    if (pickupId === deliveryId) {
      Alert.alert('알림', '픽업 역과 배송 역이 같을 수 없습니다.');
      setCurrentStep(1);
      return;
    }

    if (!deliveryFee) {
      Alert.alert('알림', '관리자 운임 캐시를 확인할 수 없어 배송비를 계산하지 못했습니다. 잠시 후 다시 시도해주세요.');
      setCurrentStep(2);
      return;
    }
    if (fareStatus !== 'ok' || !deliveryFee.publicFare || deliveryFee.publicFare <= 0) {
      Alert.alert('알림', '운임 캐시가 확인된 구간만 요청할 수 있습니다. 역 조합을 다시 선택하거나 잠시 후 재시도해주세요.');
      setCurrentStep(1);
      return;
    }

    // Check network

    // Check network
    const isOnline = await isNetworkAvailable();
    if (!isOnline) {
      Alert.alert(
        '네트워크 오류',
        '인터넷 연결을 확인해주세요.',
        [
          { text: '취소', style: 'cancel' },
          { text: '다시 시도', onPress: handleSubmit },
        ]
      );
      return;
    }

    setLoading(true);
    setIsRetrying(false);

    try {
      // 디버깅용 역 데이터 출력
      console.log('Pickup Station:', JSON.stringify(pickupStation, null, 2));
      console.log('Delivery Station:', JSON.stringify(deliveryStation, null, 2));

      const pickupInfo = convertStationToInfo(pickupStation);
      const deliveryInfo = convertStationToInfo(deliveryStation);

      console.log('Pickup Info:', JSON.stringify(pickupInfo, null, 2));
      console.log('Delivery Info:', JSON.stringify(deliveryInfo, null, 2));

      const userId = requireUserId();

      const [pickupHour, pickupMinute] = pickupTime.split(':').map(Number);
      const pickupDeadline = new Date();
      pickupDeadline.setHours(pickupHour, pickupMinute, 0, 0);
      // If pickup time has passed today, set it to tomorrow
      if (pickupDeadline <= new Date()) {
        pickupDeadline.setDate(pickupDeadline.getDate() + 1);
      }

      const [deliveryHour, deliveryMinute] = deliveryTime.split(':').map(Number);
      const deliveryDeadline = new Date();
      deliveryDeadline.setHours(deliveryHour, deliveryMinute, 0, 0);
      // If delivery time has passed today, set it to tomorrow
      if (deliveryDeadline <= new Date()) {
        deliveryDeadline.setDate(deliveryDeadline.getDate() + 1);
      }
      // Ensure delivery deadline is after pickup deadline
      if (deliveryDeadline <= pickupDeadline) {
        deliveryDeadline.setDate(deliveryDeadline.getDate() + 1);
      }

      const parsedWeightKg = parseFloat(weight);
      const packageInfo = {
        size: packageSize,
        weight: convertWeightToPackageWeight(parsedWeightKg),
        weightKg: parsedWeightKg,
        description: `${description}${isFragile ? ' (깨지기 쉬움)' : ''}${isPerishable ? ' (부패하기 쉬움)' : ''}`,
      };

      console.log('Creating request with deadline:', deliveryDeadline);
      console.log('Current time:', new Date());
      console.log('Deadline is in future:', deliveryDeadline > new Date());

      const urgencyMap: Record<UrgencyLevel, 'low' | 'medium' | 'high'> = {
        normal: 'low',
        fast: 'medium',
        urgent: 'high',
      };

      const request = await retryWithBackoff(
        () => createRequest({
          requesterId: userId,
          pickupStation: pickupInfo,
          deliveryStation: deliveryInfo,
          packageInfo,
          initialNegotiationFee: deliveryFee.totalFee,
          feeBreakdown: {
            baseFee: deliveryFee.baseFee,
            distanceFee: deliveryFee.distanceFee,
            sizeFee: deliveryFee.sizeFee,
            weightFee: deliveryFee.weightFee,
            urgencySurcharge: deliveryFee.urgencySurcharge || 0,
            publicFare: deliveryFee.publicFare || 0,
            manualAdjustment: deliveryFee.manualAdjustment || 0,
            serviceFee: deliveryFee.serviceFee,
            vat: deliveryFee.vat,
            totalFee: deliveryFee.totalFee,
            breakdown: {
              gillerFee: deliveryFee.gillerFee,
              platformFee: deliveryFee.platformFee,
            },
          },
          itemValue: parseFloat(itemValue),
          preferredTime: {
            departureTime: pickupTime,
            arrivalTime: deliveryTime,
          },
          deadline: deliveryDeadline,
          urgency: urgencyMap[urgency],
          pickupLocationDetail: pickupLocationDetail || undefined,
          storageLocation: storageLocation || undefined,
          specialInstructions: specialInstructions || undefined,
        }),
        {
          maxAttempts: 3,
          timeoutMs: 30000,
          onRetry: (attempt) => {
            setIsRetrying(true);
            console.log(`Retry attempt ${attempt}...`);
          },
        }
      );

      // Clear draft after successful submission
      await deleteCreateRequestProgress();

      console.log('Request created successfully, showing confirmation...');

      // 요청 완료 안내 후 매칭 시작
      navigation.navigate('RequestConfirmation' as any, {
        requestId: request.requestId,
        pickupStationName: pickupStation.stationName,
        deliveryStationName: deliveryStation.stationName,
        deliveryFee: deliveryFee
      } as any);
    } catch (error) {
      console.error('Error creating request:', error);
      showErrorAlert(error, '오류', () => handleSubmit());
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  };

  // Render functions with accessibility labels
  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <ModeToggleSwitch />

      <Text style={styles.stepTitle} accessibilityLabel="1단계, 역 선택">역 선택</Text>
      <Text style={styles.stepDesc}>픽업 역과 배송 역을 선택해주세요.</Text>

      <TouchableOpacity
        style={[styles.inputButton, errors.pickupStation && styles.inputButtonError]}
        onPress={() => {
          setPickerType('pickup');
          setShowStationPicker(true);
        }}
        accessibilityLabel="픽업 역 선택"
        accessibilityHint="픽업할 지하철 역을 선택합니다"
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
        accessibilityLabel="배송 역 선택"
        accessibilityHint="배송할 지하철 역을 선택합니다"
      >
        <Text style={styles.inputButtonText}>
          {deliveryStation ? deliveryStation.stationName : '배송 역 선택'}
        </Text>
      </TouchableOpacity>
      {errors.deliveryStation && <Text style={styles.errorText}>{errors.deliveryStation}</Text>}

      {pickupStation && deliveryStation && deliveryFee && (
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            예상 소요시간: 약 {deliveryFee.estimatedTime}분 · 기준 역수: {deliveryFee.stationCount}개
          </Text>
          <Text style={styles.infoSubText}>
            계산 기준: {deliveryFee.estimationSource === 'config'
              ? '실제 구간 데이터'
              : deliveryFee.estimationSource === 'gps'
              ? '역 좌표 기반 추정'
              : deliveryFee.estimationSource === 'fare'
              ? '운임 API 거리 기반 추정'
              : '기본 추정값'}
          </Text>
        </View>
      )}
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle} accessibilityLabel="2단계, 패키지 정보">패키지 정보</Text>
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
            accessibilityLabel={`크기 ${size === 'small' ? '소형' : size === 'medium' ? '중형' : size === 'large' ? '대형' : '특대'}`}
            accessibilityState={{ selected: packageSize === size }}
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
        onChangeText={(text) => {
          const sanitized = sanitizeWeightInput(text);
          setWeight(sanitized);
          if (errors.weight) {
            setErrors(prev => ({ ...prev, weight: '' }));
          }
        }}
        placeholder="예: 3.5 (최대 30kg)"
        keyboardType="decimal-pad"
        accessibilityLabel="무게 입력"
        accessibilityHint="물건의 무게를 킬로그램 단위로 입력하세요"
      />
      {errors.weight && <Text style={styles.errorText}>{errors.weight}</Text>}

      <Text style={styles.label}>설명</Text>
      <TextInput
        style={[styles.input, styles.textArea, errors.description && styles.inputError]}
        value={description}
        onChangeText={(text) => {
          setDescription(text);
          if (errors.description) {
            setErrors(prev => ({ ...prev, description: '' }));
          }
        }}
        placeholder="물건에 대한 간단한 설명"
        multiline
        numberOfLines={3}
        maxLength={200}
        accessibilityLabel="물건 설명 입력"
      />
      {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
      <Text style={styles.charCount}>{description.length}/200</Text>
      <Text style={styles.label}>물건 가치 (원)</Text>
      <Text style={styles.hintText}>물건의 가치를 입력해주세요. (0원 입력 가능, 예: 100000)</Text>
      <TextInput
        style={[styles.input, errors.itemValue && styles.inputError]}
        value={itemValue}
        onChangeText={(text) => {
          setItemValue(text);
          if (errors.itemValue) {
            setErrors(prev => ({ ...prev, itemValue: '' }));
          }
        }}
        placeholder="0원 입력 가능 (예: 100000)"
        keyboardType="number-pad"
        maxLength={10}
        accessibilityLabel="물건 가치 입력"
      />
      {errors.itemValue && <Text style={styles.errorText}>{errors.itemValue}</Text>}

      {depositAmount > 0 && (
        <View style={styles.depositInfoCard}>
          <Text style={styles.depositInfoTitle}>보증금 안내</Text>
          <Text style={styles.depositInfoText}>물건 가치: {parseInt(itemValue).toLocaleString()}원</Text>
          <Text style={styles.depositInfoText}>보증금 (80%): {depositAmount.toLocaleString()}원</Text>
          <Text style={styles.depositInfoNote}>길러가 배송을 수락할 때 보증금이 결제됩니다.</Text>
        </View>
      )}


      <View style={styles.switchContainer}>
        <TouchableOpacity
          style={[styles.switchButton, isFragile && styles.switchButtonActive]}
          onPress={() => setIsFragile(!isFragile)}
          accessibilityLabel="깨지기 쉬움"
          accessibilityState={{ selected: isFragile }}
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
          accessibilityLabel="부패하기 쉬움"
          accessibilityState={{ selected: isPerishable }}
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
            accessibilityLabel={`긴급도 ${option.label}, ${option.description}`}
            accessibilityState={{ selected: urgency === option.level }}
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
        <>
          <View style={styles.feePreviewCard}>
            <Text style={styles.feePreviewTitle}>예상 배송비 (초기 협상금액)</Text>
            <Text style={styles.feePreviewAmount}>{deliveryFee.totalFee.toLocaleString()}원</Text>
            <View style={styles.feeBreakdownPreview}>
              <Text style={styles.feeBreakdownNote}>요금 구성</Text>
              <Text style={styles.feeBreakdownText}>
                기본: {deliveryFee.baseFee.toLocaleString()}원
              </Text>
              {deliveryFee.publicFare > 0 && (
                <Text style={styles.feeBreakdownText}>
                  운임: {deliveryFee.publicFare.toLocaleString()}원
                </Text>
              )}
              {(!deliveryFee.publicFare || deliveryFee.publicFare <= 0) && (
                <Text style={styles.feeBreakdownText}>
                  운임: 0원 (관리자 운임 캐시 미확인)
                </Text>
              )}
              {fareStatus === 'loading' && (
                <Text style={styles.feeBreakdownNote}>운임 조회 중...</Text>
              )}
              {fareStatus === 'unavailable' && (
                <Text style={styles.feeBreakdownNote}>운임 캐시 미확인 구간입니다. 요청 전 역 조합을 다시 확인해주세요.</Text>
              )}
              <Text style={styles.feeBreakdownText}>
                거리: {deliveryFee.distanceFee.toLocaleString()}원 (기준 {deliveryFee.stationCount}개 역)
              </Text>
              <Text style={styles.feeBreakdownText}>
                무게: {deliveryFee.weightFee.toLocaleString()}원
              </Text>
              <Text style={styles.feeBreakdownText}>
                {deliveryFee.sizeFee > 0
                  ? `크기: ${deliveryFee.sizeFee.toLocaleString()}원`
                  : '크기: 소형 기준 추가요금 0원'}
              </Text>
              {deliveryFee.urgencySurcharge > 0 && (
                <Text style={styles.feeBreakdownUrgency}>
                  긴급 할증: +{deliveryFee.urgencySurcharge.toLocaleString()}원
                </Text>
              )}
              <Text style={styles.feeBreakdownText}>
                서비스 수수료: {deliveryFee.serviceFee.toLocaleString()}원
              </Text>
              <Text style={styles.feeBreakdownText}>
                VAT: {deliveryFee.vat.toLocaleString()}원
              </Text>
              <Text style={styles.feeBreakdownNote}>
                합계 = (기본+거리+무게+크기+긴급+운임+수수료) + VAT
              </Text>
            </View>
            <Text style={styles.feePreviewNote}>
              * 이 요금은 초기 협상금액이며, 최종 금액은 배송 완료 후 확정됩니다.
            </Text>
            <Text style={styles.feePreviewNote}>
              * 최소 3,000원 / 최대 10,000원 범위가 적용됩니다.
            </Text>
          </View>
        </>
      )}
      {!deliveryFee && pickupStation && deliveryStation && weight && fareStatus === 'unavailable' && (
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>운임 캐시 확인 필요</Text>
          <Text style={styles.warningText}>
            선택한 역 조합의 관리자 운임 데이터가 아직 준비되지 않았습니다. 다른 역 조합을 선택하거나 잠시 후 다시 시도해주세요.
          </Text>
        </View>
      )}
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle} accessibilityLabel="3단계, 수신자 정보">수신자 정보</Text>
      <Text style={styles.stepDesc}>수신자의 연락처를 입력해주세요.</Text>

      <Text style={styles.label}>이름</Text>
      <TextInput
        style={[styles.input, errors.recipientName && styles.inputError]}
        value={recipientName}
        onChangeText={(text) => {
          setRecipientName(text);
          if (errors.recipientName) {
            setErrors(prev => ({ ...prev, recipientName: '' }));
          }
        }}
        placeholder="홍길동"
        accessibilityLabel="수신자 이름 입력"
      />
      {errors.recipientName && <Text style={styles.errorText}>{errors.recipientName}</Text>}

      <Text style={styles.label}>전화번호</Text>
      <TextInput
        style={[styles.input, errors.recipientPhone && styles.inputError]}
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
          if (errors.recipientPhone) {
            setErrors(prev => ({ ...prev, recipientPhone: '' }));
          }
        }}
        placeholder="010-1234-5678"
        keyboardType="phone-pad"
        maxLength={13}
        accessibilityLabel="수신자 전화번호 입력"
      />
      {errors.recipientPhone && <Text style={styles.errorText}>{errors.recipientPhone}</Text>}

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
      {errors.deliveryTime && <Text style={styles.errorText}>{errors.deliveryTime}</Text>}
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle} accessibilityLabel="4단계, 배송 요약">배송 요약</Text>
      <Text style={styles.stepDesc}>모든 정보를 확인한 뒤 다음 단계에서 추가 정보를 입력할 수 있습니다.</Text>

      <View style={styles.summaryCard} accessibilityLabel="배송 요약 정보">
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>경로</Text>
          <Text style={styles.summaryValue}>
            {pickupStation?.stationName} → {deliveryStation?.stationName}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>패키지</Text>
          <Text style={styles.summaryValue}>
            {packageSize === 'small' ? '소형' : packageSize === 'medium' ? '중형' : packageSize === 'large' ? '대형' : '특대'} ({weight}kg)
            {isFragile && ' 🔴'}
            {isPerishable && ' 🟠'}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>수신자</Text>
          <Text style={styles.summaryValue}>
            {recipientName} ({recipientPhone})
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>시간</Text>
          <Text style={styles.summaryValue}>
            {pickupTime} → {deliveryTime}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>긴급도</Text>
          <Text style={styles.summaryValue}>
            {URGENCY_OPTIONS.find(opt => opt.level === urgency)?.label}
          </Text>
        </View>

        {(pickupLocationDetail || storageLocation || specialInstructions) && (
          <>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>추가 정보</Text>
            </View>
            {pickupLocationDetail && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>만날 장소</Text>
                <Text style={styles.summaryValue}>{pickupLocationDetail}</Text>
              </View>
            )}
            {storageLocation && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>보관 위치</Text>
                <Text style={styles.summaryValue}>{storageLocation}</Text>
              </View>
            )}
            {specialInstructions && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>특이사항</Text>
                <Text style={styles.summaryValue}>{specialInstructions}</Text>
              </View>
            )}
          </>
        )}

        {deliveryFee && (
          <>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>배송비</Text>
              <Text style={styles.summaryValueTotal}>{deliveryFee.totalFee.toLocaleString()}원</Text>
            </View>
            <View style={styles.feeBreakdown}>
              <Text style={styles.feeItem}>기본: {deliveryFee.baseFee.toLocaleString()}원</Text>
              {deliveryFee.publicFare && deliveryFee.publicFare > 0 && (
                <Text style={styles.feeItem}>운임: {deliveryFee.publicFare.toLocaleString()}원</Text>
              )}
              {fareStatus === 'loading' && (
                <Text style={styles.feeItemNote}>운임 조회 중...</Text>
              )}
              {fareStatus === 'unavailable' && (
                <Text style={styles.feeItemNote}>운임 캐시 미확인 구간입니다. 요청 전 역 조합을 다시 확인해주세요.</Text>
              )}
              <Text style={styles.feeItem}>
                거리: {deliveryFee.distanceFee.toLocaleString()}원 (기준 {deliveryFee.stationCount}개 역)
              </Text>
              <Text style={styles.feeItem}>무게: {deliveryFee.weightFee.toLocaleString()}원</Text>
              <Text style={styles.feeItem}>
                {deliveryFee.sizeFee > 0
                  ? `크기: ${deliveryFee.sizeFee.toLocaleString()}원`
                  : '크기: 추가요금 없음'}
              </Text>
              {deliveryFee.urgencyFee && deliveryFee.urgencyFee > 0 && (
                <Text style={styles.feeItemUrgency}>긴급 surcharge: +{deliveryFee.urgencyFee.toLocaleString()}원</Text>
              )}
              <Text style={styles.feeItem}>서비스 수수료: {deliveryFee.serviceFee.toLocaleString()}원</Text>
              <Text style={styles.feeItem}>VAT: {deliveryFee.vat.toLocaleString()}원</Text>
              <Text style={styles.feeItemNote}>
                합계 = (기본+거리+무게+크기+긴급+운임+수수료) + VAT
              </Text>
              <View style={styles.auctionInfo}>
                <Text style={styles.auctionLabel}>경매 시작가</Text>
                <Text style={styles.auctionPrice}>{deliveryFee.totalFee.toLocaleString()}원부터</Text>
                <Text style={styles.auctionDesc}>길러들이 더 빠른 배송을 위해 입찰할 수 있습니다</Text>
              </View>
            </View>
          </>
        )}
      </View>

    </View>
  );

  const renderStep5 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle} accessibilityLabel="5단계, 추가 정보">추가 정보</Text>
      <Text style={styles.stepDesc}>만날 장소와 보관 방법을 입력해주세요. (선택 사항)</Text>

      <Text style={styles.label}>만날 장소 상세</Text>
      <Text style={styles.hintText}>픽업할 정확한 위치를 알려주세요. (예: 1번 출구, 편의점 앞)</Text>
      <TextInput
        style={[styles.input, styles.textArea, errors.pickupLocationDetail && styles.inputError]}
        value={pickupLocationDetail}
        onChangeText={(text) => {
          setPickupLocationDetail(text);
          if (errors.pickupLocationDetail) {
            setErrors(prev => ({ ...prev, pickupLocationDetail: '' }));
          }
        }}
        placeholder="만날 장소를 상세하게 입력해주세요 (선택)"
        placeholderTextColor={Colors.gray500}
        multiline
        numberOfLines={3}
        maxLength={100}
        accessibilityLabel="만날 장소 상세 입력"
      />
      {errors.pickupLocationDetail && <Text style={styles.errorText}>{errors.pickupLocationDetail}</Text>}
      <Text style={styles.charCount}>{pickupLocationDetail.length}/100</Text>

      <Text style={styles.label}>보관 위치</Text>
      <Text style={styles.hintText}>물건을 보관할 곳을 지정해주세요. (예: 역사물 보관함, 사물함)</Text>
      <TouchableOpacity
        style={styles.lockerGuideButton}
        onPress={() => navigation.navigate('LockerMap')}
        accessibilityLabel="사물함 지도 열기"
      >
        <Text style={styles.lockerGuideButtonText}>근처 사물함 지도에서 확인하기</Text>
      </TouchableOpacity>
      <TextInput
        style={[styles.input, styles.textArea, errors.storageLocation && styles.inputError]}
        value={storageLocation}
        onChangeText={(text) => {
          setStorageLocation(text);
          if (errors.storageLocation) {
            setErrors(prev => ({ ...prev, storageLocation: '' }));
          }
        }}
        placeholder="보관 위치를 입력해주세요 (선택)"
        placeholderTextColor={Colors.gray500}
        multiline
        numberOfLines={2}
        maxLength={100}
        accessibilityLabel="보관 위치 입력"
      />
      {errors.storageLocation && <Text style={styles.errorText}>{errors.storageLocation}</Text>}
      <Text style={styles.charCount}>{storageLocation.length}/100</Text>

      <Text style={styles.label}>특이사항</Text>
      <Text style={styles.hintText}>길러가 알아야 할 특별한 사항을 적어주세요.</Text>
      <TextInput
        style={[styles.input, styles.textArea, errors.specialInstructions && styles.inputError]}
        value={specialInstructions}
        onChangeText={(text) => {
          setSpecialInstructions(text);
          if (errors.specialInstructions) {
            setErrors(prev => ({ ...prev, specialInstructions: '' }));
          }
        }}
        placeholder="특이사항을 입력해주세요 (선택)"
        placeholderTextColor={Colors.gray500}
        multiline
        numberOfLines={4}
        maxLength={200}
        accessibilityLabel="특이사항 입력"
      />
      {errors.specialInstructions && <Text style={styles.errorText}>{errors.specialInstructions}</Text>}
      <Text style={styles.charCount}>{specialInstructions.length}/200</Text>

      <View style={styles.noteCard}>
        <Text style={styles.noteIcon}>i</Text>
        <Text style={styles.noteText}>
          이 모든 정보는 선택 사항입니다. 필요한 경우에만 입력해주세요.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.nextButton, styles.submitButton, (!pickupStation || !deliveryStation || !deliveryFee || fareStatus !== 'ok') && styles.disabledButton]}
        onPress={handleSubmit}
        disabled={loading || !pickupStation || !deliveryStation || !deliveryFee || fareStatus !== 'ok'}
        accessibilityLabel="배송 요청 제출"
        accessibilityHint="배송 요청을 제출합니다"
      >
        {loading ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.nextButtonText}>
            {isRetrying ? '재시도 중...' : '요청하기'}
          </Text>
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
      <View style={[styles.progressLine, currentStep >= 5 && styles.progressLineActive]} />
      <View style={styles.progressDot}>
        <View style={[styles.dot, currentStep >= 5 && styles.dotActive]} />
        <Text style={[styles.progressLabel, currentStep >= 5 && styles.progressLabelActive]}>
          추가
        </Text>
      </View>
    </View>
  );

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
      <AppTopBar title="새 배송 요청" onBack={handleBack} />

      {renderProgressBar()}

      <ScrollView style={styles.content}>
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
        {currentStep === 5 && renderStep5()}
      </ScrollView>

      {currentStep < 5 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleNext}
            accessibilityLabel="다음 단계"
          >
            <Text style={styles.nextButtonText}>다음</Text>
          </TouchableOpacity>
        </View>
      )}

      <OptimizedStationSelectModal
        visible={showStationPicker}
        onClose={() => setShowStationPicker(false)}
        stations={stations}
        onSelectStation={(station) => {
          setErrors(prev => ({ ...prev, pickupStation: '', deliveryStation: '' }));
          
          if (pickerType === 'pickup') {
            setPickupStation(station);
          } else {
            setDeliveryStation(station);
          }
          setShowStationPicker(false);
        }}
        title={pickerType === 'pickup' ? '픽업 역 선택' : '배송 역 선택'}
      />

      {/* Draft restore modal */}
      {showDraftRestore && (
        <View style={styles.draftModalOverlay}>
          <View style={styles.draftModal}>
            <Text style={styles.draftModalTitle}>이전 작업 내역이 있습니다</Text>
            <Text style={styles.draftModalText}>
              이전에 작성 중이던 배송 요청 내역이 있습니다. 이어서 작성하시겠습니까?
            </Text>
            <View style={styles.draftModalButtons}>
              <TouchableOpacity
                style={styles.draftModalButtonSecondary}
                onPress={discardDraft}
              >
                <Text style={styles.draftModalButtonTextSecondary}>삭제</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.draftModalButton}
                onPress={restoreDraft}
              >
                <Text style={styles.draftModalButtonText}>이어서 작성</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
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
    inputButtonError: {
      borderColor: colors.error,
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
    inputError: {
      borderColor: colors.error,
    },
    errorText: {
      color: colors.error,
      fontSize: typo.fontSize.sm,
      marginTop: space.xs,
    },
    textArea: {
      height: 80,
      textAlignVertical: 'top',
    },
    charCount: {
      color: colors.gray500,
      fontSize: typo.fontSize.xs,
      textAlign: 'right',
      marginTop: space.xs,
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
    infoSubText: {
      color: colors.gray600,
      fontSize: typo.fontSize.xs,
      marginTop: space.xs,
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
    feeItemNote: {
      color: colors.gray500,
      fontSize: typo.fontSize.xs,
      marginTop: space.xs,
    },
    feeItemUrgency: {
      color: colors.accent,
      fontSize: typo.fontSize.sm,
      marginBottom: space.xs,
    },
    auctionInfo: {
      backgroundColor: colors.primaryLight,
      borderRadius: radius.md,
      marginTop: space.sm,
      padding: space.md,
    },
    auctionLabel: {
      color: colors.primaryDark,
      fontSize: typo.fontSize.sm,
      fontWeight: typo.fontWeight.semibold,
      marginBottom: space.xs,
    },
    auctionPrice: {
      color: colors.primary,
      fontSize: typo.fontSize.xl,
      fontWeight: typo.fontWeight.bold,
      marginBottom: space.xs,
    },
    auctionDesc: {
      color: colors.textSecondary,
      fontSize: typo.fontSize.xs,
    },
    warningCard: {
      backgroundColor: colors.warningLight,
      borderColor: colors.warning,
      borderRadius: radius.md,
      borderWidth: 1,
      marginTop: space.lg,
      padding: space.md,
    },
    warningTitle: {
      color: colors.warningDark,
      fontSize: typo.fontSize.sm,
      fontWeight: typo.fontWeight.bold,
      marginBottom: space.xs,
    },
    warningText: {
      color: colors.warningDark,
      fontSize: typo.fontSize.xs,
      lineHeight: 18,
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
    disabledButton: {
      backgroundColor: colors.gray300,
      opacity: 0.6,
    },
    submitButton: {
      backgroundColor: colors.secondary,
      marginTop: space.lg,
    },
    hintText: {
      color: colors.gray500,
      fontSize: typo.fontSize.sm,
      marginBottom: space.sm,
    },
    lockerGuideButton: {
      borderColor: colors.primary,
      borderRadius: radius.md,
      borderWidth: 1,
      marginBottom: space.sm,
      paddingHorizontal: space.md,
      paddingVertical: space.sm,
    },
    lockerGuideButtonText: {
      color: colors.primary,
      fontSize: typo.fontSize.sm,
      fontWeight: typo.fontWeight.semibold,
      textAlign: 'center',
    },
    noteCard: {
      alignItems: 'center',
      backgroundColor: colors.infoLight,
      borderRadius: radius.md,
      flexDirection: 'row',
      marginTop: space.xxl,
      padding: space.md,
    },
    noteIcon: {
      fontSize: typo.fontSize.xl,
      marginRight: space.sm,
    },
    noteText: {
      color: colors.infoDark,
      flex: 1,
      fontSize: typo.fontSize.sm,
    },
    loadingContainer: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: typo.fontSize.base,
      marginTop: space.md,
    },
    draftModalOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    },
    draftModal: {
      backgroundColor: colors.white,
      borderRadius: radius.lg,
      padding: space.xl,
      width: '85%',
    },
    draftModalTitle: {
      color: colors.textPrimary,
      fontSize: typo.fontSize.xl,
      fontWeight: typo.fontWeight.bold,
      marginBottom: space.md,
    },
    draftModalText: {
      color: colors.textSecondary,
      fontSize: typo.fontSize.base,
      marginBottom: space.xl,
    },
    draftModalButtons: {
      flexDirection: 'row',
      gap: space.md,
    },
    draftModalButton: {
      flex: 1,
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      padding: space.md,
    },
    draftModalButtonText: {
      color: colors.white,
      fontSize: typo.fontSize.base,
      fontWeight: typo.fontWeight.bold,
    },
    draftModalButtonSecondary: {
      flex: 1,
      alignItems: 'center',
      backgroundColor: colors.gray200,
      borderRadius: radius.md,
      padding: space.md,
    },
    draftModalButtonTextSecondary: {
      color: colors.textSecondary,
      fontSize: typo.fontSize.base,
      fontWeight: typo.fontWeight.semibold,
    },
    depositInfoCard: {
      backgroundColor: colors.accentLight,
      borderRadius: radius.md,
      padding: space.md,
      marginTop: space.md,
    },
    depositInfoTitle: {
      fontSize: typo.fontSize.sm,
      fontWeight: typo.fontWeight.bold,
      color: colors.accent,
      marginBottom: space.xs,
    },
    depositInfoText: {
      fontSize: typo.fontSize.sm,
      color: colors.textPrimary,
      marginBottom: space.xs,
    },
    depositInfoNote: {
      fontSize: typo.fontSize.xs,
      color: colors.gray500,
      marginTop: space.sm,
    },
    manualAdjustmentCard: {
      backgroundColor: colors.warningLight,
      borderRadius: radius.md,
      padding: space.lg,
      marginTop: space.lg,
    },
    manualAdjustmentTitle: {
      fontSize: typo.fontSize.base,
      fontWeight: typo.fontWeight.bold,
      color: colors.warningDark,
      marginBottom: space.sm,
    },
    manualAdjustmentDesc: {
      fontSize: typo.fontSize.sm,
      color: colors.textSecondary,
      marginBottom: space.md,
    },
    adjustmentButtons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: space.sm,
      marginBottom: space.md,
    },
    adjustmentButton: {
      backgroundColor: colors.white,
      borderColor: colors.gray300,
      borderRadius: radius.md,
      borderWidth: 1,
      paddingHorizontal: space.md,
      paddingVertical: space.sm,
    },
    adjustmentButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    adjustmentButtonText: {
      fontSize: typo.fontSize.sm,
      color: colors.textPrimary,
    },
    adjustmentButtonTextActive: {
      color: colors.white,
      fontWeight: typo.fontWeight.semibold,
    },
    manualInput: {
      marginTop: space.sm,
    },
    feeBreakdownPreview: {
      backgroundColor: colors.white,
      borderRadius: radius.sm,
      padding: space.md,
      marginTop: space.md,
      marginBottom: space.sm,
    },
    feeBreakdownText: {
      fontSize: typo.fontSize.sm,
      color: colors.textSecondary,
      marginBottom: space.xs,
    },
    feeBreakdownNote: {
      fontSize: typo.fontSize.xs,
      color: colors.gray500,
      marginTop: space.xs,
    },
    feeBreakdownUrgency: {
      fontSize: typo.fontSize.sm,
      color: colors.accent,
      fontWeight: typo.fontWeight.semibold,
      marginBottom: space.xs,
    },
    feeBreakdownManual: {
      fontSize: typo.fontSize.sm,
      color: colors.warning,
      fontWeight: typo.fontWeight.semibold,
      marginBottom: space.xs,
    },
    feePreviewNote: {
      fontSize: typo.fontSize.xs,
      color: colors.gray500,
      fontStyle: 'italic',
      marginTop: space.xs,
    },
  });
}
