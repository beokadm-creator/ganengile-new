import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { NaverMapCard } from '../../components/maps/NaverMapCard';
import { auth } from '../../services/firebase';
import { b2bFirestoreService, type MonthlyStats, type Settlement, type TaxInvoice } from '../../services/b2b-firestore-service';
import type { B2BStackParamList } from '../../types/navigation';

type NavigationProp = StackNavigationProp<B2BStackParamList, 'B2BDashboard'>;
type Props = { navigation: NavigationProp };
type RecentDeliveryMap = { id: string; pickup?: { latitude?: number; longitude?: number; station?: string }; dropoff?: { latitude?: number; longitude?: number; station?: string } };

function formatCurrency(amount: number): string { return `${amount.toLocaleString('ko-KR')}원`; }
function getStatusColor(status: string): string { switch (status) { case 'issued': case 'pending': return '#D97706'; case 'paid': case 'completed': return '#16A34A'; case 'overdue': return '#DC2626'; default: return '#64748B'; } }
function getStatusText(status: string): string { switch (status) { case 'issued': return '발행 완료'; case 'paid': return '지급 완료'; case 'pending': return '검토 대기'; case 'completed': return '정산 완료'; case 'overdue': return '추가 확인'; default: return '상태 확인'; } }

export default function B2BDashboardScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<MonthlyStats>({ totalDeliveries: 0, totalAmount: 0, avgCostPerDelivery: 0 });
  const [taxInvoices, setTaxInvoices] = useState<TaxInvoice[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [recentDeliveries, setRecentDeliveries] = useState<RecentDeliveryMap[]>([]);
  const [currentPeriod, setCurrentPeriod] = useState('');

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      if (!currentUser) { setLoading(false); return; }
      const businessId = currentUser.uid;
      const { year, month } = b2bFirestoreService.getCurrentYearMonth();
      setCurrentPeriod(b2bFirestoreService.getPeriodText(year, month));
      const [statsData, invoicesData, settlementsData, deliveriesData] = await Promise.all([b2bFirestoreService.getMonthlyStats(businessId, year, month), b2bFirestoreService.getTaxInvoices(businessId, 10), b2bFirestoreService.getSettlements(businessId, 10), b2bFirestoreService.getRecentDeliveries(businessId, 6)]);
      if (statsData) setStats(statsData);
      setTaxInvoices(invoicesData);
      setSettlements(settlementsData);
      setRecentDeliveries(deliveriesData as RecentDeliveryMap[]);
    } catch (error) {
      console.error('Failed to load B2B dashboard', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadDashboardData(); }, [loadDashboardData]);

  const pendingSettlementCount = useMemo(() => settlements.filter((item) => item.status === 'pending').length, [settlements]);
  const pendingInvoiceCount = useMemo(
    () => taxInvoices.filter((item) => item.status !== 'issued' && item.status !== 'paid').length,
    [taxInvoices]
  );
  const mapMarkers = useMemo(() => recentDeliveries.flatMap((item, index) => {
    const markers: Array<{ latitude: number; longitude: number; label: string }> = [];
    if (typeof item.pickup?.latitude === 'number' && typeof item.pickup?.longitude === 'number') markers.push({ latitude: item.pickup.latitude, longitude: item.pickup.longitude, label: `P${index + 1}` });
    if (typeof item.dropoff?.latitude === 'number' && typeof item.dropoff?.longitude === 'number') markers.push({ latitude: item.dropoff.latitude, longitude: item.dropoff.longitude, label: `D${index + 1}` });
    return markers;
  }), [recentDeliveries]);
  const mapCenter = mapMarkers[0] ?? { latitude: 37.5665, longitude: 126.978, label: 'Seoul' };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2563EB" /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}><Text style={styles.kicker}>가는길에 기업 운영</Text><Text style={styles.title}>기업 배송 운영 홈</Text><Text style={styles.subtitle}>배송 요청, 세금계산서, 월 정산, 운영 검토를 한 화면에서 관리합니다.</Text></View>
      <NaverMapCard center={mapCenter} markers={mapMarkers.slice(0, 8)} title="최근 기업 배송 구간" subtitle="최근 배송 좌표가 있으면 실제 구간을 보여주고, 없으면 서울 기준으로 시작합니다." />
      <View style={styles.noticeCard}><Text style={styles.noticeTitle}>이번 달 운영 우선순위</Text><Text style={styles.noticeBody}>검토 대기 세금계산서 {pendingInvoiceCount}건, 검토 대기 정산 {pendingSettlementCount}건</Text><Text style={styles.noticeBody}>현재 구조는 자동 이체보다 운영 검토 후 지급하는 흐름을 기준으로 관리합니다.</Text></View>
      <View style={styles.card}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>이번 달 운영 현황</Text><Text style={styles.sectionMeta}>{currentPeriod || '현재 월'}</Text></View><View style={styles.statsRow}><StatCard label="배송 건수" value={`${stats.totalDeliveries}건`} /><StatCard label="총 배송 금액" value={formatCurrency(stats.totalAmount)} /><StatCard label="건당 평균" value={formatCurrency(stats.avgCostPerDelivery)} /></View></View>
      <View style={styles.actionsRow}><ActionButton title="배송 요청" subtitle="기업 전용 배송 요청을 바로 생성합니다." onPress={() => navigation.navigate('B2BRequest')} /><ActionButton title="기업 프로필" subtitle="사업자 정보와 구독 상태를 확인합니다." onPress={() => navigation.navigate('BusinessProfile')} /></View>
      <View style={styles.actionsRow}><ActionButton title="세금계산서" subtitle="발행 요청과 최근 발행 상태를 확인합니다." onPress={() => navigation.navigate('TaxInvoiceRequest')} /><ActionButton title="월 정산" subtitle="지급 대기와 리포트형 정산 내역을 관리합니다." onPress={() => navigation.navigate('MonthlySettlement')} /></View>
      <View style={styles.card}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>최근 세금계산서</Text><TouchableOpacity onPress={() => navigation.navigate('TaxInvoiceRequest')}><Text style={styles.linkText}>발행 요청</Text></TouchableOpacity></View>{taxInvoices.length > 0 ? taxInvoices.slice(0, 3).map((invoice) => <View key={invoice.id} style={styles.listItem}><View style={styles.listRow}><Text style={styles.listTitle}>{invoice.invoiceNumber}</Text><Text style={[styles.statusText, { color: getStatusColor(invoice.status) }]}>{getStatusText(invoice.status)}</Text></View><Text style={styles.listMeta}>{invoice.period}</Text><Text style={styles.listAmount}>{formatCurrency(invoice.totalAmount)}</Text></View>) : <EmptyText text="아직 생성된 세금계산서가 없습니다." />}</View>
      <View style={styles.card}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>최근 정산</Text><TouchableOpacity onPress={() => navigation.navigate('MonthlySettlement')}><Text style={styles.linkText}>정산 보드</Text></TouchableOpacity></View>{settlements.length > 0 ? settlements.slice(0, 3).map((settlement) => <View key={settlement.id} style={styles.listItem}><View style={styles.listRow}><Text style={styles.listTitle}>{settlement.period}</Text><Text style={[styles.statusText, { color: getStatusColor(settlement.status) }]}>{getStatusText(settlement.status)}</Text></View><Text style={styles.listMeta}>운영 검토 후 지급 상태가 확정됩니다.</Text><Text style={styles.listAmount}>{formatCurrency(settlement.totalAmount)}</Text></View>) : <EmptyText text="아직 정산 이력이 없습니다." />}</View>
    </ScrollView>
  );
}

