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
          <Switch value={enabled} onValueChange={setEnabled} />
        </View>

        <View style={styles.row}>
          <View style={styles.copy}>
            <Text style={styles.sectionTitle}>환승 허용</Text>
            <Text style={styles.helper}>환승이 포함된 일회성 요청도 받을지 정합니다.</Text>
          </View>
          <Switch value={allowTransfer} onValueChange={setAllowTransfer} />
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
        {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>설정 저장</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, gap: 16 },
  header: { gap: 8 },
  title: { fontSize: 28, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 15, lineHeight: 22, color: '#64748B' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, gap: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  copy: { flex: 1, gap: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  helper: { fontSize: 14, lineHeight: 20, color: '#64748B' },
  chipRow: { flexDirection: 'row', gap: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: '#E2E8F0' },
  chipActive: { backgroundColor: '#DBEAFE' },
  chipText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  chipTextActive: { color: '#1D4ED8' },
  primaryButton: { alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 18, backgroundColor: '#2563EB' },
  primaryButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
