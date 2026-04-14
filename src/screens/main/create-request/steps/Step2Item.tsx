import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { StepContainer } from '../components/StepContainer';
import { Block } from '../components/Block';
import { Chip } from '../components/Chip';
import TimePicker from '../../../../components/common/TimePicker';
import { Colors, Spacing, BorderRadius } from '../../../../theme';
import { Typography } from '../../../../theme/typography';
import { useCreateRequestStore } from '../store/useCreateRequestStore';
import type { PackageSize } from '../types';
import type { Beta1AIAnalysisResponse } from '../../../../services/beta1-ai-service';

export const CLEAN_SIZE_OPTIONS: Array<{ value: PackageSize; label: string }> = [
  { value: 'small', label: '소형' },
  { value: 'medium', label: '중형' },
  { value: 'large', label: '대형' },
  { value: 'xl', label: '특대형' },
  { value: 'extra_large', label: '엑스라지' },
];

type Props = {
  handleUploadPhotoFromCamera: () => Promise<void>;
  handleUploadPhotoFromLibrary: () => Promise<void>;
  handleAI: () => Promise<void>;
  aiResult: Beta1AIAnalysisResponse | null;
  setReservationCalendarVisible: (visible: boolean) => void;
  hasItemValue: boolean;
};

export function Step2Item({
  handleUploadPhotoFromCamera,
  handleUploadPhotoFromLibrary,
  handleAI,
  aiResult,
  setReservationCalendarVisible,
  hasItemValue,
}: Props) {
  const store = useCreateRequestStore();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (store.activeStep === 2) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 400); // Wait for LayoutAnimation to complete
      return () => clearTimeout(timer);
    }
  }, [store.activeStep]);

  return (
    <StepContainer 
      step={2} 
      currentStep={store.activeStep} 
      onNext={() => {
        if (!store.packageSize || !store.weightKg || !store.packageItemName) {
          Alert.alert('확인 필요', '물품 정보를 모두 입력해 주세요.');
          return;
        }
        if (hasItemValue && !store.photoUrl) {
          Alert.alert('사진 필수', '물품 가치(보증금)가 입력된 경우, 사진을 반드시 올려주셔야 합니다.');
          return;
        }
        store.setActiveStep(3);
      }}
      onPrev={() => store.setActiveStep(2)}
      nextDisabled={hasItemValue && !store.photoUrl}
    >
      <Block title={store.photoUrl ? '물건 사진 ✓' : hasItemValue ? '물건 사진 (필수)' : '물건 사진 (선택)'}>
        <View style={styles.row}>
          <TouchableOpacity style={[styles.primaryButton, styles.flexButton]} onPress={() => void handleUploadPhotoFromCamera()}>
            <Text style={styles.primaryButtonText}>{store.photoUrl ? '다시 촬영' : '사진 찍기'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryButton, styles.flexButton]} onPress={() => void handleUploadPhotoFromLibrary()}>
            <Text style={styles.secondaryButtonText}>앨범에서 선택</Text>
          </TouchableOpacity>
        </View>
        
        {hasItemValue && !store.photoUrl ? (
          <Text style={styles.errorText}>⚠️ 물품 가치(보증금)를 입력하셨습니다. 보증금 적용을 위해 사진이 반드시 필요합니다.</Text>
        ) : !store.photoUrl ? (
          <Text style={styles.muted}>사진을 올리면 AI가 물품 설명을 작성해 드립니다. 없이도 진행할 수 있습니다.</Text>
        ) : null}

        {store.photoUrl ? <Image source={{ uri: store.photoUrl }} style={styles.previewImage} /> : null}

        <TouchableOpacity
          style={[styles.secondaryButton, !store.photoUrl && styles.disabled]}
          onPress={() => void handleAI()}
          disabled={!store.photoUrl}
        >
          <Text style={styles.secondaryButtonText}>AI에게 설명 맡기기</Text>
        </TouchableOpacity>
        {store.photoUrl ? <Text style={styles.muted}>AI 분석은 선택 기능이며 직접 입력해서 진행할 수도 있습니다.</Text> : null}
      </Block>

      <Block title="물품 정보">
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={store.packageItemName}
          onChangeText={store.setPackageItemName}
          placeholder="물품명"
          placeholderTextColor={Colors.gray400}
        />
        <TextInput
          style={styles.input}
          value={store.packageDescription}
          onChangeText={store.setPackageDescription}
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
              active={store.packageSize === size.value}
              onPress={() => {
                store.setPackageSize(size.value);
              }}
            />
          ))}
        </View>
        <TextInput
          style={styles.input}
          value={store.weightKg}
          onChangeText={store.setWeightKg}
          keyboardType="decimal-pad"
          placeholder="무게(kg)"
          placeholderTextColor={Colors.gray400}
        />
        <TextInput
          style={styles.input}
          value={store.itemValue}
          onChangeText={store.setItemValue}
          keyboardType="number-pad"
          placeholder="물품 가치(선택)"
          placeholderTextColor={Colors.gray400}
        />
      </Block>

      <Block title="시간과 진행 방식">
        {store.requestMode === 'reservation' ? (
          <>
            <TouchableOpacity style={styles.selector} onPress={() => setReservationCalendarVisible(true)}>
              <Text style={styles.selectorLabel}>희망 도착 날짜</Text>
              <Text style={styles.selectorValue}>{store.preferredPickupDate || '날짜 선택'}</Text>
            </TouchableOpacity>
            <TimePicker
              label="희망 도착 시간"
              value={store.preferredPickupTime}
              onChange={store.setPreferredPickupTime}
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
                active={store.urgency === level.value}
                onPress={() => {
                  store.setUrgency(level.value);
                }}
              />
            ))}
          </View>
        )}
        <View style={styles.column}>
          <Chip label="길러에게 맡기기" active={store.directMode === 'none'} onPress={() => { store.setDirectMode('none'); }} />
          <Chip
            label="출발역까지 직접 전달"
            active={store.directMode === 'requester_to_station'}
            onPress={() => { store.setDirectMode('requester_to_station'); }}
          />
          <Chip
            label="사물함 포함"
            active={store.directMode === 'locker_assisted'}
            onPress={() => { store.setDirectMode('locker_assisted'); }}
          />
        </View>
      </Block>
    </StepContainer>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  column: { gap: Spacing.md, marginTop: Spacing.sm },
  input: { backgroundColor: Colors.gray50, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, fontSize: Typography.fontSize.lg, color: Colors.textPrimary, fontWeight: Typography.fontWeight.medium },
  selector: { padding: Spacing.lg, backgroundColor: Colors.gray50, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectorLabel: { color: Colors.textSecondary, fontWeight: Typography.fontWeight.bold },
  selectorValue: { color: Colors.textPrimary, fontWeight: Typography.fontWeight.extrabold },
  primaryButton: { minHeight: 48, borderRadius: BorderRadius.md, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: Colors.white, fontWeight: Typography.fontWeight.bold },
  secondaryButton: { minHeight: 48, borderRadius: BorderRadius.md, backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: Colors.textSecondary, fontWeight: Typography.fontWeight.bold },
  flexButton: { flex: 1 },
  disabled: { opacity: 0.5 },
  muted: { color: Colors.textSecondary, fontSize: Typography.fontSize.sm, marginTop: Spacing.xs },
  errorText: { color: Colors.error, fontSize: Typography.fontSize.sm, marginTop: Spacing.xs, fontWeight: Typography.fontWeight.bold },
  previewImage: { width: '100%', height: 200, borderRadius: BorderRadius.md, marginTop: Spacing.sm },
  aiBox: { padding: Spacing.md, backgroundColor: Colors.gray50, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.border },
  aiTitle: { color: Colors.primary, fontWeight: Typography.fontWeight.bold, marginBottom: Spacing.xs },
});
