/**
 * User Context
 * 사용자 역할 및 정보를 전역적으로 관리하는 Context
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';
import { getUserById, createUser } from '../services/user-service';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { User } from '../types/user';
import { UserRole } from '../types/user';

interface UserContextType {
  user: User | null;
  loading: boolean;
  currentRole: UserRole | null;
  switchRole: (role: UserRole) => void;
  refreshUser: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
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
              UserRole.BOTH
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
      const userData = await getUserById(firebaseUser.uid);
      setUser(userData);
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

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        currentRole,
        switchRole,
        refreshUser,
        completeOnboarding,
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
