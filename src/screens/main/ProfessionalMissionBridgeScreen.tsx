import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';

import { deliveryPartnerService } from '../../services/delivery-partner-service';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../theme';
import type { MainStackNavigationProp, MainStackParamList } from '../../types/navigation';

type BridgeRoute = RouteProp<MainStackParamList, 'ProfessionalMissionBridge'>;

export default function ProfessionalMissionBridgeScreen() {
  const navigation = useNavigation<MainStackNavigationProp>();
  const route = useRoute<BridgeRoute>();
  const { missionTitle, missionWindow, reason, requestId, deliveryId } = route.params;
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<{
    activePartnerCount: number;
    connectedPartnerCount: number;
    apiReadyPartnerCount: number;
    fallbackOnlyPartnerCount: number;
    topPartnerNames: string[];
  } | null>(null);
  const [dispatchRows, setDispatchRows] = useState<
    Array<{
      dispatchId: string;
      partnerName: string;
      status: string;
      dispatchMethod: string;
      updatedAtLabel: string;
    }>
  >([]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const [nextSummary, dispatches] = await Promise.all([
          deliveryPartnerService.getBridgeSummary(),
          requestId || deliveryId
            ? deliveryPartnerService.getDispatchSummary({
                ...(requestId ? { requestId } : {}),
                ...(deliveryId ? { deliveryId } : {}),
              })
            : Promise.resolve([]),
        ]);
        if (mounted) {
          setSummary(nextSummary);
          const rows = dispatches
            .slice(0, 4)
            .map((dispatch) => ({
              dispatchId: dispatch.dispatchId,
              partnerName: dispatch.partnerName,
              status: dispatch.status,
              dispatchMethod: dispatch.dispatchMethod,
              updatedAtLabel: dispatch.updatedAt.toLocaleString('ko-KR', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              }),
            }));
          setDispatchRows(rows);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>전문 길러 연동</Text>
        <Text style={styles.title}>{missionTitle}</Text>
        <Text style={styles.subtitle}>{missionWindow ?? '연동 가능 여부를 먼저 확인합니다.'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>현재 안내</Text>
        <Text style={styles.body}>
          {reason ?? '이 미션은 일반 길러 앱 수행이 아니라 외부 연동 또는 파트너 처리 흐름으로 연결될 수 있습니다.'}
        </Text>
        {requestId ? <Text style={styles.meta}>요청 ID: {requestId}</Text> : null}
        {deliveryId ? <Text style={styles.meta}>배송 ID: {deliveryId}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>연결 준비</Text>
        <View style={styles.row}>
          <MaterialIcons name="link" size={18} color={Colors.primary} />
          <Text style={styles.rowText}>전문 길러 API 또는 파트너 수락 응답 연결 지점</Text>
        </View>
        <View style={styles.row}>
          <MaterialIcons name="visibility" size={18} color={Colors.primary} />
          <Text style={styles.rowText}>이용자에게는 진행 상태만 계속 노출</Text>
        </View>
        <View style={styles.row}>
          <MaterialIcons name="photo-camera" size={18} color={Colors.primary} />
          <Text style={styles.rowText}>완료 증빙은 외부 응답 또는 운영 업로드와 연결 예정</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>현재 연동 상태</Text>
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.rowText}>연동 준비 상태를 불러오는 중입니다.</Text>
          </View>
        ) : summary ? (
          <View style={styles.summaryList}>
            <Text style={styles.rowText}>활성 업체 {summary.activePartnerCount}개</Text>
            <Text style={styles.rowText}>연결 확인 {summary.connectedPartnerCount}개</Text>
            <Text style={styles.rowText}>API 준비 {summary.apiReadyPartnerCount}개</Text>
            <Text style={styles.rowText}>fallback 전용 {summary.fallbackOnlyPartnerCount}개</Text>
            {summary.topPartnerNames.length > 0 ? (
              <Text style={styles.meta}>대표 업체: {summary.topPartnerNames.join(', ')}</Text>
            ) : null}
          </View>
        ) : (
          <Text style={styles.rowText}>등록된 배송업체 상태를 아직 확인하지 못했습니다.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>위임 진행</Text>
        {dispatchRows.length > 0 ? (
          <View style={styles.summaryList}>
            {dispatchRows.map((item) => (
              <View key={item.dispatchId} style={styles.dispatchRow}>
                <View style={styles.dispatchCopy}>
                  <Text style={styles.dispatchTitle}>{item.partnerName}</Text>
                  <Text style={styles.meta}>
                    {item.status} · {item.dispatchMethod} · {item.updatedAtLabel}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.rowText}>아직 이 미션에 연결된 업체 위임 이력이 없습니다.</Text>
        )}
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('Tabs', { screen: 'GillerRequests' })}
      >
        <Text style={styles.primaryButtonText}>미션 보드로 돌아가기</Text>
      </TouchableOpacity>

      {requestId ? (
        <TouchableOpacity
          style={styles.secondaryButton}
          activeOpacity={0.9}
          onPress={() => navigation.navigate('RequestDetail', { requestId })}
        >
          <Text style={styles.secondaryButtonText}>요청 상세 보기</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  hero: {
    backgroundColor: Colors.primaryMint,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  kicker: {
    color: Colors.primary,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
  },
  body: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  meta: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.xs,
    lineHeight: 18,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  summaryList: {
    gap: Spacing.xs,
  },
  dispatchRow: {
    paddingVertical: Spacing.xs,
  },
  dispatchCopy: {
    gap: 4,
  },
  dispatchTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  rowText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
  },
});
