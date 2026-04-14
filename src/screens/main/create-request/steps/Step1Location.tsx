import React from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { StepContainer } from '../components/StepContainer';
import { Block } from '../components/Block';
import { Chip } from '../components/Chip';
import { AddressQuickPick } from '../components/AddressQuickPick';
import { Colors, Spacing, BorderRadius } from '../../../../theme';
import { Typography } from '../../../../theme/typography';
import { useCreateRequestStore } from '../store/useCreateRequestStore';
import type { SavedAddress } from '../../../../types/profile';
import type { AddressTarget, PickerType } from '../types';

type Props = {
  savedAddresses: SavedAddress[];
  recentAddresses: SavedAddress[];
  setAddressTarget: (target: AddressTarget) => void;
  resolvingAddressStation: PickerType | null;
  handleRecommendStationFromAddress: (target: PickerType, address: string) => void;
  setPickerType: (type: PickerType) => void;
  setPickerVisible: (visible: boolean) => void;
  resolvingLocation: PickerType | null;
  handleUseCurrentLocation: (target: PickerType) => void;
};

export function Step1Location({
  savedAddresses,
  recentAddresses,
  setAddressTarget,
  resolvingAddressStation,
  handleRecommendStationFromAddress,
  setPickerType,
  setPickerVisible,
  resolvingLocation,
  handleUseCurrentLocation,
}: Props) {
  const store = useCreateRequestStore();

  return (
    <StepContainer 
      step={1} 
      currentStep={store.activeStep} 
      onNext={() => {
        if (!store.pickupStation || !store.deliveryStation) {
          Alert.alert('확인 필요', '출발역과 도착역을 모두 선택해 주세요.');
          return;
        }
        if (store.requestMode === 'immediate') {
           setTimeout(() => store.setActiveStep(2), 50);
        } else {
           store.setActiveStep(2);
        }
      }}
      onPrev={() => store.setActiveStep(1)}
    >
      <Block title="보내기 방식">
        <View style={styles.row}>
          <Chip label="지금 보내기" active={store.requestMode === 'immediate'} onPress={() => { store.setRequestMode('immediate'); }} />
          <Chip label="예약 보내기" active={store.requestMode === 'reservation'} onPress={() => { store.setRequestMode('reservation'); }} />
        </View>
      </Block>

      <Block title="출발 정보">
        <View style={styles.row}>
          <Chip label="역에서 시작" active={store.pickupMode === 'station'} onPress={() => store.setPickupMode('station')} />
          <Chip label="주소에서 시작" active={store.pickupMode === 'address'} onPress={() => store.setPickupMode('address')} />
        </View>
        {store.pickupMode === 'address' ? (
          <View style={styles.column}>
            <AddressQuickPick
              title="저장한 주소"
              addresses={savedAddresses}
              onSelect={(address) => {
                store.setPickupRoadAddress(address.roadAddress);
                store.setPickupDetailAddress(address.detailAddress);
                void handleRecommendStationFromAddress('pickup', address.roadAddress);
              }}
            />
            <AddressQuickPick
              title="최근 사용 주소"
              addresses={recentAddresses}
              onSelect={(address) => {
                store.setPickupRoadAddress(address.roadAddress);
                store.setPickupDetailAddress(address.detailAddress);
                void handleRecommendStationFromAddress('pickup', address.roadAddress);
              }}
            />
            <TouchableOpacity style={styles.selector} onPress={() => setAddressTarget('pickup')}>
              <Text style={styles.selectorLabel}>도로명 주소</Text>
              <Text style={styles.selectorValue}>{store.pickupRoadAddress || '주소 검색으로 선택'}</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              value={store.pickupDetailAddress}
              onChangeText={store.setPickupDetailAddress}
              placeholder="출발지 상세 주소"
              placeholderTextColor={Colors.gray400}
            />
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                void handleRecommendStationFromAddress('pickup', store.pickupRoadAddress);
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
          <Text style={styles.selectorLabel}>{store.pickupMode === 'address' ? '가까운 출발역' : '출발역'}</Text>
          <Text style={styles.selectorValue}>{store.pickupStation?.stationName ?? '출발역 선택'}</Text>
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
          <Chip label="역으로 도착" active={store.deliveryMode === 'station'} onPress={() => store.setDeliveryMode('station')} />
          <Chip label="주소로 도착" active={store.deliveryMode === 'address'} onPress={() => store.setDeliveryMode('address')} />
        </View>
        {store.deliveryMode === 'address' ? (
          <View style={styles.column}>
            <AddressQuickPick
              title="저장한 주소"
              addresses={savedAddresses}
              onSelect={(address) => {
                store.setDeliveryRoadAddress(address.roadAddress);
                store.setDeliveryDetailAddress(address.detailAddress);
                void handleRecommendStationFromAddress('delivery', address.roadAddress);
              }}
            />
            <AddressQuickPick
              title="최근 사용 주소"
              addresses={recentAddresses}
              onSelect={(address) => {
                store.setDeliveryRoadAddress(address.roadAddress);
                store.setDeliveryDetailAddress(address.detailAddress);
                void handleRecommendStationFromAddress('delivery', address.roadAddress);
              }}
            />
            <TouchableOpacity style={styles.selector} onPress={() => setAddressTarget('delivery')}>
              <Text style={styles.selectorLabel}>도로명 주소</Text>
              <Text style={styles.selectorValue}>{store.deliveryRoadAddress || '주소 검색으로 선택'}</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              value={store.deliveryDetailAddress}
              onChangeText={store.setDeliveryDetailAddress}
              placeholder="도착지 상세 주소"
              placeholderTextColor={Colors.gray400}
            />
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                void handleRecommendStationFromAddress('delivery', store.deliveryRoadAddress);
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
          <Text style={styles.selectorLabel}>{store.deliveryMode === 'address' ? '가까운 도착역' : '도착역'}</Text>
          <Text style={styles.selectorValue}>{store.deliveryStation?.stationName ?? '도착역 선택'}</Text>
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
    </StepContainer>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  column: { gap: Spacing.md, marginTop: Spacing.sm },
  selector: { padding: Spacing.lg, backgroundColor: Colors.gray50, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectorLabel: { color: Colors.textSecondary, fontWeight: Typography.fontWeight.bold },
  selectorValue: { color: Colors.textPrimary, fontWeight: Typography.fontWeight.extrabold },
  input: { backgroundColor: Colors.gray50, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, fontSize: Typography.fontSize.lg, color: Colors.textPrimary, fontWeight: Typography.fontWeight.medium },
  secondaryButton: { minHeight: 48, borderRadius: BorderRadius.md, backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: Colors.textSecondary, fontWeight: Typography.fontWeight.bold },
});
