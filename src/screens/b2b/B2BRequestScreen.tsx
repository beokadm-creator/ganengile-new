import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { StackNavigationProp } from '@react-navigation/stack';
import OptimizedStationSelectModal from '../../components/OptimizedStationSelectModal';
import { NaverMapCard } from '../../components/maps/NaverMapCard';
import { getAllStations } from '../../services/config-service';
import { B2BDeliveryService } from '../../services/b2b-delivery-service';
import { requireUserId } from '../../services/firebase';
import type { Station } from '../../types/config';
import type { B2BStackParamList } from '../../types/navigation';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';

type NavigationProp = StackNavigationProp<B2BStackParamList, 'B2BRequest'>;
type RequestType = 'immediate' | 'reserved';

export default function B2BRequestScreen({ navigation }: { navigation: NavigationProp }) {
  const [loading, setLoading] = useState(false);
  const [stations, setStations] = useState<Station[]>([]);
  const [pickupStation, setPickupStation] = useState<Station | null>(null);
  const [deliveryStation, setDeliveryStation] = useState<Station | null>(null);
  const [requestType, setRequestType] = useState<RequestType>('immediate');
  const [reservedTime, setReservedTime] = useState('');
  const [specialRequest, setSpecialRequest] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [contractId, setContractId] = useState('default');
  const [weight, setWeight] = useState('1.0');
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);

  useEffect(() => {
    void (async () => {
      const nextStations = await getAllStations();
      setStations(nextStations);
    })();
  }, []);

  const mapCenter = useMemo(() => {
    if (pickupStation && deliveryStation) {
      return {
        latitude: (pickupStation.location.latitude + deliveryStation.location.latitude) / 2,
        longitude: (pickupStation.location.longitude + deliveryStation.location.longitude) / 2,
        label: '배송 경로',
      };
    }

    if (pickupStation) {
      return {
        latitude: pickupStation.location.latitude,
        longitude: pickupStation.location.longitude,
        label: pickupStation.stationName,
      };
    }

    if (deliveryStation) {
      return {
        latitude: deliveryStation.location.latitude,
        longitude: deliveryStation.location.longitude,
        label: deliveryStation.stationName,
      };
    }

    return {
      latitude: 37.5665,
      longitude: 126.978,
      label: '서울',
    };
  }, [deliveryStation, pickupStation]);

  const markers = useMemo(
    () => [
      ...(pickupStation
        ? [{ latitude: pickupStation.location.latitude, longitude: pickupStation.location.longitude, label: '출발' }]
        : []),
      ...(deliveryStation
        ? [{ latitude: deliveryStation.location.latitude, longitude: deliveryStation.location.longitude, label: '도착' }]
        : []),
    ],
    [deliveryStation, pickupStation],
  );

  async function handleSubmit() {
    if (!pickupStation || !deliveryStation) {
      Alert.alert('입력 확인', '출발역과 도착역을 모두 선택해 주세요.');
      return;
    }

    if (pickupStation.stationId === deliveryStation.stationId) {
      Alert.alert('입력 확인', '출발역과 도착역은 서로 달라야 합니다.');
      return;
    }

    if (!pickupAddress.trim() || !deliveryAddress.trim()) {
      Alert.alert('입력 확인', '출발지와 도착지의 상세 주소를 모두 입력해 주세요.');
      return;
    }

    if (requestType === 'reserved' && !reservedTime.trim()) {
      Alert.alert('입력 확인', '예약 시간대를 입력해 주세요.');
      return;
    }

    const parsedWeight = Number.parseFloat(weight);
    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      Alert.alert('입력 확인', '중량은 0보다 큰 숫자로 입력해 주세요.');
      return;
    }

    try {
      setLoading(true);
      const businessId = requireUserId();
      const deliveryId = await B2BDeliveryService.createDelivery({
        contractId: contractId.trim() || 'default',
        businessId,
        pickupLocation: {
          station: pickupStation.stationName,
          address: pickupAddress.trim(),
          latitude: pickupStation.location.latitude,
          longitude: pickupStation.location.longitude,
        },
        dropoffLocation: {
          station: deliveryStation.stationName,
          address: deliveryAddress.trim(),
          latitude: deliveryStation.location.latitude,
          longitude: deliveryStation.location.longitude,
        },
        scheduledTime: requestType === 'reserved' ? new Date(reservedTime) : new Date(),
        weight: parsedWeight,
        notes: specialRequest.trim(),
      });

      Alert.alert('요청 접수 완료', `기업 배송 요청이 접수되었습니다.\n요청 ID: ${deliveryId}`, [
        { text: '확인', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('B2B request creation failed:', error);
      Alert.alert('요청 실패', error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>기업 배송 요청</Text>
        <Text style={styles.subtitle}>출발역과 도착역을 선택하고 바로 요청을 등록합니다.</Text>
      </View>

      {Boolean(pickupStation ?? deliveryStation) && (
        <NaverMapCard center={mapCenter} markers={markers} title="배송 구간" subtitle="선택한 구간을 바로 확인할 수 있습니다." />
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>역 선택</Text>
        <SelectorRow label="출발역" value={pickupStation?.stationName ?? '출발역 선택'} onPress={() => setShowPickupModal(true)} />
        <SelectorRow label="도착역" value={deliveryStation?.stationName ?? '도착역 선택'} onPress={() => setShowDeliveryModal(true)} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>요청 방식</Text>
        <View style={styles.toggleRow}>
          <ModeButton active={requestType === 'immediate'} title="즉시 배송" onPress={() => setRequestType('immediate')} />
          <ModeButton active={requestType === 'reserved'} title="예약 배송" onPress={() => setRequestType('reserved')} />
        </View>
        {requestType === 'reserved' ? (
          <TextInput style={styles.input} placeholder="YYYY-MM-DD HH:MM" value={reservedTime} onChangeText={setReservedTime} />
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>배송 정보</Text>
        <TextInput style={styles.input} placeholder="계약 ID" value={contractId} onChangeText={setContractId} />
        <TextInput style={styles.input} placeholder="출발지 상세 주소" value={pickupAddress} onChangeText={setPickupAddress} />
        <TextInput style={styles.input} placeholder="도착지 상세 주소" value={deliveryAddress} onChangeText={setDeliveryAddress} />
        <TextInput style={styles.input} placeholder="중량 (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
        <TextInput style={[styles.input, styles.multilineInput]} placeholder="요청 메모" value={specialRequest} onChangeText={setSpecialRequest} multiline />
      </View>

      <TouchableOpacity style={styles.submitButton} onPress={() => void handleSubmit()} disabled={loading}>
        {loading ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.submitButtonText}>요청 생성</Text>}
      </TouchableOpacity>

      <OptimizedStationSelectModal
        visible={showPickupModal}
        onClose={() => setShowPickupModal(false)}
        onSelectStation={(station) => {
          setPickupStation(station);
          setShowPickupModal(false);
        }}
        stations={stations}
        title="출발역 선택"
      />

      <OptimizedStationSelectModal
        visible={showDeliveryModal}
        onClose={() => setShowDeliveryModal(false)}
        onSelectStation={(station) => {
          setDeliveryStation(station);
          setShowDeliveryModal(false);
        }}
        stations={stations}
        title="도착역 선택"
      />
    </ScrollView>
  );
}

function SelectorRow({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.selectorRow} onPress={onPress}>
      <Text style={styles.selectorLabel}>{label}</Text>
      <Text style={styles.selectorValue}>{value}</Text>
    </TouchableOpacity>
  );
}

function ModeButton({ active, title, onPress }: { active: boolean; title: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.modeButton, active ? styles.modeButtonActive : undefined]} onPress={onPress}>
      <Text style={[styles.modeButtonText, active ? styles.modeButtonTextActive : undefined]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { gap: Spacing.lg, padding: Spacing.xl },
  header: { gap: Spacing.sm },
  title: { fontSize: Typography.fontSize['2xl'], fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: Typography.fontSize.sm, lineHeight: 21, color: Colors.textSecondary },
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl, gap: Spacing.md, borderWidth: 1, borderColor: Colors.border, ...Shadows.sm },
  sectionTitle: { fontSize: Typography.fontSize.lg, fontWeight: '800', color: Colors.textPrimary },
  selectorRow: {
    alignItems: 'center',
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  selectorLabel: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.textSecondary },
  selectorValue: { fontSize: Typography.fontSize.sm, color: Colors.textPrimary, fontWeight: '500' },
  toggleRow: { flexDirection: 'row', gap: Spacing.sm },
  modeButton: { alignItems: 'center', backgroundColor: Colors.gray100, borderRadius: BorderRadius.lg, flex: 1, paddingVertical: 14 },
  modeButtonActive: { backgroundColor: Colors.primary },
  modeButtonText: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.textSecondary },
  modeButtonTextActive: { color: Colors.white },
  input: {
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  multilineInput: { minHeight: 100, textAlignVertical: 'top' },
  submitButton: { alignItems: 'center', backgroundColor: Colors.primary, borderRadius: BorderRadius.full, justifyContent: 'center', minHeight: 56 },
  submitButtonText: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.white },
});
