import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { signOut } from 'firebase/auth';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';

import { useAuth } from './AuthContext';
import { auth, db } from '../services/firebase';
import { createUser, getUserById } from '../services/user-service';
import { UserRole, type User } from '../types/user';

interface UserContextType {
  user: User | null;
  loading: boolean;
  currentRole: UserRole | null;
  switchRole: (role: UserRole) => void;
  refreshUser: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  logout: () => Promise<void>;
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
        let userData = await getUserById(firebaseUser.uid);

        if (!userData) {
          console.warn('User profile missing, creating bootstrap document:', firebaseUser.uid);
          userData = await createUser(
            firebaseUser.uid,
            firebaseUser.email ?? 'unknown@example.com',
            firebaseUser.displayName ?? '사용자',
            UserRole.GLER
          );
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
        console.error('Error refreshing user:', error);
      } finally {
        refreshInFlightRef.current = null;
      }
    })();

    return refreshInFlightRef.current;
  };

  const completeOnboarding = async () => {
    const activeUser = auth.currentUser;
    if (!activeUser) {
      return;
    }

    await updateDoc(doc(db, 'users', activeUser.uid), {
      hasCompletedOnboarding: true,
      updatedAt: serverTimestamp(),
    });

    setUser((currentUser) =>
      currentUser
        ? {
            ...currentUser,
            hasCompletedOnboarding: true,
          }
        : currentUser
    );
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
