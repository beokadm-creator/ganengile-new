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
import AppTopBar from '../../components/common/AppTopBar';
import AddressSearchModal from '../../components/common/AddressSearchModal';
import { useUser } from '../../contexts/UserContext';
import {
  deleteSavedAddress,
  getRecentAddresses,
  getSavedAddresses,
  saveAddress,
  setDefaultSavedAddress,
  toggleFavoriteSavedAddress,
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
  const [searchVisible, setSearchVisible] = useState(false);

  useEffect(() => {
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const orderedSavedAddresses = useMemo(
    () =>
      [...savedAddresses].sort((left, right) => {
        const leftScore = (left.isDefault ? 4 : 0) + (left.isFavorite ? 2 : 0);
        const rightScore = (right.isDefault ? 4 : 0) + (right.isFavorite ? 2 : 0);
        return rightScore - leftScore;
      }),
    [savedAddresses]
  );

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

  async function handleSave(isDefault: boolean, isFavorite: boolean) {
    if (!user?.uid) return;
    if (!label.trim() || !roadAddress.trim()) {
      Alert.alert('입력 확인', '주소 이름과 도로명 주소를 확인해 주세요.');
      return;
    }

    setSaving(true);
    try {
      await saveAddress(user.uid, {
        label,
        roadAddress,
        detailAddress,
        isDefault,
        isFavorite,
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

  async function handleSetDefault(address: SavedAddress) {
    if (!user?.uid) return;
    try {
      await setDefaultSavedAddress(user.uid, address.addressId);
      await load();
    } catch (error) {
      console.error(error);
      Alert.alert('기본 주소 설정 실패', '잠시 후 다시 시도해 주세요.');
    }
  }

  async function handleToggleFavorite(address: SavedAddress) {
    if (!user?.uid) return;
    try {
      await toggleFavoriteSavedAddress(user.uid, address.addressId, !address.isFavorite);
      await load();
    } catch (error) {
      console.error(error);
      Alert.alert('즐겨찾기 변경 실패', '잠시 후 다시 시도해 주세요.');
    }
  }

  async function handleUseRecent(address: SavedAddress, asDefault: boolean) {
    if (!user?.uid) return;
    setSaving(true);
    try {
      await saveAddress(user.uid, {
        label: address.label || '최근 사용 주소',
        roadAddress: address.roadAddress,
        detailAddress: address.detailAddress,
        isDefault: asDefault,
        isFavorite: false,
      });
      await load();
    } catch (error) {
      console.error(error);
      Alert.alert('주소 추가 실패', '잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
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
            <Text style={styles.cardTitle}>새 주소 추가</Text>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={setLabel}
              placeholder="예: 집, 회사, 부모님 댁"
              placeholderTextColor={Colors.gray400}
            />
            <TouchableOpacity style={styles.selector} onPress={() => setSearchVisible(true)}>
              <Text style={styles.selectorLabel}>도로명 주소</Text>
              <Text style={styles.selectorValue}>{roadAddress || '실제 도로명 주소 검색'}</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              value={detailAddress}
              onChangeText={setDetailAddress}
              placeholder="상세 주소"
              placeholderTextColor={Colors.gray400}
            />
            <View style={styles.row}>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => void handleSave(false, true)} disabled={saving}>
                <Text style={styles.secondaryButtonText}>즐겨찾기로 저장</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButton} onPress={() => void handleSave(true, true)} disabled={saving}>
                <Text style={styles.primaryButtonText}>기본주소로 저장</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Section
            title="저장된 주소"
            addresses={orderedSavedAddresses}
            emptyText="등록된 주소가 없습니다."
            onDelete={(address) => void handleDelete(address)}
            onSetDefault={(address) => void handleSetDefault(address)}
            onToggleFavorite={(address) => void handleToggleFavorite(address)}
          />

          <RecentSection
            addresses={recentAddresses}
            onUse={(address, asDefault) => void handleUseRecent(address, asDefault)}
          />
        </ScrollView>
      )}

      <AddressSearchModal
        visible={searchVisible}
        title="도로명 주소 검색"
        onClose={() => setSearchVisible(false)}
        onSelectAddress={(item) => {
          setRoadAddress(item.roadAddress);
        }}
      />
    </View>
  );
}

function Section({
  title,
  addresses,
  emptyText,
  onDelete,
  onSetDefault,
  onToggleFavorite,
}: {
  title: string;
  addresses: SavedAddress[];
  emptyText: string;
  onDelete: (address: SavedAddress) => void;
  onSetDefault: (address: SavedAddress) => void;
  onToggleFavorite: (address: SavedAddress) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {addresses.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      ) : (
        addresses.map((address) => (
          <View key={address.addressId} style={styles.addressCard}>
            <View style={styles.addressCopy}>
              <View style={styles.badgeRow}>
                <Text style={styles.addressLabel}>{address.label}</Text>
                {address.isDefault ? <Badge label="기본주소" tone="primary" /> : null}
                {address.isFavorite ? <Badge label="즐겨찾기" tone="neutral" /> : null}
              </View>
              <Text style={styles.addressText}>{address.roadAddress}</Text>
              {address.detailAddress ? <Text style={styles.addressDetail}>{address.detailAddress}</Text> : null}
            </View>
            <View style={styles.actionColumn}>
              {!address.isDefault ? (
                <MiniAction label="기본주소" onPress={() => onSetDefault(address)} />
              ) : null}
              <MiniAction
                label={address.isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
                onPress={() => onToggleFavorite(address)}
              />
              <MiniAction label="삭제" danger onPress={() => onDelete(address)} />
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function RecentSection({
  addresses,
  onUse,
}: {
  addresses: SavedAddress[];
  onUse: (address: SavedAddress, asDefault: boolean) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>최근 사용 주소</Text>
      {addresses.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>최근 사용 주소가 없습니다.</Text>
        </View>
      ) : (
        addresses.map((address) => (
          <View key={`recent-${address.addressId}`} style={styles.addressCard}>
            <View style={styles.addressCopy}>
              <Text style={styles.addressLabel}>{address.label}</Text>
              <Text style={styles.addressText}>{address.roadAddress}</Text>
              {address.detailAddress ? <Text style={styles.addressDetail}>{address.detailAddress}</Text> : null}
            </View>
            <View style={styles.actionColumn}>
              <MiniAction label="추가" onPress={() => onUse(address, false)} />
              <MiniAction label="기본으로 추가" onPress={() => onUse(address, true)} />
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function Badge({ label, tone }: { label: string; tone: 'primary' | 'neutral' }) {
  return (
    <View style={[styles.badge, tone === 'primary' ? styles.primaryBadge : styles.neutralBadge]}>
      <Text style={[styles.badgeText, tone === 'primary' ? styles.primaryBadgeText : styles.neutralBadgeText]}>
        {label}
      </Text>
    </View>
  );
}

function MiniAction({
  label,
  danger,
  onPress,
}: {
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.miniAction, danger && styles.miniActionDanger]}>
      <Text style={[styles.miniActionText, danger && styles.miniActionTextDanger]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing['4xl'] },
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, gap: 10, ...Shadows.sm },
  cardTitle: { color: Colors.textPrimary, fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.extrabold },
  input: {
    minHeight: 52,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
  },
  selector: {
    minHeight: 56,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
    gap: 4,
    backgroundColor: Colors.surface,
  },
  selectorLabel: { color: Colors.gray500, ...Typography.caption },
  selectorValue: { color: Colors.textPrimary, ...Typography.bodySmall },
  row: { flexDirection: 'row', gap: 8 },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: Colors.white, fontWeight: Typography.fontWeight.extrabold },
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
  secondaryButtonText: { color: Colors.primary, fontWeight: Typography.fontWeight.extrabold },
  section: { gap: 10 },
  sectionTitle: { color: Colors.textPrimary, fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.extrabold },
  emptyCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, ...Shadows.sm },
  emptyText: { color: Colors.textSecondary, ...Typography.bodySmall },
  addressCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    flexDirection: 'row',
    gap: 12,
    ...Shadows.sm,
  },
  addressCopy: { flex: 1, gap: 4 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  addressLabel: { color: Colors.textPrimary, fontWeight: Typography.fontWeight.extrabold },
  addressText: { color: Colors.textPrimary, ...Typography.bodySmall },
  addressDetail: { color: Colors.textSecondary, ...Typography.caption },
  badge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  primaryBadge: { backgroundColor: Colors.primaryMint },
  neutralBadge: { backgroundColor: Colors.gray100 },
  badgeText: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.extrabold },
  primaryBadgeText: { color: Colors.primary },
  neutralBadgeText: { color: Colors.textSecondary },
  actionColumn: { gap: 8, alignItems: 'flex-end' },
  miniAction: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    backgroundColor: Colors.gray50,
  },
  miniActionDanger: {
    backgroundColor: Colors.errorBackground,
    borderColor: Colors.errorBackground,
  },
  miniActionText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  miniActionTextDanger: {
    color: Colors.error,
  },
});
