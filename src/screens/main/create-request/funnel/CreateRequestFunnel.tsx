import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, Image, ActivityIndicator } from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { useCreateRequestStore } from '../store/useCreateRequestStore';
import { Colors, Spacing, BorderRadius } from '../../../../theme';
import { Typography } from '../../../../theme/typography';
import { Chip } from '../components/Chip';
import type { SavedAddress } from '../../../../types/profile';
import type { Beta1AIAnalysisResponse } from '../../../../services/beta1-ai-service';
import type { Beta1QuoteCard } from '../../../../services/beta1-orchestration-service';
import { formatDetailedAddress } from '../../../../services/beta1-orchestration-leg-service';
import { QuoteBreakdownRow } from '../components/QuoteBreakdownRow';
import TimePicker from '../../../../components/common/TimePicker';
import type { PackageSize } from '../types';

const CLEAN_SIZE_OPTIONS: Array<{ value: PackageSize; label: string }> = [
  { value: 'small', label: '서류/소형 (최대 3kg)' },
  { value: 'medium', label: '중형 (최대 5kg)' },
  { value: 'large', label: '대형 (최대 10kg)' },
];

type Props = {
  savedAddresses: SavedAddress[];
  recentAddresses: SavedAddress[];
  setAddressTarget: (target: 'pickup' | 'delivery' | null) => void;
  resolvingAddressStation: 'pickup' | 'delivery' | null;
  handleRecommendStationFromAddress: (target: 'pickup' | 'delivery', address: string) => void;
  setPickerType: (type: 'pickup' | 'delivery') => void;
  setPickerVisible: (visible: boolean) => void;
  resolvingLocation: boolean;
  handleUseCurrentLocation: (target: 'pickup' | 'delivery') => void;
  
  handleUploadPhotoFromCamera: () => Promise<void>;
  handleUploadPhotoFromLibrary: () => Promise<void>;
  handleAI: () => Promise<void>;
  aiResult: Beta1AIAnalysisResponse | null;
  setReservationCalendarVisible: (visible: boolean) => void;
  
  setLockerLocatorTarget: (target: 'pickup' | 'dropoff' | null) => void;
  
  quotes: Beta1QuoteCard[];
  missingItems: string[];
  submitDisabled: boolean;
  handleSubmit: () => Promise<void>;
  saving: boolean;
  
  recipientPrivacyConfig: any;
  
  // Phone Verification Props
  contactPhoneNumber: string;
  handleContactPhoneChange: (text: string) => void;
  handleRequestContactOtp: () => Promise<void>;
  handleVerifyContactOtp: () => Promise<void>;
  contactOtpCode: string;
  setContactOtpCode: (code: string) => void;
  isPhoneVerified: boolean;
  otpSending: boolean;
  otpVerifying: boolean;
};

