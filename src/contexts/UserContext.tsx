/**
 * User Context
 * 사용자 역할 및 정보를 전역적으로 관리하는 Context
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { getUserById, createUser } from '../services/user-service';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { User } from '../types/user';
import { UserRole } from '../types/user';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

export function UserProvider({ children }: UserProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          let userData = await getUserById(firebaseUser.uid);

          if (!userData) {
            console.log('📝 User not found in Firestore, creating...');

            userData = await createUser(
              firebaseUser.uid,
              firebaseUser.email || 'unknown@example.com',
              firebaseUser.displayName || '사용자',
              UserRole.GLER
            );

            console.log('✅ User created:', firebaseUser.uid);
          }

          setUser(userData);

          if (userData?.role === UserRole.BOTH) {
            setCurrentRole(UserRole.GLER);
          } else {
            setCurrentRole(userData?.role || null);
          }
        } catch (error) {
          console.error('Error loading user:', error);
        }
      } else {
        setUser(null);
        setCurrentRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const refreshUser = async () => {
    const firebaseUser = auth.currentUser;
    if (firebaseUser) {
      try {
        const userData = await getUserById(firebaseUser.uid);
        setUser(userData);
      } catch (error) {
        console.error('Error refreshing user:', error);
      }
    }
  };

  const completeOnboarding = async () => {
    const firebaseUser = auth.currentUser;
    if (firebaseUser) {
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        hasCompletedOnboarding: true,
        updatedAt: serverTimestamp(),
      });

      // Update local state
      if (user) {
        setUser({ ...user, hasCompletedOnboarding: true });
      }
    }
  };

  const switchRole = (role: UserRole) => {
    if (user?.role === 'both') {
      setCurrentRole(role);
    }
  };

  const logout = async () => {
    console.log('🚪 Starting logout process...');
    try {
      // Firebase Auth 로그아웃
      console.log('1️⃣ Signing out from Firebase Auth...');
      await signOut(auth);
      console.log('✅ Firebase Auth signOut successful');

      // UserContext 상태 초기화
      console.log('2️⃣ Clearing UserContext state...');
      setUser(null);
      setCurrentRole(null);
      setLoading(false);
      console.log('✅ UserContext state cleared');

      // Web 환경에서는 localStorage, Native에서는 AsyncStorage 정리
      console.log('3️⃣ Clearing local storage...');
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          // Web 환경: localStorage 사용
          localStorage.removeItem('@user_email');
          localStorage.removeItem('@user_data');
          localStorage.removeItem('@auth_state');
          console.log('✅ localStorage cleared (Web)');
        } else {
          // Native 환경: AsyncStorage 사용
          await AsyncStorage.removeItem('@user_email');
          await AsyncStorage.multiRemove(['@user_email', '@user_data', '@auth_state']);
          console.log('✅ AsyncStorage cleared (Native)');
        }
      } catch (storageError) {
        console.warn('⚠️ Storage cleanup warning:', storageError);
      }

      console.log('🎉 Logout completed successfully!');
    } catch (error) {
      console.error('❌ Logout error:', error);
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
