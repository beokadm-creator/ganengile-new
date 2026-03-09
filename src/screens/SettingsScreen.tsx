/**
 * Settings Screen
 * 앱 설정: 알림, Dark Mode, 계정 등
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';

interface SettingsSection {
  title: string;
  items: SettingsItem[];
}

interface SettingsItem {
  type: 'toggle' | 'navigation' | 'action';
  title: string;
  subtitle?: string;
  icon: string;
  value?: boolean;
  onPress?: () => void;
  onValueChange?: (value: boolean) => void;
}

export const SettingsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors, isDark, setColorScheme } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [_darkMode, setDarkMode] = useState(isDark);

  const handleLogout = () => {
    Alert.alert(
      '로그아웃',
      '정말 로그아웃하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '로그아웃',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
              console.log('User logged out');
            } catch (error) {
              console.error('Logout error:', error);
            }
          }
        }
      ]
    );
  };

  const settingsSections: SettingsSection[] = [
    {
      title: '일반',
      items: [
        {
          type: 'toggle',
          title: 'Dark Mode',
          subtitle: isDark ? '🌙 다크 모드 사용 중' : '☀️ 라이트 모드 사용 중',
          icon: '🌙',
          value: isDark,
          onValueChange: (value) => {
            setDarkMode(value);
            setColorScheme(value ? 'dark' : 'light');
          }
        },
        {
          type: 'navigation',
          title: '언어',
          subtitle: '한국어',
          icon: '🌐',
          onPress: () => {
            Alert.alert('언어 설정', '현재 한국어만 지원됩니다.');
          }
        }
      ]
    },
    {
      title: '알림',
      items: [
        {
          type: 'toggle',
          title: '푸시 알림',
          subtitle: '배송 업데이트 알림',
          icon: '🔔',
          value: notificationsEnabled,
          onValueChange: setNotificationsEnabled
        },
        {
          type: 'toggle',
          title: '이메일 알림',
          subtitle: '이메일로 소식 받기',
          icon: '📧',
          value: emailNotifications,
          onValueChange: setEmailNotifications
        }
      ]
    },
    {
      title: '개인정보',
      items: [
        {
          type: 'toggle',
          title: '위치 서비스',
          subtitle: '배송 추적을 위해 사용',
          icon: '📍',
          value: locationEnabled,
          onValueChange: setLocationEnabled
        },
        {
          type: 'navigation',
          title: '데이터 관리',
          subtitle: '캐시, 쿠키 삭제',
          icon: '🗑️',
          onPress: () => {
            Alert.alert(
              '데이터 삭제',
              '캐시와 쿠키를 삭제하시겠습니까?',
              [
                { text: '취소', style: 'cancel' },
                {
                  text: '삭제',
                  style: 'destructive',
                  onPress: () => {
                    // 데이터 삭제 로직
                    Alert.alert('완료', '데이터가 삭제되었습니다.');
                  }
                }
              ]
            );
          }
        }
      ]
    },
    {
      title: '지원',
      items: [
        {
          type: 'navigation',
          title: '고객센터',
          subtitle: '문의하기',
          icon: '💬',
          onPress: () => {
            Alert.alert('고객센터', '이메일: support@ganengile.com');
          }
        },
        {
          type: 'navigation',
          title: '약관 및 정책',
          subtitle: '서비스 이용약관',
          icon: '📄',
          onPress: () => {
            Alert.alert('서비스 이용약관', '최종 업데이트: 2026-02-13\n\n(내용 생략)');
          }
        },
        {
          type: 'navigation',
          title: '버전 정보',
          subtitle: 'v1.0.0 (Build 1)',
          icon: 'ℹ️',
          onPress: () => {
            Alert.alert('버전 정보', 'v1.0.0 (Build 1)\n2026-02-13 릴리스');
          }
        }
      ]
    },
    {
      title: '계정',
      items: [
        {
          type: 'action',
          title: '로그아웃',
          subtitle: '계정에서 로그아웃',
          icon: '🚪',
          onPress: handleLogout
        }
      ]
    }
  ];

  const renderItem = (item: SettingsItem) => {
    if (item.type === 'toggle') {
      return (
        <View style={[styles.item, { borderBottomColor: colors.border }]}>
          <View style={styles.itemLeft}>
            <Text style={styles.icon}>{item.icon}</Text>
            <View style={styles.itemText}>
              <Text style={[styles.title, { color: colors.text }]}>
                {item.title}
              </Text>
              {item.subtitle && (
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {item.subtitle}
                </Text>
              )}
            </View>
          </View>
          <Switch
            value={item.value}
            onValueChange={item.onValueChange}
            trackColor={{ false: '#767577', true: '#00BCD4' }}
            thumbColor="#f4f3f4"
          />
        </View>
      );
    } else if (item.type === 'navigation' || item.type === 'action') {
      const isDestructive = item.type === 'action';

      return (
        <TouchableOpacity
          style={[styles.item, { borderBottomColor: colors.border }]}
          onPress={item.onPress}
        >
          <View style={styles.itemLeft}>
            <Text style={styles.icon}>{item.icon}</Text>
            <View style={styles.itemText}>
              <Text
                style={[
                  styles.title,
                  { color: isDestructive ? colors.error : colors.text }
                ]}
              >
                {item.title}
              </Text>
              {item.subtitle && (
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {item.subtitle}
                </Text>
              )}
            </View>
          </View>
          <Text style={[styles.chevron, { color: colors.textSecondary }]}>
            ›
          </Text>
        </TouchableOpacity>
      );
    }

    return null;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* 헤더 */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          설정
        </Text>
      </View>

      {/* 설정 목록 */}
      <ScrollView style={styles.scrollView}>
        {settingsSections.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              {section.title}
            </Text>
            <View style={[styles.sectionContainer, { backgroundColor: colors.surface }]}>
              {section.items.map((item, itemIndex) => (
                <View key={itemIndex}>{renderItem(item)}</View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold'
  },
  scrollView: {
    flex: 1
  },
  section: {
    marginTop: 24
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 16
  },
  sectionContainer: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E0E0E0'
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  icon: {
    fontSize: 20,
    marginRight: 12
  },
  itemText: {
    flex: 1
  },
  title: {
    fontSize: 16,
    fontWeight: '500'
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2
  },
  chevron: {
    fontSize: 20,
    fontWeight: '300'
  }
});
