import React, { useEffect, useState } from 'react';
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
import AppTopBar from '../../components/common/AppTopBar';
import { useUser } from '../../contexts/UserContext';
import {
  deleteSavedAddress,
  getRecentAddresses,
  getSavedAddresses,
  saveAddress,
} from '../../services/profile-service';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';
import type { MainStackNavigationProp } from '../../types/navigation';
import type { SavedAddress } from '../../types/profile';

export default function AddressBookScreen({ navigation }: { navigation: MainStackNavigationProp }) {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [recentAddresses, setRecentAddresses] = useState<SavedAddress[]>([]);
  const [label, setLabel] = useState('');
  const [roadAddress, setRoadAddress] = useState('');
  const [detailAddress, setDetailAddress] = useState('');

  useEffect(() => {
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  async function load() {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const [saved, recent] = await Promise.all([
        getSavedAddresses(user.uid),
        getRecentAddresses(user.uid),
      ]);
      setSavedAddresses(saved);
      setRecentAddresses(recent);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(isDefault: boolean) {
    if (!user?.uid) return;
    if (!label.trim() || !roadAddress.trim() || !detailAddress.trim()) {
      Alert.alert('입력 확인', '라벨, 도로명주소, 상세주소를 모두 입력해 주세요.');
      return;
    }

    setSaving(true);
    try {
      await saveAddress(user.uid, {
        label,
        roadAddress,
        detailAddress,
        isDefault,
      });
      setLabel('');
      setRoadAddress('');
      setDetailAddress('');
      await load();
    } catch (error) {
      console.error(error);
      Alert.alert('저장 실패', '주소를 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(address: SavedAddress) {
    if (!user?.uid) return;
    try {
      await deleteSavedAddress(user.uid, address.addressId);
      await load();
    } catch (error) {
      console.error(error);
      Alert.alert('삭제 실패', '주소를 삭제하지 못했습니다.');
    }
  }

  return (
    <View style={styles.container}>
      <AppTopBar title="주소록 관리" onBack={() => navigation.goBack()} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>새 주소 저장</Text>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={setLabel}
              placeholder="예: 집, 회사, 자주 쓰는 수령지"
              placeholderTextColor={Colors.gray400}
            />
            <TextInput
              style={styles.input}
              value={roadAddress}
              onChangeText={setRoadAddress}
              placeholder="도로명주소"
              placeholderTextColor={Colors.gray400}
            />
            <TextInput
              style={styles.input}
              value={detailAddress}
              onChangeText={setDetailAddress}
              placeholder="상세주소"
              placeholderTextColor={Colors.gray400}
            />
            <View style={styles.row}>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => void handleSave(false)} disabled={saving}>
                <Text style={styles.secondaryButtonText}>주소 저장</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButton} onPress={() => void handleSave(true)} disabled={saving}>
                <Text style={styles.primaryButtonText}>기본 주소로 저장</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Section title="저장된 주소" addresses={savedAddresses} onDelete={(addr) => void handleDelete(addr)} />
          <Section title="최근 사용 주소" addresses={recentAddresses} />
        </ScrollView>
      )}
    </View>
  );
}

function Section({
  title,
  addresses,
  onDelete,
}: {
  title: string;
  addresses: SavedAddress[];
  onDelete?: (address: SavedAddress) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {addresses.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>아직 등록된 주소가 없습니다.</Text>
        </View>
      ) : (
        addresses.map((address) => (
          <View key={`${title}-${address.addressId}`} style={styles.addressCard}>
            <View style={styles.addressCopy}>
              <Text style={styles.addressLabel}>
                {address.label}
                {address.isDefault ? ' · 기본' : ''}
              </Text>
              <Text style={styles.addressText}>{address.roadAddress}</Text>
              <Text style={styles.addressDetail}>{address.detailAddress}</Text>
            </View>
            {onDelete ? (
              <TouchableOpacity onPress={() => onDelete(address)} style={styles.deleteButton}>
                <Text style={styles.deleteText}>삭제</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing['4xl'] },
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, gap: 10, ...Shadows.sm },
  cardTitle: { color: Colors.textPrimary, fontSize: Typography.fontSize.lg, fontWeight: '800' },
  input: {
    minHeight: 52,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
  },
  row: { flexDirection: 'row', gap: 8 },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: Colors.white, fontWeight: '800' },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.gray50,
  },
  secondaryButtonText: { color: Colors.primary, fontWeight: '800' },
  section: { gap: 10 },
  sectionTitle: { color: Colors.textPrimary, fontSize: Typography.fontSize.lg, fontWeight: '800' },
  emptyCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, ...Shadows.sm },
  emptyText: { color: Colors.textSecondary, ...Typography.bodySmall },
  addressCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...Shadows.sm,
  },
  addressCopy: { flex: 1, gap: 4 },
  addressLabel: { color: Colors.textPrimary, fontWeight: '800' },
  addressText: { color: Colors.textPrimary, ...Typography.bodySmall },
  addressDetail: { color: Colors.textSecondary, ...Typography.caption },
  deleteButton: {
    minWidth: 56,
    minHeight: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.errorBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: { color: Colors.error, fontWeight: '700' },
});
