/**
 * Onetime Mode Screen
 * 일회성 모드 활성화 화면 - 정기 동선 없이 배송 요청
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

interface OnetimeModeState {
  enabled: boolean;
  preferredLine?: string;
  preferredTime?: string;
}

export default function OnetimeModeScreen({ navigation }: any) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [onetimeMode, setOnetimeMode] = useState<OnetimeModeState>({
    enabled: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setOnetimeMode({
          enabled: data.onetimeModeEnabled || false,
          preferredLine: data.preferredLine,
          preferredTime: data.preferredTime,
        });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const handleToggle = async (value: boolean) => {
    if (!user?.uid) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        onetimeModeEnabled: value,
      });

      setOnetimeMode((prev) => ({ ...prev, enabled: value }));

      if (value) {
        Alert.alert(
          '일회성 모드 활성화',
          '정기 동선 없이 배송을 요청할 수 있습니다.\n\n단, 매칭 확률이 낮을 수 있습니다.',
          [{ text: '확인' }]
        );
      }
    } catch (error) {
      console.error('Error toggling onetime mode:', error);
      Alert.alert('오류', '일회성 모드 설정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>일회성 모드</Text>
        <Text style={styles.subtitle}>
          정기 동선 없이 편하게 배송을 요청하세요
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* 설명 카드 */}
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>💡</Text>
          <Text style={styles.infoTitle}>일회성 모드란?</Text>
          <Text style={styles.infoDescription}>
            정기 동선을 등록하지 않고도, 필요할 때마다 배송을 요청할 수 있는 모드입니다.
          </Text>
          <View style={styles.infoList}>
            <View style={styles.infoItem}>
              <Text style={styles.infoBullet}>✓</Text>
              <Text style={styles.infoText}>동선 등록 불필요</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoBullet}>✓</Text>
              <Text style={styles.infoText}>필요할 때만 요청</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoBullet}>!</Text>
              <Text style={styles.infoTextWarning}>매칭 확률이 낮을 수 있음</Text>
            </View>
          </View>
        </View>

        {/* 토글 스위치 */}
        <View style={styles.toggleCard}>
          <View style={styles.toggleContent}>
            <Text style={styles.toggleTitle}>일회성 모드</Text>
            <Text style={styles.toggleSubtitle}>
              {onetimeMode.enabled ? '활성화됨' : '비활성화됨'}
            </Text>
          </View>
          <Switch
            value={onetimeMode.enabled}
            onValueChange={handleToggle}
            disabled={saving}
            trackColor={{ false: '#ccc', true: Colors.primary }}
            thumbColor="#fff"
          />
        </View>

        {/* 비교 카드 */}
        <View style={styles.comparisonCard}>
          <Text style={styles.comparisonTitle}>모드 비교</Text>

          <View style={styles.comparisonRow}>
            <View style={styles.comparisonColumn}>
              <Text style={styles.comparisonModeTitle}>정기 동선 모드</Text>
              <View style={styles.comparisonPros}>
                <Text style={styles.comparisonProsTitle}>장점</Text>
                <Text style={styles.comparisonItem}>✅ 매칭 확률 높음</Text>
                <Text style={styles.comparisonItem}>✅ 수수료 할인</Text>
                <Text style={styles.comparisonItem}>✅ 정기 수익</Text>
              </View>
            </View>

            <View style={styles.comparisonDivider} />

            <View style={styles.comparisonColumn}>
              <Text style={styles.comparisonModeTitle}>일회성 모드</Text>
              <View style={styles.comparisonPros}>
                <Text style={styles.comparisonProsTitle}>장점</Text>
                <Text style={styles.comparisonItem}>✅ 동선 등록 불필요</Text>
                <Text style={styles.comparisonItem}>✅ 유연한 사용</Text>
                <Text style={styles.comparisonItem}>✅ 즉시 요청 가능</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 주의사항 */}
        <View style={styles.warningCard}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <View style={styles.warningContent}>
            <Text style={styles.warningTitle}>주의사항</Text>
            <Text style={styles.warningText}>
              일회성 모드는 정기 동선이 없는 길러를 찾기 어려울 수 있습니다.
              빠른 매칭을 위해 정기 동선 등록을 권장합니다.
            </Text>
          </View>
        </View>

        {/* 정기 동선 등록 버튼 */}
        <TouchableOpacity
          style={styles.registerRouteButton}
          onPress={() => navigation.navigate('AddRoute')}
        >
          <Text style={styles.registerRouteButtonText}>정기 동선 등록하러 가기</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  content: {
    padding: Spacing.md,
  },
  infoCard: {
    backgroundColor: Colors.primary + '10',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  infoIcon: {
    fontSize: 32,
    marginBottom: Spacing.sm,
  },
  infoTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  infoDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  infoList: {
    marginTop: Spacing.sm,
  },
  infoItem: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  infoBullet: {
    fontSize: 16,
    marginRight: Spacing.sm,
  },
  infoText: {
    ...Typography.body,
    color: Colors.text,
    flex: 1,
  },
  infoTextWarning: {
    ...Typography.body,
    color: Colors.error,
    flex: 1,
  },
  toggleCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  toggleContent: {
    flex: 1,
  },
  toggleTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  toggleSubtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  comparisonCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  comparisonTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  comparisonRow: {
    flexDirection: 'row',
  },
  comparisonColumn: {
    flex: 1,
  },
  comparisonModeTitle: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  comparisonPros: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
  },
  comparisonProsTitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  comparisonItem: {
    ...Typography.bodySmall,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  comparisonDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.sm,
  },
  warningCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  warningIcon: {
    fontSize: 24,
    marginRight: Spacing.md,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    ...Typography.body,
    color: '#E65100',
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  warningText: {
    ...Typography.bodySmall,
    color: '#BF360C',
  },
  registerRouteButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  registerRouteButtonText: {
    ...Typography.body,
    color: '#fff',
    fontWeight: '600',
  },
});
