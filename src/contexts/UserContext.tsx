import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { signOut } from 'firebase/auth';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';

import { useAuth } from './AuthContext';
import { auth, db } from '../services/firebase';
import { createUser, getUserById } from '../services/user-service';
import { AuthProviderType, UserRole, type User } from '../types/user';

interface UserContextType {
  user: User | null;
  loading: boolean;
  currentRole: UserRole | null;
  switchRole: (role: UserRole) => void;
  refreshUser: () => Promise<void>;
  completeOnboarding: () => Promise<string | null>;
  logout: () => Promise<void>;
  deactivateAccount: (reason?: string) => Promise<void>;
}

export type { UserContextType };

const UserContext = createContext<UserContextType | undefined>(undefined);

export { UserContext };

interface UserProviderProps {
  children: ReactNode;
}

const STORAGE_KEYS_TO_CLEAR = [
  '@user_email',
  '@user_data',
  '@auth_state',
  'user_current_role',
  'currentRole',
];

function canUseGillerRole(user: User | null): boolean {
  if (!user) {
    return false;
  }

  return (
    user.role === UserRole.GILLER ||
    user.role === UserRole.BOTH ||
    (user.gillerApplicationStatus === 'approved' && user.isVerified === true)
  );
}

function resolveActiveRole(user: User | null): UserRole | null {
  if (!user) {
    return null;
  }

  if (user.role === UserRole.GILLER) {
    return UserRole.GILLER;
  }

  if (canUseGillerRole(user)) {
    return UserRole.GLER;
  }

  return user.role ?? null;
}

function resolveAuthProviderFromFirebaseUser(firebaseUser: NonNullable<ReturnType<typeof useAuth>['user']>): AuthProviderType {
  const providerIds = firebaseUser.providerData
    .map((provider) => provider.providerId)
    .filter((providerId): providerId is string => typeof providerId === 'string' && providerId.length > 0);

  if (providerIds.includes('google.com')) {
    return AuthProviderType.GOOGLE;
  }

  if (providerIds.includes('password')) {
    return AuthProviderType.EMAIL;
  }

  return AuthProviderType.UNKNOWN;
}

async function clearStoredSession(): Promise<void> {
  if (typeof window !== 'undefined') {
    STORAGE_KEYS_TO_CLEAR.forEach((key) => {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    });
    return;
  }

  await AsyncStorage.multiRemove(STORAGE_KEYS_TO_CLEAR);
}

