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
import { b2bFirestoreService } from '../../services/b2b-firestore-service';
import { db, requireUserId } from '../../services/firebase';
import type { B2BStackNavigationProp } from '../../types/navigation';

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
      return '#7C3AED';
    case 'standard':
      return '#2563EB';
    default:
      return '#64748B';
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
      return '#16A34A';
    case 'suspended':
      return '#D97706';
    case 'cancelled':
      return '#DC2626';
    default:
      return '#64748B';
  }
}

export default function BusinessProfileScreen() {
  const navigation = useNavigation<B2BStackNavigationProp>();
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
      const businessData = await b2bFirestoreService.getBusinessInfo(userId);

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
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="business-outline" size={56} color="#94A3B8" />
        <Text style={styles.emptyTitle}>기업 정보를 찾지 못했습니다.</Text>
        <Text style={styles.emptyDescription}>B2B 계약 또는 사업자 정보가 아직 연결되지 않았습니다. 운영팀과 연결 상태를 확인해 주세요.</Text>
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
            <Ionicons name="business" size={28} color="#2563EB" />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>{profile.companyName || '기업 프로필'}</Text>
            <Text style={styles.heroSubtitle}>{profile.businessType}</Text>
          </View>
          {!editing && (
            <TouchableOpacity style={styles.editPill} onPress={() => setEditing(true)}>
              <Ionicons name="create-outline" size={16} color="#2563EB" />
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
          <Ionicons name="sparkles-outline" size={18} color="#2563EB" />
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
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>저장</Text>}
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
        <Ionicons name={icon} size={20} color="#2563EB" />
      </View>
      <View style={styles.actionText}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    gap: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F8FAFC',
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptyDescription: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: '#64748B',
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    flex: 1,
    marginLeft: 14,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  heroSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#64748B',
  },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
  },
  editPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
  },
  row: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
  },
  value: {
    fontSize: 15,
    lineHeight: 22,
    color: '#0F172A',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
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
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  progressValue: {
    fontSize: 14,
    color: '#475569',
  },
  progressTrack: {
    marginTop: 12,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#2563EB',
  },
  progressHint: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 20,
    color: '#64748B',
  },
  secondaryButton: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2563EB',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  actionDescription: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: '#64748B',
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
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  saveButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 16,
    backgroundColor: '#2563EB',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
