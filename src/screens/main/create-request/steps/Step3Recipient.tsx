import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StepContainer } from '../components/StepContainer';
import { Block } from '../components/Block';
import { Colors, Spacing, BorderRadius, Typography } from '../../../../theme';
import { useCreateRequestStore } from '../store/useCreateRequestStore';
import { SafeNumberIntegrationConfig } from '../../../../services/integration-config-service';

type Props = {
  setShowLockerLocator: (visible: boolean) => void;
  recipientPrivacyConfig: any;
  handleContactPhoneChange: (value: string) => void;
  hasLockedVerifiedPhone: boolean;
  isPhoneVerified: boolean;
  contactOtpCode: string;
  setContactOtpCode: (code: string) => void;
  contactOtpSessionId: string | null;
  contactOtpSending: boolean;
  contactOtpVerifying: boolean;
  contactOtpDestination: string;
  contactOtpExpiresAt: string | null;
  contactOtpHintCode: string | null;
  handleRequestContactOtp: () => Promise<void>;
  handleVerifyContactOtp: () => Promise<void>;
  onNavigateToProfile: () => void;
};

export function Step3Recipient({
  setShowLockerLocator,
  recipientPrivacyConfig,
  handleContactPhoneChange,
  hasLockedVerifiedPhone,
  isPhoneVerified,
  contactOtpCode,
  setContactOtpCode,
  contactOtpSessionId,
  contactOtpSending,
  contactOtpVerifying,
  contactOtpDestination,
  contactOtpExpiresAt,
  contactOtpHintCode,
  handleRequestContactOtp,
  handleVerifyContactOtp,
  onNavigateToProfile,
}: Props) {
  const store = useCreateRequestStore();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (store.activeStep === 3) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 400); // Wait for LayoutAnimation to complete
      return () => clearTimeout(timer);
    }
  }, [store.activeStep]);

  const formatPhoneNumber = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 7) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    if (cleaned.length <= 10) return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7, 11)}`;
  };

  return (
    <StepContainer 
      step={3} 
      currentStep={store.activeStep} 
      onNext={() => {
        if (!store.recipientName || !store.recipientPhone || !store.recipientConsentChecked) {
          Alert.alert('확인 필요', '수령인 정보와 개인정보 제공 동의를 완료해 주세요.');
          return;
        }
        if (!/^01\d-\d{3,4}-\d{4}$/.test(store.recipientPhone)) {
          Alert.alert('확인 필요', '올바른 휴대폰 번호 형식을 입력해 주세요. (예: 010-1234-5678)');
          return;
        }
        if (!isPhoneVerified) {
          Alert.alert('인증 필요', '휴대폰 본인 인증을 완료해 주세요.');
          return;
        }
        store.setActiveStep(4);
      }} 
      onPrev={() => store.setActiveStep(3)}
      nextLabel="견적 확인하기"
    >
      <Block title="인계와 수령 정보">
        <TextInput
          style={styles.input}
          value={store.pickupLocationDetail}
          onChangeText={store.setPickupLocationDetail}
          placeholder={
            store.directMode === 'requester_to_station'
              ? '만날 위치 안내'
              : '픽업 위치 안내'
          }
          placeholderTextColor={Colors.gray400}
        />
        {store.directMode === 'locker_assisted' ? (
          <TouchableOpacity
            style={[styles.input, { justifyContent: 'center' }]}
            onPress={() => setShowLockerLocator(true)}
          >
            <Text style={{ color: store.storageLocation ? Colors.gray900 : Colors.gray400 }}>
              {store.storageLocation || '보관할 사물함을 선택해 주세요'}
            </Text>
          </TouchableOpacity>
        ) : null}
        <TextInput
          style={[styles.input, styles.multilineInput]}
          value={store.specialInstructions}
          onChangeText={store.setSpecialInstructions}
          placeholder="추가 요청사항"
          placeholderTextColor={Colors.gray400}
          multiline
        />
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={store.recipientName}
          onChangeText={store.setRecipientName}
          placeholder="수령인 이름"
          placeholderTextColor={Colors.gray400}
        />
        <TextInput
          style={styles.input}
          value={store.recipientPhone}
          onChangeText={(text) => store.setRecipientPhone(formatPhoneNumber(text))}
          keyboardType="phone-pad"
          placeholder="수령인 연락처 (예: 010-1234-5678)"
          placeholderTextColor={Colors.gray400}
          maxLength={13}
        />
        <View style={styles.noticeBox}>
          <Text style={styles.noticeTitle}>개인정보 및 안심번호 안내</Text>
          <Text style={styles.noticeText}>• 보내는 분과 받는 분의 연락처는 보호됩니다.</Text>
          <Text style={styles.noticeText}>
            • {recipientPrivacyConfig.useVirtualNumber ? '안심번호' : '연락처'}가 배송원에게 제공되며,
            배송 완료 후 즉시 파기됩니다.
          </Text>
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => store.setRecipientConsentChecked(!store.recipientConsentChecked)}
          >
            <Ionicons
              name={store.recipientConsentChecked ? 'checkbox' : 'square-outline'}
              size={24}
              color={store.recipientConsentChecked ? Colors.primary : Colors.gray400}
            />
            <Text style={styles.checkboxText}>
              제3자(배송원) 정보 제공 및 연락처 수집에 동의합니다. (필수)
            </Text>
          </TouchableOpacity>
        </View>
      </Block>

      <Block title="휴대폰 인증">
        {hasLockedVerifiedPhone ? (
          <View style={styles.verifiedPhoneBox}>
            <Text style={styles.verifiedPhoneText}>
              ✅ {store.contactPhoneNumber} (인증됨)
            </Text>
            <TouchableOpacity onPress={onNavigateToProfile}>
              <Text style={styles.linkText}>번호 변경하기</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.otpRow}>
              <TextInput
                style={[styles.input, styles.flex1]}
                value={store.contactPhoneNumber}
                onChangeText={handleContactPhoneChange}
                keyboardType="phone-pad"
                placeholder="본인 명의 휴대폰 번호"
                placeholderTextColor={Colors.gray400}
              />
              <TouchableOpacity
                style={styles.otpButton}
                onPress={() => void handleRequestContactOtp()}
                disabled={contactOtpSending}
              >
                {contactOtpSending ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.otpButtonText}>
                    {contactOtpSessionId ? '재전송' : '인증 요청'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {contactOtpSessionId && !isPhoneVerified ? (
              <View style={styles.otpRow}>
                <TextInput
                  style={[styles.input, styles.flex1]}
                  value={contactOtpCode}
                  onChangeText={setContactOtpCode}
                  keyboardType="number-pad"
                  placeholder="인증번호 6자리"
                  placeholderTextColor={Colors.gray400}
                  maxLength={6}
                />
                <TouchableOpacity
                  style={[
                    styles.otpButton,
                    contactOtpCode.length < 6 && { backgroundColor: Colors.gray400 },
                  ]}
                  onPress={() => void handleVerifyContactOtp()}
                  disabled={contactOtpCode.length < 6 || contactOtpVerifying}
                >
                  {contactOtpVerifying ? (
                    <ActivityIndicator color={Colors.white} />
                  ) : (
                    <Text style={styles.otpButtonText}>인증 확인</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}
            
            {contactOtpHintCode ? (
              <Text style={styles.devHintText}>[개발] 인증번호: {contactOtpHintCode}</Text>
            ) : null}

            {isPhoneVerified && !hasLockedVerifiedPhone ? (
              <Text style={styles.successText}>✅ 인증이 완료되었습니다.</Text>
            ) : null}
          </>
        )}
      </Block>
    </StepContainer>
  );
}

const styles = StyleSheet.create({
  input: { backgroundColor: Colors.gray50, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, fontSize: Typography.fontSize.lg, color: Colors.textPrimary, fontWeight: Typography.fontWeight.medium, marginBottom: Spacing.md },
  multilineInput: { height: 100, textAlignVertical: 'top' },
  noticeBox: { backgroundColor: Colors.gray50, padding: Spacing.lg, borderRadius: BorderRadius.md, marginTop: Spacing.xs },
  noticeTitle: { color: Colors.textPrimary, fontWeight: Typography.fontWeight.bold, marginBottom: Spacing.sm },
  noticeText: { color: Colors.textSecondary, fontSize: 13, marginBottom: Spacing.xs },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md, gap: Spacing.sm },
  checkboxText: { flex: 1, color: Colors.textPrimary, fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold },
  verifiedPhoneBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.gray50, padding: Spacing.lg, borderRadius: BorderRadius.md },
  verifiedPhoneText: { color: Colors.primary, fontWeight: Typography.fontWeight.bold },
  linkText: { color: Colors.primary, fontWeight: Typography.fontWeight.bold, textDecorationLine: 'underline' },
  otpRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  flex1: { flex: 1, marginBottom: 0 },
  otpButton: { backgroundColor: Colors.primary, paddingHorizontal: 20, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center' },
  otpButtonText: { color: Colors.white, fontWeight: Typography.fontWeight.bold },
  devHintText: { color: Colors.primary, fontWeight: Typography.fontWeight.bold, fontSize: 12 },
  successText: { color: Colors.primary, fontWeight: Typography.fontWeight.bold, marginTop: Spacing.sm },
});