export function UserProvider({ children }: UserProviderProps) {
  const { user: firebaseUser, loading: authLoading } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    const syncUser = async () => {
      if (!firebaseUser) {
        setUser(null);
        setCurrentRole(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const MAX_READ_RETRIES = 2;
        const RETRY_DELAY_MS = 1000;

        let userData: User | null = null;
        let readAttempt = 0;

        while (readAttempt <= MAX_READ_RETRIES) {
          try {
            userData = await getUserById(firebaseUser.uid);
            if (userData) break;

            if (readAttempt < MAX_READ_RETRIES) {
              console.warn(`User profile not found (attempt ${readAttempt + 1}/${MAX_READ_RETRIES + 1}), retrying in ${RETRY_DELAY_MS}ms...`);
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
            }
          } catch (error) {
            const errorCode = typeof error === 'object' && error != null && 'code' in error
              ? (error as { code?: unknown }).code
              : null;
            const code = errorCode !== null && (typeof errorCode === 'string' || typeof errorCode === 'number')
              ? String(errorCode)
              : '';

            if (code === 'permission-denied' || code === 'firestore/permission-denied') {
              console.warn('User read blocked by Firestore rules, aborting sync.');
              break;
            }

            if (readAttempt < MAX_READ_RETRIES) {
              console.warn(`User read error (attempt ${readAttempt + 1}/${MAX_READ_RETRIES + 1}):`, error);
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
            } else {
              console.error('Error loading user after retries:', error);
            }
          }
          readAttempt++;
        }

        if (!userData) {
          const finalCheck = await getUserById(firebaseUser.uid);
          if (finalCheck) {
            userData = finalCheck;
          } else {
            console.warn('User profile missing after retries, creating bootstrap document:', firebaseUser.uid);
            const authProvider = resolveAuthProviderFromFirebaseUser(firebaseUser);
            userData = await createUser(
              firebaseUser.uid,
              firebaseUser.email ?? 'unknown@example.com',
              firebaseUser.displayName ?? '사용자',
              UserRole.GLER,
              authProvider
            );
          }
        }

        setUser(userData);
        setCurrentRole(resolveActiveRole(userData));
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        setLoading(false);
      }
    };

    void syncUser();
  }, [firebaseUser, authLoading]);

  const refreshUser = async () => {
    const activeUser = auth.currentUser;
    if (!activeUser) {
      return;
    }

    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    refreshInFlightRef.current = (async () => {
      try {
        const userData = await getUserById(activeUser.uid);
        setUser(userData);
        setCurrentRole(resolveActiveRole(userData));
      } catch (error) {
        const errorCode = typeof error === 'object' && error != null && 'code' in error
          ? (error as { code?: unknown }).code
          : null;
        const code = errorCode !== null && (typeof errorCode === 'string' || typeof errorCode === 'number')
          ? String(errorCode)
          : '';

        if (code === 'permission-denied' || code === 'firestore/permission-denied') {
          console.warn('User refresh skipped because Firestore access was denied.');
        } else {
          console.error('Error refreshing user:', error);
        }
      } finally {
        refreshInFlightRef.current = null;
      }
    })();

    return refreshInFlightRef.current;
  };

  const completeOnboarding = async (): Promise<string | null> => {
    const activeUser = auth.currentUser;
    if (!activeUser) {
      return null;
    }

    await updateDoc(doc(db, 'users', activeUser.uid), {
      hasCompletedOnboarding: true,
      updatedAt: serverTimestamp(),
    });

    const refreshedUser = await getUserById(activeUser.uid);
    setUser((currentUser) =>
      refreshedUser
        ? {
            ...refreshedUser,
            hasCompletedOnboarding: true,
          }
        : currentUser
          ? {
              ...currentUser,
              hasCompletedOnboarding: true,
            }
          : currentUser
    );
    setCurrentRole(resolveActiveRole(refreshedUser ?? user));

    // 온보딩 전에 사용자가 가려던 URL 반환
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { consumePendingDeepLink } = require('../navigation/navigationRef');
    return consumePendingDeepLink();
  };

  const switchRole = (role: UserRole) => {
    if (!user) {
      return;
    }

    if (role === UserRole.GILLER && canUseGillerRole(user)) {
      setCurrentRole(UserRole.GILLER);
      return;
    }

    if (role === UserRole.GLER) {
      setCurrentRole(UserRole.GLER);
      return;
    }

    if (user.role === UserRole.BOTH) {
      setCurrentRole(role);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      await clearStoredSession();

      refreshInFlightRef.current = null;
      setUser(null);
      setCurrentRole(null);
      setLoading(false);

      if (typeof window !== 'undefined') {
        window.location.replace('/');
      }
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  const deactivateAccount = async (reason?: string) => {
    const activeUser = auth.currentUser;
    if (!activeUser) {
      throw new Error('로그인이 필요합니다.');
    }

    await updateDoc(doc(db, 'users', activeUser.uid), {
      isActive: false,
      deactivatedAt: serverTimestamp(),
      deactivationReason: reason?.trim() || 'user_requested',
      updatedAt: serverTimestamp(),
    });

    try {
      await updateDoc(doc(db, 'users', activeUser.uid, 'profile', activeUser.uid), {
        updatedAt: serverTimestamp(),
        accountStatus: 'deactivated',
      });
    } catch (error) {
      console.warn('Profile deactivation update skipped:', error);
    }

    await logout();
  };

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        currentRole,
        switchRole,
        refreshUser,
        completeOnboarding,
        logout,
        deactivateAccount,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextType {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
