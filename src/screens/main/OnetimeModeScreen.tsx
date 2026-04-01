import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { db, requireUserId } from '../../services/firebase';
import type { MainStackNavigationProp } from '../../types/navigation';
import { Colors, Spacing, Typography, BorderRadius } from '../../theme';

export default function OnetimeModeScreen() {
  const navigation = useNavigation<MainStackNavigationProp>();
  const [enabled, setEnabled] = useState(false);
  const [allowTransfer, setAllowTransfer] = useState(true);
  const [maxDetourTime, setMaxDetourTime] = useState<5 | 10 | 15>(10);
  const [saving, setSaving] = useState(false);

  const handleSave = async (): Promise<void> => {
    try {
      setSaving(true);
      const userId = requireUserId();
      await updateDoc(doc(db, 'users', userId), {
        'onetimeMode.enabled': enabled,
        'onetimeMode.allowTransfer': allowTransfer,
        'onetimeMode.maxDetourTime': maxDetourTime,
        'onetimeMode.updatedAt': serverTimestamp(),
      });

      Alert.alert('설정 저장 완료', '일회성 모드 설정이 저장됐습니다.', [
        { text: '확인', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Failed to save onetime mode settings:', error);
      Alert.alert('설정 저장 실패', '잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>일회성 모드</Text>
        <Text style={styles.subtitle}>정기 동선이 아닌, 지금 가능한 즉시 수락 범위를 간단히 설정합니다.</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.copy}>
            <Text style={styles.sectionTitle}>모드 활성화</Text>
            <Text style={styles.helper}>켜면 즉시성 요청을 더 적극적으로 받습니다.</Text>
          </View>
          <Switch value={enabled} onValueChange={setEnabled} trackColor={{ false: Colors.border, true: Colors.primaryLight }} thumbColor={Colors.surface} />
        </View>

        <View style={styles.row}>
          <View style={styles.copy}>
            <Text style={styles.sectionTitle}>환승 허용</Text>
            <Text style={styles.helper}>환승이 포함된 일회성 요청도 받을지 정합니다.</Text>
          </View>
          <Switch value={allowTransfer} onValueChange={setAllowTransfer} trackColor={{ false: Colors.border, true: Colors.primaryLight }} thumbColor={Colors.surface} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>허용 우회 시간</Text>
        <View style={styles.chipRow}>
          {[5, 10, 15].map((value) => {
            const active = maxDetourTime === value;
            return (
              <TouchableOpacity
                key={value}
                style={[styles.chip, active ? styles.chipActive : undefined]}
                onPress={() => setMaxDetourTime(value as 5 | 10 | 15)}
              >
                <Text style={[styles.chipText, active ? styles.chipTextActive : undefined]}>{value}분</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={() => void handleSave()} disabled={saving}>
        {saving ? <ActivityIndicator size="small" color={Colors.surface} /> : <Text style={styles.primaryButtonText}>설정 저장</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xl, gap: Spacing.lg },
  header: { gap: Spacing.sm },
  title: { fontSize: Typography.fontSize['3xl'], fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: Typography.fontSize.base, lineHeight: 22, color: Colors.textSecondary },
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl, gap: Spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.md },
  copy: { flex: 1, gap: Spacing.xs },
  sectionTitle: { fontSize: Typography.fontSize.xl, fontWeight: '800', color: Colors.textPrimary },
  helper: { fontSize: Typography.fontSize.base, lineHeight: 20, color: Colors.textSecondary },
  chipRow: { flexDirection: 'row', gap: Spacing.sm },
  chip: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, backgroundColor: Colors.border },
  chipActive: { backgroundColor: Colors.primaryMint },
  chipText: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.textSecondary },
  chipTextActive: { color: Colors.primary },
  primaryButton: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.lg, borderRadius: BorderRadius.lg, backgroundColor: Colors.primary },
  primaryButtonText: { fontSize: Typography.fontSize.base, fontWeight: '700', color: Colors.surface },
});
