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
import { useNavigation } from '@react-navigation/native';
import OptimizedStationSelectModal from '../../components/OptimizedStationSelectModal';
import { createAuction } from '../../services/auction-service';
import { getAllStations } from '../../services/config-service';
import { requireUserId } from '../../services/firebase';
import { calculatePhase1DeliveryFee, type PackageSizeType } from '../../services/pricing-service';
import type { Station } from '../../types/config';
import type { MainStackNavigationProp } from '../../types/navigation';
import type { StationInfo } from '../../types/request';

function toStationInfo(station: Station): StationInfo {
  return {
    id: station.stationId,
    stationId: station.stationId,
    stationName: station.stationName,
    line: station.lines[0]?.lineName ?? '',
    lineCode: station.lines[0]?.lineCode ?? '',
    lat: station.location.latitude,
    lng: station.location.longitude,
  };
}

export default function CreateAuctionScreen() {
  const navigation = useNavigation<MainStackNavigationProp>();
  const [stations, setStations] = useState<Station[]>([]);
  const [loadingStations, setLoadingStations] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickupStation, setPickupStation] = useState<Station | null>(null);
  const [deliveryStation, setDeliveryStation] = useState<Station | null>(null);
  const [packageSize, setPackageSize] = useState<'small' | 'medium' | 'large' | 'xl'>('small');
  const [weight, setWeight] = useState('1');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [pickupModalVisible, setPickupModalVisible] = useState(false);
  const [deliveryModalVisible, setDeliveryModalVisible] = useState(false);

  useEffect(() => {
    const loadStations = async (): Promise<void> => {
      try {
        setLoadingStations(true);
        const result = await getAllStations();
        setStations(result);
        setPickupStation(result[0] ?? null);
        setDeliveryStation(result[1] ?? null);
      } catch (error) {
        console.error('Failed to load stations:', error);
        Alert.alert('역 정보를 불러오지 못했습니다', '잠시 후 다시 시도해 주세요.');
      } finally {
        setLoadingStations(false);
      }
    };

    void loadStations();
  }, []);

  const estimatedFee = useMemo(() => {
    const numericWeight = Number.parseFloat(weight);
    if (!pickupStation || !deliveryStation || !Number.isFinite(numericWeight) || numericWeight <= 0) {
      return null;
    }

    return calculatePhase1DeliveryFee({
      stationCount: 5,
      weight: numericWeight,
      packageSize: packageSize as PackageSizeType,
      urgency: 'urgent',
    });
  }, [deliveryStation, packageSize, pickupStation, weight]);

  const submitDisabled =
    !pickupStation ||
    !deliveryStation ||
    pickupStation.stationId === deliveryStation.stationId ||
    !description.trim() ||
    !estimatedFee;

  const handleSubmit = async (): Promise<void> => {
    if (submitDisabled || !pickupStation || !deliveryStation || !estimatedFee) {
      Alert.alert('입력 확인', '출발역, 도착역, 물품 설명을 먼저 입력해 주세요.');
      return;
    }

    try {
      setSaving(true);
      const userId = requireUserId();

      await createAuction({
        gllerId: userId,
        gllerName: '가는길에 사용자',
        pickupStation: toStationInfo(pickupStation),
        deliveryStation: toStationInfo(deliveryStation),
        packageSize,
        packageWeight: Number.parseFloat(weight),
        packageDescription: description.trim(),
        baseFee: estimatedFee.baseFee,
        distanceFee: estimatedFee.distanceFee,
        weightFee: estimatedFee.weightFee,
        sizeFee: estimatedFee.sizeFee,
        serviceFee: estimatedFee.serviceFee,
        durationMinutes: Number.parseInt(durationMinutes, 10) || 30,
      });

      Alert.alert('경매 요청이 생성되었습니다', '긴급 재매칭이 필요한 요청을 경매로 접수했습니다.', [
        { text: '목록 보기', onPress: () => navigation.navigate('AuctionList') },
      ]);
    } catch (error) {
      console.error('Failed to create auction:', error);
      Alert.alert('경매 요청에 실패했습니다', '잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  if (loadingStations) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>역 정보를 불러오고 있습니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>경매 요청</Text>
        <Text style={styles.subtitle}>긴급 재매칭이 필요할 때 경매 방식으로 다시 요청할 수 있습니다.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>역 선택</Text>
        <SelectorRow
          label="출발역"
          value={pickupStation?.stationName ?? '출발역 선택'}
          onPress={() => setPickupModalVisible(true)}
        />
        <SelectorRow
          label="도착역"
          value={deliveryStation?.stationName ?? '도착역 선택'}
          onPress={() => setDeliveryModalVisible(true)}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>물품 정보</Text>
        <View style={styles.chipRow}>
          {(['small', 'medium', 'large', 'xl'] as const).map((value) => {
            const active = packageSize === value;
            return (
              <TouchableOpacity
                key={value}
                style={[styles.chip, active ? styles.chipActive : undefined]}
                onPress={() => setPackageSize(value)}
              >
                <Text style={[styles.chipText, active ? styles.chipTextActive : undefined]}>{value}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TextInput style={styles.input} value={weight} onChangeText={setWeight} placeholder="무게 (kg)" keyboardType="decimal-pad" />
        <TextInput
          style={[styles.input, styles.descriptionInput]}
          value={description}
          onChangeText={setDescription}
          placeholder="예: 서류 봉투, 노트북 파우치"
          multiline
        />
        <TextInput
          style={styles.input}
          value={durationMinutes}
          onChangeText={setDurationMinutes}
          placeholder="경매 진행 시간(분)"
          keyboardType="number-pad"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>예상 금액</Text>
        <Text style={styles.bodyText}>
          {estimatedFee ? `${estimatedFee.totalFee.toLocaleString()}원` : '입력값을 채우면 예상 금액이 계산됩니다.'}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, submitDisabled && styles.primaryButtonDisabled]}
        onPress={() => void handleSubmit()}
        disabled={saving || submitDisabled}
      >
        {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>경매 요청 생성</Text>}
      </TouchableOpacity>

      <OptimizedStationSelectModal
        visible={pickupModalVisible}
        onClose={() => setPickupModalVisible(false)}
        onSelectStation={(station) => {
          setPickupStation(station);
          setPickupModalVisible(false);
        }}
        stations={stations}
        title="출발역 선택"
      />

      <OptimizedStationSelectModal
        visible={deliveryModalVisible}
        onClose={() => setDeliveryModalVisible(false)}
        onSelectStation={(station) => {
          setDeliveryStation(station);
          setDeliveryModalVisible(false);
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, gap: 16 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748B' },
  header: { gap: 8 },
  title: { fontSize: 28, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 15, lineHeight: 22, color: '#64748B' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  bodyText: { fontSize: 15, color: '#334155' },
  selectorRow: {
    alignItems: 'center',
    borderColor: '#E2E8F0',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  selectorLabel: { fontSize: 14, fontWeight: '700', color: '#334155' },
  selectorValue: { fontSize: 14, color: '#0F172A' },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  descriptionInput: { minHeight: 96, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  chipActive: { backgroundColor: '#0F766E', borderColor: '#0F766E' },
  chipText: { color: '#334155', fontWeight: '700' },
  chipTextActive: { color: '#FFFFFF' },
  primaryButton: {
    borderRadius: 18,
    backgroundColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  primaryButtonDisabled: { backgroundColor: '#94A3B8' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
