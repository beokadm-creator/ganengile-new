/**
 * Notification Settings Screen
 * 푸시 알림 설정 화면
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import type { MainStackNavigationProp } from '../../types/navigation';
import { createNotificationService } from '../../services/notification-service';
import { NotificationType } from '../../types/chat';
import type { NotificationSettings } from '../../types/chat';

type Props = {
  navigation: MainStackNavigationProp;
};

const NOTIFICATION_LABELS: Record<NotificationType, { title: string; description: string }> = {
  [NotificationType.MATCH_FOUND]: {
    title: '매칭 찾음',
    description: '내 동선과 매칭되는 배송 요청이 있을 때 알림',
  },
  [NotificationType.MATCH_ACCEPTED]: {
    title: '매칭 수락',
    description: '길러가 배송을 수락했을 때 알림',
  },
  [NotificationType.MATCH_CANCELLED]: {
    title: '매칭 취소',
    description: '매칭이 취소되었을 때 알림',
  },
  [NotificationType.PICKUP_REQUESTED]: {
    title: '픽업 요청',
    description: '배송자가 픽업을 요청했을 때 알림',
  },
  [NotificationType.PICKUP_VERIFIED]: {
    title: '픽업 완료',
    description: '픽업이 인증되었을 때 알림',
  },
  [NotificationType.DELIVERY_COMPLETED]: {
    title: '배송 완료',
    description: '배송이 완료되었을 때 알림',
  },
  [NotificationType.NEW_MESSAGE]: {
    title: '새 메시지',
    description: '새로운 채팅 메시지가 도착했을 때 알림',
  },
  [NotificationType.RATING_RECEIVED]: {
    title: '새 평가',
    description: '새로운 평가가 등록되었을 때 알림',
  },
};

export default function NotificationSettingsScreen({ navigation }: Props) {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const notificationService = useRef(createNotificationService()).current;

  const loadSettings = useCallback(() => {
    const unsubscribe = notificationService.subscribeToNotificationSettings((s: NotificationSettings) => {
      setSettings(s);
      setLoading(false);
    });

    return unsubscribe;
  }, [notificationService]);

  useEffect(() => {
    const unsubscribe = loadSettings();
    return () => {
      unsubscribe?.();
    };
  }, [loadSettings]);

  const handleToggleEnabled = useCallback(async () => {
    if (!settings) return;

    await notificationService.setNotificationsEnabled(!settings.enabled);
  }, [settings, notificationService]);

  const handleToggleType = useCallback(async (type: NotificationType) => {
    if (!settings) return;

    await notificationService.setNotificationTypeEnabled(type, !settings.settings[type]);
  }, [settings, notificationService]);

  const handleToggleQuietHours = useCallback(async () => {
    if (!settings) return;

    await notificationService.updateNotificationSettings({
      quietHours: {
        enabled: !settings.quietHours?.enabled,
        startTime: settings.quietHours?.startTime || '22:00',
        endTime: settings.quietHours?.endTime || '08:00',
      },
    });
  }, [settings, notificationService]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>알림 사용</Text>
            <Text style={styles.settingDescription}>
              푸시 알림을 받으려면 켜주세요
            </Text>
          </View>
          <Switch
            value={settings?.enabled ?? false}
            onValueChange={handleToggleEnabled}
            trackColor={{ false: '#e0e0e0', true: '#4CAF50' }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {settings?.enabled && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>알림 종류</Text>

            {Object.values(NotificationType).map((type) => (
              <View key={type} style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>
                    {NOTIFICATION_LABELS[type].title}
                  </Text>
                  <Text style={styles.settingDescription}>
                    {NOTIFICATION_LABELS[type].description}
                  </Text>
                </View>
                <Switch
                  value={settings?.settings[type] ?? false}
                  onValueChange={() => handleToggleType(type)}
                  trackColor={{ false: '#e0e0e0', true: '#4CAF50' }}
                  thumbColor="#fff"
                />
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>방해 금지 시간대</Text>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>방해 금지 모드</Text>
                <Text style={styles.settingDescription}>
                  설정된 시간대에는 알림을 받지 않습니다
                </Text>
              </View>
              <Switch
                value={settings?.quietHours?.enabled ?? false}
                onValueChange={handleToggleQuietHours}
                trackColor={{ false: '#e0e0e0', true: '#4CAF50' }}
                thumbColor="#fff"
              />
            </View>

            {settings?.quietHours?.enabled && (
              <>
                <View style={styles.timePickerContainer}>
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => {
                    }}
                  >
                    <Text style={styles.timeLabel}>시작 시간</Text>
                    <Text style={styles.timeValue}>
                      {settings.quietHours.startTime || '22:00'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => {
                    }}
                  >
                    <Text style={styles.timeLabel}>종료 시간</Text>
                    <Text style={styles.timeValue}>
                      {settings.quietHours.endTime || '08:00'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f5f5f5',
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionTitle: {
    color: '#666',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 8,
  },
  settingDescription: {
    color: '#666',
    fontSize: 13,
    lineHeight: 18,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingItem: {
    alignItems: 'center',
    borderBottomColor: '#f0f0f0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingTitle: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  timeButton: {
    alignItems: 'center',
  },
  timeLabel: {
    color: '#666',
    fontSize: 13,
    marginBottom: 8,
  },
  timePickerContainer: {
    borderTopColor: '#f0f0f0',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
  },
  timeValue: {
    color: '#4CAF50',
    fontSize: 24,
    fontWeight: 'bold',
  },
});