export default function CreateRequestFunnel(props: Props) {
  const store = useCreateRequestStore();
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Funnel Step State
  // 0: requestMode (now/reservation)
  // 1: pickupMode (address/station)
  // 2: pickupLocation (input)
  // 3: pickupLocker (only if station)
  // 4: deliveryMode (address/station)
  // 5: deliveryLocation (input)
  // 6: deliveryLocker (only if station)
  // 7: itemInfo (photo, name, size, weight)
  // 8: recipientInfo (name, phone)
  // 9: quote & submit
  const [currentStep, setCurrentStep] = useState(0);

  // Automatically derive directMode based on current selections
  useEffect(() => {
    // directMode 추론
    if (store.usePickupLocker || store.useDropoffLocker) {
      store.setDirectMode('locker_assisted');
    } else if (store.pickupMode === 'station' && store.deliveryMode === 'station') {
      store.setDirectMode('requester_to_station');
    } else {
      store.setDirectMode('none');
    }
  }, [
    store.pickupMode,
    store.usePickupLocker,
    store.deliveryMode,
    store.useDropoffLocker,
  ]);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const advanceTo = (step: number) => {
    if (currentStep < step) {
      setCurrentStep(step);
      scrollToBottom();
    }
  };

  const goToStep = (step: number) => {
    setCurrentStep(step);
  };

  // Render Helpers
  const renderQuestionBox = (
    index: number,
    question: string,
    content: React.ReactNode,
    isActive: boolean
  ) => {
    if (currentStep < index) return null;
    const isPast = currentStep > index;

    return (
      <Animated.View
        key={index}
        entering={FadeInDown.duration(400).delay(100)}
        layout={Layout.springify()}
        style={[styles.questionBox, isPast && styles.pastQuestionBox]}
      >
        <View style={styles.questionHeader}>
          <Text style={styles.questionText}>{question}</Text>
          {isPast && (
            <TouchableOpacity onPress={() => goToStep(index)} style={styles.editButton}>
              <Text style={styles.editButtonText}>수정</Text>
            </TouchableOpacity>
          )}
        </View>
        <View pointerEvents={isActive ? 'auto' : 'none'}>{content}</View>
      </Animated.View>
    );
  };

  const renderRequestMode = () => {
    return renderQuestionBox(
      0,
      '언제 보내실 건가요?',
      <View style={styles.row}>
        <Chip
          label="지금 당장 출발"
          active={store.requestMode === 'immediate'}
          onPress={() => {
            store.setRequestMode('immediate');
            store.setUrgency('fast');
            advanceTo(1);
          }}
        />
        <Chip
          label="예약하기"
          active={store.requestMode === 'reservation'}
          onPress={() => {
            store.setRequestMode('reservation');
            store.setUrgency('normal');
            props.setReservationCalendarVisible(true);
            advanceTo(1);
          }}
        />
      </View>,
      currentStep === 0
    );
  };

  const renderPickupMode = () => {
    return renderQuestionBox(
      1,
      '물건은 어디서 출발하나요?',
      <View style={{ gap: Spacing.sm }}>
        <Chip
          label="받는 분(길러)이 출발지로 직접 방문"
          active={store.pickupMode === 'address'}
          onPress={() => {
            store.setPickupMode('address');
            store.setUsePickupLocker(false);
            store.setPickupLockerId(null);
            store.setPickupLockerFee(null);
            advanceTo(2);
          }}
        />
        <Chip
          label="출발역에서 길러를 만나서 전달"
          active={store.pickupMode === 'station' && !store.usePickupLocker}
          onPress={() => {
            store.setPickupMode('station');
            store.setUsePickupLocker(false);
            store.setPickupLockerId(null);
            store.setPickupLockerFee(null);
            advanceTo(2);
          }}
        />
        <Chip
          label="출발역 사물함에 미리 보관 (비대면)"
          active={store.pickupMode === 'station' && store.usePickupLocker}
          onPress={() => {
            store.setPickupMode('station');
            store.setUsePickupLocker(true);
            advanceTo(2);
          }}
        />
      </View>,
      currentStep === 1
    );
  };

  const renderPickupLocation = () => {
    const isAddress = store.pickupMode === 'address';
    const hasRoadAddress = !!store.pickupRoadAddress;
    const hasStation = !!store.pickupStation;
    const hasValue = isAddress ? (hasRoadAddress && hasStation) : hasStation;
    const valueText = isAddress
      ? store.pickupRoadAddress ? formatDetailedAddress(store.pickupRoadAddress, store.pickupDetailAddress) : ''
      : store.pickupStation?.stationName || '';

    return renderQuestionBox(
      2,
      isAddress ? '출발지 주소를 알려주세요.' : '어느 역에서 출발하나요?',
      <View style={{ gap: Spacing.sm }}>
        <TouchableOpacity
          style={styles.inputBox}
          onPress={() => {
            if (isAddress) props.setAddressTarget('pickup');
            else { props.setPickerType('pickup'); props.setPickerVisible(true); }
          }}
        >
          <Text style={{ color: hasRoadAddress || (!isAddress && hasStation) ? Colors.textPrimary : Colors.textSecondary }}>
            {isAddress 
              ? (store.pickupRoadAddress || '주소 검색하기') 
              : (store.pickupStation?.stationName || '지하철역 검색하기')}
          </Text>
        </TouchableOpacity>

        {isAddress && hasRoadAddress && (
          <TextInput
            style={styles.inputBox}
            placeholder="상세 주소 (동, 호수)"
            value={store.pickupDetailAddress}
            onChangeText={store.setPickupDetailAddress}
          />
        )}

        {props.resolvingAddressStation === 'pickup' && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.loadingText}>가까운 지하철역을 찾는 중입니다...</Text>
          </View>
        )}

        {!isAddress && (
          <TouchableOpacity 
            style={styles.currentLocationButton} 
            onPress={() => props.handleUseCurrentLocation('pickup')}
            disabled={props.resolvingLocation}
          >
            <MaterialIcons name="my-location" size={18} color={Colors.primary} />
            <Text style={styles.currentLocationText}>
              {props.resolvingLocation ? '현재 위치 확인 중...' : '현재 내 위치 기준으로 역 찾기'}
            </Text>
          </TouchableOpacity>
        )}

        {isAddress && hasRoadAddress && !hasStation && props.resolvingAddressStation !== 'pickup' && (
          <Text style={styles.errorText}>인근에 서비스 가능한 지하철역이 없습니다. 다른 주소를 선택해주세요.</Text>
        )}

        {hasValue && currentStep === 2 && (
          <TouchableOpacity style={styles.nextButton} onPress={() => advanceTo(isAddress ? 4 : 3)}>
            <Text style={styles.nextButtonText}>다음</Text>
          </TouchableOpacity>
        )}
      </View>,
      currentStep === 2
    );
  };

  const renderPickupLocker = () => null; // Removed

  const renderDeliveryMode = () => {
    return renderQuestionBox(
      3,
      '어디로 보내시나요?',
      <View style={{ gap: Spacing.sm }}>
        <Chip
          label="길러가 도착지로 직접 방문"
          active={store.deliveryMode === 'address'}
          onPress={() => {
            store.setDeliveryMode('address');
            store.setUseDropoffLocker(false);
            store.setDropoffLockerId(null);
            store.setDropoffLockerFee(null);
            advanceTo(4);
          }}
        />
        <Chip
          label="도착역에서 길러가 수령인에게 전달"
          active={store.deliveryMode === 'station' && !store.useDropoffLocker}
          onPress={() => {
            store.setDeliveryMode('station');
            store.setUseDropoffLocker(false);
            store.setDropoffLockerId(null);
            store.setDropoffLockerFee(null);
            advanceTo(4);
          }}
        />
        <Chip
          label="도착역 사물함에 보관 (비대면)"
          active={store.deliveryMode === 'station' && store.useDropoffLocker}
          onPress={() => {
            store.setDeliveryMode('station');
            store.setUseDropoffLocker(true);
            advanceTo(4);
          }}
        />
      </View>,
      currentStep === 3
    );
  };

  const renderDeliveryLocation = () => {
    const isAddress = store.deliveryMode === 'address';
    const hasRoadAddress = !!store.deliveryRoadAddress;
    const hasStation = !!store.deliveryStation;
    const hasValue = isAddress ? (hasRoadAddress && hasStation) : hasStation;
    const valueText = isAddress
      ? store.deliveryRoadAddress ? formatDetailedAddress(store.deliveryRoadAddress, store.deliveryDetailAddress) : ''
      : store.deliveryStation?.stationName || '';

    return renderQuestionBox(
      4,
      isAddress ? '도착지 주소를 알려주세요.' : '어느 역으로 도착하나요?',
      <View style={{ gap: Spacing.sm }}>
        <TouchableOpacity
          style={styles.inputBox}
          onPress={() => {
            if (isAddress) props.setAddressTarget('delivery');
            else { props.setPickerType('delivery'); props.setPickerVisible(true); }
          }}
        >
          <Text style={{ color: hasRoadAddress || (!isAddress && hasStation) ? Colors.textPrimary : Colors.textSecondary }}>
            {isAddress 
              ? (store.deliveryRoadAddress || '주소 검색하기') 
              : (store.deliveryStation?.stationName || '지하철역 검색하기')}
          </Text>
        </TouchableOpacity>

        {isAddress && hasRoadAddress && (
          <TextInput
            style={styles.inputBox}
            placeholder="상세 주소 (동, 호수)"
            value={store.deliveryDetailAddress}
            onChangeText={store.setDeliveryDetailAddress}
          />
        )}

        {props.resolvingAddressStation === 'delivery' && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.loadingText}>가까운 지하철역을 찾는 중입니다...</Text>
          </View>
        )}

        {!isAddress && (
          <TouchableOpacity 
            style={styles.currentLocationButton} 
            onPress={() => props.handleUseCurrentLocation('delivery')}
            disabled={props.resolvingLocation}
          >
            <MaterialIcons name="my-location" size={18} color={Colors.primary} />
            <Text style={styles.currentLocationText}>
              {props.resolvingLocation ? '현재 위치 확인 중...' : '현재 내 위치 기준으로 역 찾기'}
            </Text>
          </TouchableOpacity>
        )}

        {isAddress && hasRoadAddress && !hasStation && props.resolvingAddressStation !== 'delivery' && (
          <Text style={styles.errorText}>인근에 서비스 가능한 지하철역이 없습니다. 다른 주소를 선택해주세요.</Text>
        )}

        {hasValue && currentStep === 4 && (
          <TouchableOpacity style={styles.nextButton} onPress={() => advanceTo(5)}>
            <Text style={styles.nextButtonText}>다음</Text>
          </TouchableOpacity>
        )}
      </View>,
      currentStep === 4
    );
  };

  const renderDeliveryLocker = () => null; // Removed

  const renderItemInfo = () => {
    const hasValue = !!store.packageItemName && !!store.packageDescription && !!store.packageSize && !!store.weightKg;

    return renderQuestionBox(
      5,
      '어떤 물건인가요?',
      <View style={{ gap: Spacing.md }}>
        {/* 예약 시간 입력 (예약 모드일 때만) */}
        {store.requestMode === 'reservation' && (
          <View>
            <Text style={styles.label}>예약 날짜</Text>
        <TouchableOpacity 
          style={[styles.inputBox, { marginBottom: Spacing.sm }]} 
          onPress={() => props.setReservationCalendarVisible(true)}
        >
          <Text style={{ color: store.preferredPickupDate ? Colors.textPrimary : Colors.textSecondary }}>
            {store.preferredPickupDate || '날짜 선택하기'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.label}>희망 픽업 시간</Text>
        <View style={{ marginBottom: Spacing.sm }}>
          <TimePicker
            value={store.preferredPickupTime}
            onChange={store.setPreferredPickupTime}
            placeholder="시간을 선택하세요"
          />
        </View>
          </View>
        )}

        {/* 사진 업로드 */}
        <View style={styles.row}>
          <TouchableOpacity style={styles.photoButton} onPress={props.handleUploadPhotoFromCamera}>
            <MaterialIcons name="camera-alt" size={24} color={Colors.textPrimary} />
            <Text style={styles.photoButtonText}>사진 촬영</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoButton} onPress={props.handleUploadPhotoFromLibrary}>
            <MaterialIcons name="photo-library" size={24} color={Colors.textPrimary} />
            <Text style={styles.photoButtonText}>앨범 선택</Text>
          </TouchableOpacity>
        </View>
        {store.photoUrl ? <Image source={{ uri: store.photoUrl }} style={styles.previewImage} /> : null}

        {/* 물품명 */}
        <Text style={styles.label}>물품명</Text>
        <TextInput
          style={styles.inputBox}
          placeholder="물품명 (예: 노트북, 케이크)"
          value={store.packageItemName}
          onChangeText={store.setPackageItemName}
        />

        {/* 상세 설명 */}
        <Text style={styles.label}>상세 설명</Text>
        <TextInput
          style={[styles.inputBox, { height: 80, textAlignVertical: 'top' }]}
          placeholder="물품에 대한 상세 설명"
          multiline
          value={store.packageDescription}
          onChangeText={store.setPackageDescription}
        />

        {/* 물품 가치 */}
        <Text style={styles.label}>물품 가치 (보상 기준점)</Text>
        <TextInput
          style={styles.inputBox}
          placeholder="가치 입력 (원)"
          keyboardType="numeric"
          value={store.itemValue ? store.itemValue.toString() : ''}
          onChangeText={(text) => store.setItemValue(text.replace(/[^0-9]/g, ''))}
        />

        {/* 크기 선택 */}
        <Text style={styles.label}>크기</Text>
        <View style={styles.row}>
          {CLEAN_SIZE_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              label={opt.label}
              active={store.packageSize === opt.value}
              onPress={() => store.setPackageSize(opt.value)}
            />
          ))}
        </View>

        {/* 무게 입력 */}
        <Text style={styles.label}>무게 (kg)</Text>
        <TextInput
          style={styles.inputBox}
          placeholder="무게 입력 (kg)"
          keyboardType="numeric"
          value={store.weightKg || ''}
          onChangeText={(text) => store.setWeightKg(text.replace(/[^0-9.]/g, ''))}
        />

        {hasValue && currentStep === 5 && (
          <TouchableOpacity style={styles.nextButton} onPress={() => advanceTo(6)}>
            <Text style={styles.nextButtonText}>다음</Text>
          </TouchableOpacity>
        )}
      </View>,
      currentStep === 5
    );
  };

  const renderRecipientInfo = () => {
    const hasValue = !!store.recipientName && !!store.recipientPhone && store.recipientConsentChecked && props.isPhoneVerified;

    return renderQuestionBox(
      6,
      '누구에게 전달하나요?',
      <View style={{ gap: Spacing.md }}>
        <Text style={styles.label}>상세 픽업 위치</Text>
        <TextInput
          style={styles.inputBox}
          placeholder="출발지 상세 위치 설명 (예: 1번 출구 앞)"
          value={store.pickupLocationDetail}
          onChangeText={store.setPickupLocationDetail}
        />

        <Text style={styles.label}>수령인 이름</Text>
        <TextInput
          style={styles.inputBox}
          placeholder="수령인 이름"
          value={store.recipientName}
          onChangeText={store.setRecipientName}
        />

        <Text style={styles.label}>수령인 연락처</Text>
        <TextInput
          style={styles.inputBox}
          placeholder="수령인 연락처 (010-0000-0000)"
          keyboardType="phone-pad"
          value={store.recipientPhone}
          onChangeText={store.setRecipientPhone}
        />

        {(props.recipientPrivacyConfig?.safeNumberEnabled || props.recipientPrivacyConfig?.thirdPartyConsentRequired) &&
        String(props.recipientPrivacyConfig?.guidance ?? '').trim() ? (
          <View style={styles.privacyNoticeBox}>
            <Text style={styles.privacyNoticeText}>{String(props.recipientPrivacyConfig.guidance).trim()}</Text>
            {String(props.recipientPrivacyConfig?.providerName ?? '').trim() ||
            String(props.recipientPrivacyConfig?.policyTitle ?? '').trim() ||
            String(props.recipientPrivacyConfig?.policyEffectiveDate ?? '').trim() ? (
              <Text style={styles.privacyNoticeMeta}>
                {[props.recipientPrivacyConfig?.providerName, props.recipientPrivacyConfig?.policyTitle]
                  .map((value) => String(value ?? '').trim())
                  .filter(Boolean)
                  .join(' · ')}
                {String(props.recipientPrivacyConfig?.policyEffectiveDate ?? '').trim()
                  ? ` (${String(props.recipientPrivacyConfig.policyEffectiveDate).trim()})`
                  : ''}
              </Text>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.label}>추가 요청사항</Text>
        <TextInput
          style={[styles.inputBox, { height: 80, textAlignVertical: 'top' }]}
          placeholder="길러에게 전달할 추가 요청사항 (선택)"
          multiline
          value={store.specialInstructions}
          onChangeText={store.setSpecialInstructions}
        />

        {/* 본인 인증 (Phone Verification) */}
        <Text style={styles.label}>보내는 분(본인) 연락처 인증</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.inputBox, { flex: 1 }]}
            placeholder="본인 연락처 (010-0000-0000)"
            keyboardType="phone-pad"
            value={props.contactPhoneNumber}
            onChangeText={props.handleContactPhoneChange}
            editable={!props.isPhoneVerified}
          />
          <TouchableOpacity 
            style={[styles.nextButton, { marginTop: 0, justifyContent: 'center' }]} 
            onPress={props.handleRequestContactOtp}
            disabled={props.isPhoneVerified || props.otpSending || !props.contactPhoneNumber}
          >
            <Text style={styles.nextButtonText}>
              {props.isPhoneVerified ? '인증완료' : (props.otpSending ? '전송중...' : '인증요청')}
            </Text>
          </TouchableOpacity>
        </View>

        {!props.isPhoneVerified && props.contactPhoneNumber ? (
          <View style={styles.row}>
            <TextInput
              style={[styles.inputBox, { flex: 1 }]}
              placeholder="인증번호 6자리"
              keyboardType="number-pad"
              value={props.contactOtpCode}
              onChangeText={props.setContactOtpCode}
            />
            <TouchableOpacity 
              style={[styles.nextButton, { marginTop: 0, justifyContent: 'center' }]} 
              onPress={props.handleVerifyContactOtp}
              disabled={props.otpVerifying || !props.contactOtpCode}
            >
              <Text style={styles.nextButtonText}>
                {props.otpVerifying ? '확인중...' : '확인'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {props.recipientPrivacyConfig?.thirdPartyConsentRequired && (
          <TouchableOpacity
            style={styles.consentBox}
            onPress={() => store.setRecipientConsentChecked(!store.recipientConsentChecked)}
          >
            <MaterialIcons
              name={store.recipientConsentChecked ? 'check-box' : 'check-box-outline-blank'}
              size={24}
              color={store.recipientConsentChecked ? Colors.primary : Colors.gray400}
            />
            <Text style={styles.consentText}>개인정보 제3자 제공 동의 (필수)</Text>
          </TouchableOpacity>
        )}

        {hasValue && currentStep === 6 && (
          <TouchableOpacity style={styles.nextButton} onPress={() => advanceTo(7)}>
            <Text style={styles.nextButtonText}>다음</Text>
          </TouchableOpacity>
        )}
      </View>,
      currentStep === 6
    );
  };

  const renderQuote = () => {
    if (currentStep < 7) return null;

    const card = props.quotes.find((q) => q.quoteType === 'balanced') || props.quotes[0];
    if (!card) return null;

    const price = card.pricing.publicPrice;
    const finalPrice = Math.max(0, price); // Coupon/point logic simplified for funnel

    return (
      <Animated.View
        entering={FadeInDown.duration(400).delay(100)}
        layout={Layout.springify()}
        style={styles.quoteCard}
      >
        <View style={styles.questionHeader}>
          <Text style={styles.questionText}>최종 결제 내역을 확인해주세요.</Text>
        </View>
        
        <View style={styles.quoteBreakdown}>
          <QuoteBreakdownRow label="기본요금" value={card.pricing.baseFee} />
          <QuoteBreakdownRow label="거리요금" value={card.pricing.distanceFee} />
          {card.pricing.lockerFee > 0 && <QuoteBreakdownRow label="사물함" value={card.pricing.lockerFee} />}
          <View style={styles.quoteDivider} />
          <QuoteBreakdownRow label="최종 결제 금액" value={finalPrice} strong />
        </View>

        <TouchableOpacity 
          style={[styles.submitButton, props.submitDisabled && styles.disabledButton]} 
          disabled={props.submitDisabled || props.saving}
          onPress={props.handleSubmit}
        >
          <Text style={styles.submitButtonText}>
            {props.saving ? '접수 중...' : `${finalPrice.toLocaleString()}원 결제하고 배송 요청`}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <ScrollView 
      ref={scrollViewRef} 
      style={styles.container} 
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {renderRequestMode()}
      {renderPickupMode()}
      {renderPickupLocation()}
      {renderPickupLocker()}
      {renderDeliveryMode()}
      {renderDeliveryLocation()}
      {renderDeliveryLocker()}
      {renderItemInfo()}
      {renderRecipientInfo()}
      {renderQuote()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.xl, paddingBottom: 200, gap: Spacing.xl },
  questionBox: { marginBottom: Spacing.md },
  pastQuestionBox: { opacity: 0.4 },
  questionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  questionText: { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.extrabold, color: Colors.textPrimary, flex: 1 },
  editButton: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, backgroundColor: Colors.gray100, borderRadius: BorderRadius.sm },
  editButtonText: { color: Colors.primary, fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.bold },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  inputBox: { backgroundColor: Colors.surface, padding: Spacing.lg, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, fontSize: Typography.fontSize.base, color: Colors.textPrimary },
  nextButton: { marginTop: Spacing.md, backgroundColor: Colors.primary, padding: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center' },
  nextButtonText: { color: Colors.white, fontWeight: Typography.fontWeight.bold, fontSize: Typography.fontSize.base },
  photoButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.xs },
  photoButtonText: { fontSize: Typography.fontSize.sm, color: Colors.textPrimary, fontWeight: Typography.fontWeight.bold },
  previewImage: { width: '100%', height: 200, borderRadius: BorderRadius.md, marginTop: Spacing.sm },
  label: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.bold, color: Colors.textSecondary, marginBottom: Spacing.xs },
  selectedBox: { marginTop: Spacing.sm, padding: Spacing.md, backgroundColor: Colors.gray100, borderRadius: BorderRadius.md },
  selectedBoxText: { color: Colors.primary, fontWeight: Typography.fontWeight.bold, fontSize: Typography.fontSize.sm },
  quoteCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.xl, borderWidth: 2, borderColor: Colors.primary, marginTop: Spacing.xl },
  quoteBreakdown: { gap: Spacing.sm, marginTop: Spacing.md },
  quoteDivider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
  submitButton: { marginTop: Spacing.xl, backgroundColor: Colors.primary, padding: Spacing.xl, borderRadius: BorderRadius.lg, alignItems: 'center' },
  submitButtonText: { color: Colors.white, fontWeight: Typography.fontWeight.extrabold, fontSize: Typography.fontSize.lg },
  disabledButton: { opacity: 0.5 },
  consentBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.sm },
  consentText: { fontSize: Typography.fontSize.sm, color: Colors.textSecondary },
  privacyNoticeBox: { backgroundColor: Colors.gray100, borderRadius: BorderRadius.md, padding: Spacing.md },
  privacyNoticeText: { color: Colors.textSecondary, fontSize: Typography.fontSize.sm, lineHeight: 18 },
  privacyNoticeMeta: { color: Colors.gray500, fontSize: Typography.fontSize.xs, marginTop: Spacing.xs, lineHeight: 16 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs },
  loadingText: { color: Colors.primary, fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.bold },
  errorText: { color: Colors.error, fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.bold, marginTop: Spacing.xs },
  currentLocationButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: Spacing.md, backgroundColor: Colors.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.primary, borderStyle: 'dashed', gap: Spacing.xs, marginTop: Spacing.xs },
  currentLocationText: { color: Colors.primary, fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.bold },
});
