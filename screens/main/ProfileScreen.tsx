/**
 * Profile Screen
 * User profile and settings
 * Refactored with Design System components
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, onSnapshot } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import type { ProfileScreenProps } from '../../src/types/navigation';
import { auth, db } from '../../src/services/firebase';
import {
  Card,
  Button,
  RoleSwitcher,
} from '../../src/components';
import { Colors, Spacing, Typography, BorderRadius } from '../../src/theme';
import { useUser } from '../../src/contexts/UserContext';
import { UserRole } from '../../src/types/user';

export default function ProfileScreen({ navigation: _navigation }: ProfileScreenProps) {
  const [userName, setUserName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();
  const { user, currentRole, switchRole } = useUser();

  useEffect(() => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;

    const unsubscribe = onSnapshot(
      doc(db, 'users', firebaseUser.uid),
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const userData = docSnapshot.data();
          setUserName(userData.name ?? '');
          setUserEmail(userData.email ?? '');
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching user data:', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const handleLogout = () => {
    Alert.alert(
      '로그아웃',
      '정말 로그아웃 하시겠습니까?',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '로그아웃',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
            } catch (error: any) {
              console.error('Logout error:', error);
              Alert.alert('오류', '로그아웃에 실패했습니다.');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />
        <ActivityIndicator size="large" color={Colors.secondary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />
      <ScrollView>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + Spacing.xl }]}>
          <Text style={styles.title}>프로필</Text>
          <Text style={styles.subtitle}>내 정보를 관리하세요</Text>
        </View>

        <View style={styles.content}>
          {/* Profile Info Card */}
          <Card variant="elevated" style={styles.profileCard}>
            <View style={styles.profileInfo}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {userName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{userName}</Text>
                <Text style={styles.userEmail}>{userEmail}</Text>
              </View>
            </View>
          </Card>

          {/* Role Switcher - Only for BOTH users */}
          {user?.role === UserRole.BOTH && currentRole && (
            <RoleSwitcher
              currentRole={currentRole}
              onRoleChange={switchRole}
            />
          )}

          {/* Account Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>계정 정보</Text>

            <Card variant="outlined" style={styles.menuCard}>
              <Text style={styles.menuItemText}>이름: {userName}</Text>
            </Card>

            <Card variant="outlined" style={styles.menuCard}>
              <Text style={styles.menuItemText}>이메일: {userEmail}</Text>
            </Card>

            <Card
              variant="outlined"
              style={styles.menuCard}
              onPress={() => Alert.alert('안내', '비밀번호 변경 기능은 준비 중입니다.')}
            >
              <Text style={styles.menuItemText}>비밀번호 변경</Text>
              <Text style={styles.menuItemArrow}>›</Text>
            </Card>
          </View>

          {/* Service Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>서비스 정보</Text>

            <Card
              variant="outlined"
              style={styles.menuCard}
              onPress={() => Alert.alert('안내', '평점 관리 기능은 준비 중입니다.')}
            >
              <Text style={styles.menuItemText}>내 평점</Text>
              <Text style={styles.menuItemArrow}>›</Text>
            </Card>

            <Card
              variant="outlined"
              style={styles.menuCard}
              onPress={() => Alert.alert('안내', '수익 관리 기능은 준비 중입니다.')}
            >
              <Text style={styles.menuItemText}>수익 관리</Text>
              <Text style={styles.menuItemArrow}>›</Text>
            </Card>

            <Card
              variant="outlined"
              style={styles.menuCard}
              onPress={() => Alert.alert('안내', '배송 내역 기능은 준비 중입니다.')}
            >
              <Text style={styles.menuItemText}>배송 내역</Text>
              <Text style={styles.menuItemArrow}>›</Text>
            </Card>
          </View>

          {/* Other */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>기타</Text>

            <Card
              variant="outlined"
              style={styles.menuCard}
              onPress={() => Alert.alert('문의하기', '고객센터: support@ganengile.com')}
            >
              <Text style={styles.menuItemText}>문의하기</Text>
              <Text style={styles.menuItemArrow}>›</Text>
            </Card>

            <Card
              variant="outlined"
              style={styles.menuCard}
              onPress={() => Alert.alert('약관', '이용약관 및 개인정보처리방침 (준비 중)')}
            >
              <Text style={styles.menuItemText}>이용약관</Text>
              <Text style={styles.menuItemArrow}>›</Text>
            </Card>
          </View>

          <Button
            title="로그아웃"
            variant="ghost"
            onPress={handleLogout}
            fullWidth
            style={styles.logoutButton}
          />

          <Text style={styles.version}>가는길에 v1.0.0</Text>
        </View>

        <View style={{ height: insets.bottom }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.gray50,
    flex: 1,
  },
  header: {
    backgroundColor: Colors.secondary,
    padding: Spacing.xl,
  },
  title: {
    color: Colors.white,
    fontSize: Typography.fontSize["4xl"],
    fontWeight: Typography.fontWeight.bold as any,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    color: Colors.white,
    fontSize: Typography.fontSize.base,
    opacity: 0.9,
  },
  content: {
    padding: Spacing.lg,
  },
  profileCard: {
    marginBottom: Spacing.lg,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    color: Colors.white,
    fontSize: Typography.fontSize["4xl"],
    fontWeight: Typography.fontWeight.bold as any,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.semibold as any,
    marginBottom: Spacing.xs,
  },
  userEmail: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold as any,
    marginBottom: Spacing.md,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    padding: Spacing.md,
  },
  menuItemText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
    flex: 1,
  },
  menuItemArrow: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize["2xl"],
  },
  logoutButton: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  version: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