function StatCard({ label, value }: { label: string; value: string }) { return <View style={styles.statCard}><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>; }
function ActionButton({ title, subtitle, onPress }: { title: string; subtitle: string; onPress: () => void }) { return <TouchableOpacity style={styles.actionCard} onPress={onPress}><Text style={styles.actionTitle}>{title}</Text><Text style={styles.actionSubtitle}>{subtitle}</Text></TouchableOpacity>; }
function EmptyText({ text }: { text: string }) { return <Text style={styles.emptyText}>{text}</Text>; }

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#F8FAFC' }, content: { gap: 16, padding: 20 }, loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' }, hero: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, gap: 6 }, kicker: { color: '#0F766E', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }, title: { color: '#0F172A', fontSize: 28, fontWeight: '800' }, subtitle: { color: '#475569', lineHeight: 22 }, noticeCard: { backgroundColor: '#FEF3C7', borderRadius: 20, borderWidth: 1, borderColor: '#FDE68A', padding: 16, gap: 4 }, noticeTitle: { color: '#92400E', fontWeight: '800' }, noticeBody: { color: '#78350F', lineHeight: 20 }, card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, gap: 12 }, sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, sectionTitle: { color: '#0F172A', fontSize: 18, fontWeight: '800' }, sectionMeta: { color: '#64748B' }, statsRow: { flexDirection: 'row', gap: 10 }, statCard: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 16, padding: 14, gap: 6 }, statLabel: { color: '#64748B', fontSize: 12 }, statValue: { color: '#0F172A', fontWeight: '800' }, actionsRow: { flexDirection: 'row', gap: 12 }, actionCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, gap: 6 }, actionTitle: { color: '#0F172A', fontWeight: '800' }, actionSubtitle: { color: '#64748B', fontSize: 13, lineHeight: 19 }, linkText: { color: '#0F766E', fontWeight: '700' }, listItem: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E2E8F0', paddingTop: 12, gap: 4 }, listRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, listTitle: { color: '#0F172A', fontWeight: '700' }, listMeta: { color: '#64748B', fontSize: 13 }, listAmount: { color: '#111827', fontWeight: '800' }, statusText: { fontWeight: '700' }, emptyText: { color: '#94A3B8' } });

