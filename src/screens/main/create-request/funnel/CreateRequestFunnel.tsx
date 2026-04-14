import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, Image } from 'react-native';
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
  handleRecommendStationFromAddress: (target: 'pickup' | 'delivery', address: string) => void;
  setPickerType: (type: 'pickup' | 'delivery') => void;
  setPickerVisible: (visible: boolean) => void;
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
    if (store.pickupLockerId || store.dropoffLockerId) {
      store.setDirectMode('locker_assisted');
    } else if (store.pickupMode === 'station') {
      store.setDirectMode('requester_to_station');
    } else {
      store.setDirectMode('none');
    }
  }, [store.pickupMode, store.pickupLockerId, store.dropoffLockerId]);

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

  // Render Helpers
  const renderQuestionBox = (
    index: number,
    question: string,
    content: React.ReactNode,
    isActive: boolean
  ) => {
    if (currentStep < index) return null;
    return (
      <Animated.View
        key={index}
        entering={FadeInDown.duration(400).delay(100)}
        layout={Layout.springify()}
        style={[styles.questionBox, !isActive && styles.pastQuestionBox]}
      >
        <Text style={styles.questionText}>{question}</Text>
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
      <View style={styles.row}>
        <Chip
          label="계신 곳(주소)에서 픽업"
          active={store.pickupMode === 'address'}
          onPress={() => {
            store.setPickupMode('address');
            store.setPickupLockerId(null);
            store.setPickupLockerFee(null);
            advanceTo(2);
          }}
        />
        <Chip
          label="출발역으로 직접 이동"
          active={store.pickupMode === 'station'}
          onPress={() => {
            store.setPickupMode('station');
            advanceTo(2);
          }}
        />
      </View>,
      currentStep === 1
    );
  };

  const renderPickupLocation = () => {
    const isAddress = store.pickupMode === 'address';
    const hasValue = isAddress ? !!store.pickupRoadAddress : !!store.pickupStation;
    const valueText = isAddress
      ? store.pickupRoadAddress ? formatDetailedAddress(store.pickupRoadAddress, store.pickupDetailAddress) : ''
      : store.pickupStation?.stationName || '';

    return renderQuestionBox(
      2,
      isAddress ? '출발지 주소를 알려주세요.' : '어느 역에서 출발하나요?',
      <View>
        <TouchableOpacity
          style={styles.inputBox}
          onPress={() => {
            if (isAddress) props.setAddressTarget('pickup');
            else { props.setPickerType('pickup'); props.setPickerVisible(true); }
          }}
        >
          <Text style={{ color: hasValue ? Colors.textPrimary : Colors.textSecondary }}>
            {hasValue ? valueText : (isAddress ? '주소 검색하기' : '지하철역 검색하기')}
          </Text>
        </TouchableOpacity>
        {hasValue && currentStep === 2 && (
          <TouchableOpacity style={styles.nextButton} onPress={() => advanceTo(isAddress ? 4 : 3)}>
            <Text style={styles.nextButtonText}>다음</Text>
          </TouchableOpacity>
        )}
      </View>,
      currentStep === 2
    );
  };

  const renderPickupLocker = () => {
    if (store.pickupMode !== 'station') return null; // Skip if address
    const hasValue = !!store.pickupLockerId || store.directMode === 'requester_to_station';

    return renderQuestionBox(
      3,
      '출발역에서 어떻게 전달하실 건가요?',
      <View>
        <View style={styles.row}>
          <Chip
            label="직접 만나서 전달"
            active={!store.pickupLockerId}
            onPress={() => {
              store.setPickupLockerId(null);
              store.setPickupLockerFee(null);
              advanceTo(4);
            }}
          />
          <Chip
            label="사물함에 미리 보관"
            active={!!store.pickupLockerId}
            onPress={() => {
              props.setLockerLocatorTarget('pickup');
            }}
          />
        </View>
        {store.pickupLockerId && (
          <View style={styles.selectedBox}>
            <Text style={styles.selectedBoxText}>선택됨: {store.pickupStorageLocation}</Text>
          </View>
        )}
        {hasValue && currentStep === 3 && (
          <TouchableOpacity style={styles.nextButton} onPress={() => advanceTo(4)}>
            <Text style={styles.nextButtonText}>다음</Text>
          </TouchableOpacity>
        )}
      </View>,
      currentStep === 3
    );
  };

  const renderDeliveryMode = () => {
    return renderQuestionBox(
      4,
      '어디로 보내시나요?',
      <View style={styles.row}>
        <Chip
          label="받는 분 주소로 배송"
          active={store.deliveryMode === 'address'}
          onPress={() => {
            store.setDeliveryMode('address');
            store.setDropoffLockerId(null);
            store.setDropoffLockerFee(null);
            advanceTo(5);
          }}
        />
        <Chip
          label="도착역으로 배송"
          active={store.deliveryMode === 'station'}
          onPress={() => {
            store.setDeliveryMode('station');
            advanceTo(5);
          }}
        />
      </View>,
      currentStep === 4
    );
  };

  const renderDeliveryLocation = () => {
    const isAddress = store.deliveryMode === 'address';
    const hasValue = isAddress ? !!store.deliveryRoadAddress : !!store.deliveryStation;
    const valueText = isAddress
      ? store.deliveryRoadAddress ? formatDetailedAddress(store.deliveryRoadAddress, store.deliveryDetailAddress) : ''
      : store.deliveryStation?.stationName || '';

    return renderQuestionBox(
      5,
      isAddress ? '도착지 주소를 알려주세요.' : '어느 역으로 도착하나요?',
      <View>
        <TouchableOpacity
          style={styles.inputBox}
          onPress={() => {
            if (isAddress) props.setAddressTarget('delivery');
            else { props.setPickerType('delivery'); props.setPickerVisible(true); }
          }}
        >
          <Text style={{ color: hasValue ? Colors.textPrimary : Colors.textSecondary }}>
            {hasValue ? valueText : (isAddress ? '주소 검색하기' : '지하철역 검색하기')}
          </Text>
        </TouchableOpacity>
        {hasValue && currentStep === 5 && (
          <TouchableOpacity style={styles.nextButton} onPress={() => advanceTo(isAddress ? 7 : 6)}>
            <Text style={styles.nextButtonText}>다음</Text>
          </TouchableOpacity>
        )}
      </View>,
      currentStep === 5
    );
  };

  const renderDeliveryLocker = () => {
    if (store.deliveryMode !== 'station') return null; // Skip if address
    const hasValue = !!store.dropoffLockerId || store.directMode === 'requester_to_station' || store.directMode === 'none';

    return renderQuestionBox(
      6,
      '도착역에서 받는 분이 어떻게 수령하시나요?',
      <View>
        <View style={styles.row}>
          <Chip
            label="길러가 직접 전달"
            active={!store.dropoffLockerId}
            onPress={() => {
              store.setDropoffLockerId(null);
              store.setDropoffLockerFee(null);
              advanceTo(7);
            }}
          />
          <Chip
            label="도착역 사물함에 보관"
            active={!!store.dropoffLockerId}
            onPress={() => {
              props.setLockerLocatorTarget('dropoff');
            }}
          />
        </View>
        {store.dropoffLockerId && (
          <View style={styles.selectedBox}>
            <Text style={styles.selectedBoxText}>선택됨: {store.dropoffStorageLocation}</Text>
          </View>
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

  const renderItemInfo = () => {
    const hasValue = !!store.packageItemName && !!store.packageSize && !!store.weightKg;

    return renderQuestionBox(
      7,
      '어떤 물건인가요?',
      <View style={{ gap: Spacing.md }}>
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
        <TextInput
          style={styles.inputBox}
          placeholder="물품명 (예: 노트북, 케이크)"
          value={store.packageItemName}
          onChangeText={store.setPackageItemName}
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

        {hasValue && currentStep === 7 && (
          <TouchableOpacity style={styles.nextButton} onPress={() => advanceTo(8)}>
            <Text style={styles.nextButtonText}>다음</Text>
          </TouchableOpacity>
        )}
      </View>,
      currentStep === 7
    );
  };

  const renderRecipientInfo = () => {
    const hasValue = !!store.recipientName && !!store.recipientPhone && store.recipientConsentChecked;

    return renderQuestionBox(
      8,
      '누구에게 전달하나요?',
      <View style={{ gap: Spacing.md }}>
        <TextInput
          style={styles.inputBox}
          placeholder="수령인 이름"
          value={store.recipientName}
          onChangeText={store.setRecipientName}
        />
        <TextInput
          style={styles.inputBox}
          placeholder="수령인 연락처 (010-0000-0000)"
          keyboardType="phone-pad"
          value={store.recipientPhone}
          onChangeText={store.setRecipientPhone}
        />
        <TextInput
          style={[styles.inputBox, { height: 80, textAlignVertical: 'top' }]}
          placeholder="길러에게 전달할 추가 요청사항 (선택)"
          multiline
          value={store.specialInstructions}
          onChangeText={store.setSpecialInstructions}
        />

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

        {hasValue && currentStep === 8 && (
          <TouchableOpacity style={styles.nextButton} onPress={() => advanceTo(9)}>
            <Text style={styles.nextButtonText}>다음</Text>
          </TouchableOpacity>
        )}
      </View>,
      currentStep === 8
    );
  };

  const renderQuote = () => {
    if (currentStep < 9) return null;

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
        <Text style={styles.questionText}>최종 결제 내역을 확인해주세요.</Text>
        
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
  pastQuestionBox: { opacity: 0.5 },
  questionText: { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.extrabold, color: Colors.textPrimary, marginBottom: Spacing.md },
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
});