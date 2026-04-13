import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useUser } from '../../contexts/UserContext';
import { useGillerAccess } from '../../hooks/useGillerAccess';
import {
  getBeta1HomeSnapshot,
  type Beta1HomeSnapshot,
} from '../../services/beta1-orchestration-service';
import { Colors } from '../../theme';
import type { MainStackNavigationProp } from '../../types/navigation';
import { UserRole } from '../../types/user';
import { loadCreateRequestProgress } from '../../utils/draft-storage';

import { RequesterHome } from './home/RequesterHome';
import { GillerHome } from './home/GillerHome';

export default function HomeScreen({ navigation }: { navigation: MainStackNavigationProp }) {
  const { user, currentRole, switchRole } = useUser();
  const { canAccessGiller } = useGillerAccess();
  const [snapshot, setSnapshot] = useState<Beta1HomeSnapshot | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [hasRequestDraft, setHasRequestDraft] = useState(false);

  const role = currentRole === UserRole.GILLER ? 'giller' : 'requester';
  const isRequesterView = role === 'requester';
  const showRoleSwitch = user?.role === UserRole.BOTH || user?.role === UserRole.GLER;

  useEffect(() => {
    let mounted = true;

    void (async () => {
      if (!user?.uid) {
        return;
      }

      try {
        const nextSnapshot = await getBeta1HomeSnapshot(user.uid, role);
        if (mounted) {
          setSnapshot(nextSnapshot);
        }
      } catch (error) {
        console.error('Failed to load home snapshot', error);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [role, user]);

  useFocusEffect(
    React.useCallback(() => {
      let active = true;

      void (async () => {
        const draft = await loadCreateRequestProgress();
        if (active) {
          setHasRequestDraft(Boolean(draft));
        }
      })();

      return () => {
        active = false;
      };
    }, [])
  );

  const refresh = async () => {
    if (!user?.uid) {
      return;
    }

    setRefreshing(true);
    try {
      const nextSnapshot = await getBeta1HomeSnapshot(user.uid, role);
      setSnapshot(nextSnapshot);
    } catch (error) {
      console.error('Failed to refresh home snapshot', error);
    }
    setRefreshing(false);
  };

  if (!user) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>사용자 정보를 불러오지 못했습니다.</Text>
      </View>
    );
  }

  if (isRequesterView) {
    return (
      <RequesterHome
        snapshot={snapshot}
        navigation={navigation}
        refreshing={refreshing}
        onRefresh={() => void refresh()}
        showRoleSwitch={showRoleSwitch}
        onSwitchRole={switchRole}
        hasRequestDraft={hasRequestDraft}
        canAccessGiller={canAccessGiller}
      />
    );
  }

  return (
    <GillerHome
      snapshot={snapshot}
      navigation={navigation}
      refreshing={refreshing}
      onRefresh={() => void refresh()}
      showRoleSwitch={showRoleSwitch}
      onSwitchRole={switchRole}
      canAccessGiller={canAccessGiller}
    />
  );
}

const styles = StyleSheet.create({
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
});
