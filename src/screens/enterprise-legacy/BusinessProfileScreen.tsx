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
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { doc, updateDoc } from 'firebase/firestore';
import { enterpriseLegacyFirestoreService } from '../../services/enterprise-legacy-firestore-service';
import { db, requireUserId } from '../../services/firebase';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';
import type { EnterpriseLegacyStackNavigationProp } from '../../types/navigation';

type SubscriptionStatus = 'active' | 'suspended' | 'cancelled';

type BusinessProfile = {
  businessId: string;
  companyName: string;
  businessNumber: string;
  ceoName: string;
  address: string;
  contact: string;
  email: string;
  businessType: string;
  subscriptionTier: string;
  subscriptionStatus: SubscriptionStatus;
  monthlyLimit: number;
  usedDeliveries: number;
};

type EditableProfile = Pick<BusinessProfile, 'companyName' | 'ceoName' | 'address' | 'contact'>;

function toSubscriptionStatus(value: unknown): SubscriptionStatus {
  return value === 'active' || value === 'suspended' || value === 'cancelled' ? value : 'active';
}

function mapBusinessProfile(userId: string, raw: Record<string, unknown>): BusinessProfile {
  return {
    businessId: typeof raw.businessId === 'string' ? raw.businessId : userId,
    companyName: typeof raw.companyName === 'string' ? raw.companyName : '',
    businessNumber: typeof raw.businessNumber === 'string' ? raw.businessNumber : '',
    ceoName: typeof raw.ceoName === 'string' ? raw.ceoName : '',
    address: typeof raw.address === 'string' ? raw.address : '',
    contact: typeof raw.contact === 'string' ? raw.contact : '',
    email: typeof raw.email === 'string' ? raw.email : '',
    businessType: typeof raw.businessType === 'string' ? raw.businessType : '기업 회원',
    subscriptionTier: typeof raw.subscriptionTier === 'string' ? raw.subscriptionTier : 'basic',
    subscriptionStatus: toSubscriptionStatus(raw.subscriptionStatus),
    monthlyLimit: typeof raw.monthlyLimit === 'number' ? raw.monthlyLimit : 0,
    usedDeliveries: typeof raw.usedDeliveries === 'number' ? raw.usedDeliveries : 0,
  };
}

function formatBusinessNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 10) {
    return value;
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

function getTierLabel(tier: string): string {
  switch (tier) {
    case 'premium':
      return '프리미엄';
    case 'standard':
      return '스탠다드';
    default:
      return '베이직';
  }
}

function getTierColor(tier: string): string {
  switch (tier) {
    case 'premium':
      return Colors.accent;
    case 'standard':
      return Colors.primary;
    default:
      return Colors.textSecondary;
  }
}

function getStatusLabel(status: SubscriptionStatus): string {
  switch (status) {
    case 'active':
      return '이용 중';
    case 'suspended':
      return '일시 중지';
    case 'cancelled':
      return '해지';
    default:
      return '확인 필요';
  }
}

function getStatusColor(status: SubscriptionStatus): string {
  switch (status) {
    case 'active':
      return Colors.success;
    case 'suspended':
      return Colors.warning;
    case 'cancelled':
      return Colors.error;
    default:
      return Colors.textSecondary;
  }
}

export default function BusinessProfileScreen() {
  const navigation = useNavigation<EnterpriseLegacyStackNavigationProp>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [form, setForm] = useState<EditableProfile>({ companyName: '', ceoName: '', address: '', contact: '' });

  useEffect(() => {
    void loadProfile();
  }, []);

  async function loadProfile(): Promise<void> {
    try {
      setLoading(true);
      const userId = requireUserId();
      const businessData = await enterpriseLegacyFirestoreService.getBusinessInfo(userId);

      if (!businessData || typeof businessData !== 'object') {
        setProfile(null);
        return;
      }

      const mappedProfile = mapBusinessProfile(userId, businessData as Record<string, unknown>);
      setProfile(mappedProfile);
      setForm({
        companyName: mappedProfile.companyName,
        ceoName: mappedProfile.ceoName,
        address: mappedProfile.address,
        contact: mappedProfile.contact,
      });
    } catch (error) {
      console.error('Failed to load business profile', error);
      Alert.alert('불러오기 실패', '기업 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  function handleFieldChange(field: keyof EditableProfile, value: string): void {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleCancel(): void {
    if (profile) {
      setForm({
        companyName: profile.companyName,
        ceoName: profile.ceoName,
        address: profile.address,
        contact: profile.contact,
      });
    }
    setEditing(false);
  }

  async function handleSave(): Promise<void> {
    if (!form.companyName.trim() || !form.ceoName.trim() || !form.address.trim() || !form.contact.trim()) {
      Alert.alert('입력 확인', '회사명, 대표자명, 주소, 연락처를 모두 입력해 주세요.');
      return;
    }

    try {
      setSaving(true);
      const userId = requireUserId();
      await updateDoc(doc(db, 'users', userId), {
        companyName: form.companyName.trim(),
        ceoName: form.ceoName.trim(),
        address: form.address.trim(),
        contact: form.contact.trim(),
        updatedAt: new Date(),
      });

      Alert.alert('저장 완료', '기업 프로필을 업데이트했습니다.');
      setEditing(false);
      await loadProfile();
    } catch (error) {
      console.error('Failed to update business profile', error);
      Alert.alert('저장 실패', '기업 프로필을 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="business-outline" size={56} color={Colors.textTertiary} />
        <Text style={styles.emptyTitle}>기업 정보를 찾지 못했습니다.</Text>
        <Text style={styles.emptyDescription}>기업 고객 계약 또는 사업자 정보가 아직 연결되지 않았습니다. 운영팀과 연결 상태를 확인해 주세요.</Text>
      </View>
    );
  }

  const usageRatio = profile.monthlyLimit > 0 ? profile.usedDeliveries / profile.monthlyLimit : 0;
  const usagePercent = Math.min(usageRatio * 100, 100);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroIcon}>
            <Ionicons name="business" size={28} color={Colors.primary} />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>{profile.companyName || '기업 프로필'}</Text>
            <Text style={styles.heroSubtitle}>{profile.businessType}</Text>
          </View>
          {!editing && (
            <TouchableOpacity style={styles.editPill} onPress={() => setEditing(true)}>
              <Ionicons name="create-outline" size={16} color={Colors.primary} />
              <Text style={styles.editPillText}>수정</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: `${getTierColor(profile.subscriptionTier)}18` }]}>
            <Text style={[styles.badgeText, { color: getTierColor(profile.subscriptionTier) }]}>{getTierLabel(profile.subscriptionTier)}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: `${getStatusColor(profile.subscriptionStatus)}18` }]}>
            <Text style={[styles.badgeText, { color: getStatusColor(profile.subscriptionStatus) }]}>{getStatusLabel(profile.subscriptionStatus)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>기본 정보</Text>
        <InfoRow label="사업자등록번호" value={formatBusinessNumber(profile.businessNumber)} />
        <EditableRow label="대표자" editing={editing} value={form.ceoName} displayValue={profile.ceoName} placeholder="대표자명을 입력해 주세요" onChangeText={(value) => handleFieldChange('ceoName', value)} />
        <EditableRow label="회사명" editing={editing} value={form.companyName} displayValue={profile.companyName} placeholder="회사명을 입력해 주세요" onChangeText={(value) => handleFieldChange('companyName', value)} />
        <EditableRow label="주소" editing={editing} value={form.address} displayValue={profile.address} placeholder="사업장 주소를 입력해 주세요" multiline onChangeText={(value) => handleFieldChange('address', value)} />
        <EditableRow label="연락처" editing={editing} value={form.contact} displayValue={profile.contact} placeholder="담당자 연락처를 입력해 주세요" keyboardType="phone-pad" onChangeText={(value) => handleFieldChange('contact', value)} />
        <InfoRow label="이메일" value={profile.email || '등록되지 않음'} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>구독 사용량</Text>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>월 배송 사용량</Text>
          <Text style={styles.progressValue}>{profile.usedDeliveries} / {profile.monthlyLimit || '무제한'}</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${usagePercent}%` }]} />
        </View>
        <Text style={styles.progressHint}>현재 플랜은 {getTierLabel(profile.subscriptionTier)}이며, 사용량이 늘어나면 상위 플랜 전환을 검토할 수 있습니다.</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('SubscriptionTierSelection')}>
          <Ionicons name="sparkles-outline" size={18} color={Colors.primary} />
          <Text style={styles.secondaryButtonText}>구독 플랜 보기</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>운영 연결</Text>
        <ActionRow icon="receipt-outline" title="세금계산서 발행" description="이번 달 공급가액과 부가세 기준으로 발행 요청을 보냅니다." onPress={() => navigation.navigate('TaxInvoiceRequest')} />
        <ActionRow icon="wallet-outline" title="월 정산 확인" description="지급 대기, 지급 완료, 운영 검토 메모를 한 화면에서 확인합니다." onPress={() => navigation.navigate('MonthlySettlement')} />
      </View>

      {editing ? (
        <View style={styles.footerActions}>
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
            <Text style={styles.cancelButtonText}>취소</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveButton} onPress={() => void handleSave()} disabled={saving}>
            {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveButtonText}>저장</Text>}
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function EditableRow({
  label,
  value,
  displayValue,
  editing,
  placeholder,
  onChangeText,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  displayValue: string;
  editing: boolean;
  placeholder: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  keyboardType?: 'default' | 'phone-pad';
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {editing ? (
        <TextInput
          style={[styles.input, multiline ? styles.multilineInput : null]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          multiline={multiline}
          keyboardType={keyboardType ?? 'default'}
        />
      ) : (
        <Text style={styles.value}>{displayValue || '미등록'}</Text>
      )}
    </View>
  );
}

function ActionRow({ icon, title, description, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; description: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.actionRow} onPress={onPress}>
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={20} color={Colors.primary} />
      </View>
      <View style={styles.actionText}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.background,
  },
  emptyTitle: {
    marginTop: Spacing.sm,
    fontSize: Typography.fontSize.xl,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  emptyDescription: {
    marginTop: Spacing.xs,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
    color: Colors.textSecondary,
  },
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    flex: 1,
    marginLeft: 14,
  },
  heroTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  heroSubtitle: {
    marginTop: 4,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.gray100,
  },
  editPillText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  row: {
    marginBottom: Spacing.sm,
  },
  label: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  value: {
    fontSize: Typography.fontSize.sm,
    lineHeight: 22,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
  },
  multilineInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  progressValue: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  progressTrack: {
    marginTop: 12,
    height: 10,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.gray200,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
  },
  progressHint: {
    marginTop: 12,
    fontSize: Typography.fontSize.xs,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  secondaryButton: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.gray100,
  },
  secondaryButtonText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: Colors.primary,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  actionDescription: {
    marginTop: 4,
    fontSize: Typography.fontSize.xs,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.gray200,
  },
  cancelButtonText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  saveButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
  },
  saveButtonText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: Colors.white,
  },
});
