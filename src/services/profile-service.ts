/**
 * Profile Service
 * 프로필 관리 서비스 - Firestore CRUD
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { UserProfile, ProfileFormData } from '../types/profile';
import { calculateGrade } from './grade-service';

const PROFILE_COLLECTION = 'profile';

/**
 * 프로필 조회
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const profileRef = doc(db, 'users', userId, PROFILE_COLLECTION, userId);
    const docSnapshot = await getDoc(profileRef);

    if (!docSnapshot.exists()) {
      return null;
    }

    const data = docSnapshot.data();
    return {
      userId: data.userId || userId,
      name: data.name || '',
      phoneNumber: data.phoneNumber,
      profilePhotoUrl: data.profilePhotoUrl,
      bankAccount: data.bankAccount,
      gillerInfo: data.gillerInfo,
      isVerified: data.isVerified ?? false,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
}

/**
 * 프로필 생성 (최초 1회)
 */
export async function createUserProfile(
  userId: string,
  data: Omit<ProfileFormData, 'bankAccount'>
): Promise<UserProfile> {
  try {
    const profileRef = doc(db, 'users', userId, PROFILE_COLLECTION, userId);

    const profileData: Omit<UserProfile, 'createdAt' | 'updatedAt'> = {
      userId,
      name: data.name,
      phoneNumber: data.phoneNumber,
      profilePhotoUrl: data.profilePhotoUrl,
      isVerified: false,
      gillerInfo: {
        totalDeliveries: 0,
        grade: calculateGrade(0),
      },
    };

    const now = serverTimestamp();
    await setDoc(profileRef, {
      ...profileData,
      createdAt: now,
      updatedAt: now,
    });

    return {
      ...profileData,
      createdAt: now as Timestamp,
      updatedAt: now as Timestamp,
    };
  } catch (error) {
    console.error('Error creating user profile:', error);
    throw error;
  }
}

/**
 * 프로필 업데이트
 */
export async function updateUserProfile(
  userId: string,
  data: Partial<ProfileFormData>
): Promise<UserProfile> {
  try {
    const profileRef = doc(db, 'users', userId, PROFILE_COLLECTION, userId);

    const updateData: any = {
      ...data,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(profileRef, updateData);

    const updated = await getUserProfile(userId);
    if (!updated) {
      throw new Error('Failed to fetch updated profile');
    }

    return updated;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

/**
 * 프로필 사진 업로드
 */
export async function uploadProfilePhoto(
  userId: string,
  uri: string
): Promise<string> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();

    const storageRef = ref(storage, `profile-photos/${userId}/${Date.now()}.jpg`);
    await uploadBytes(storageRef, blob);

    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error('Error uploading profile photo:', error);
    throw error;
  }
}

/**
 * 배송 횟수 업데이트 (등급 자동 계산)
 */
export async function updateDeliveryCount(
  userId: string,
  totalDeliveries: number
): Promise<void> {
  try {
    const profileRef = doc(db, 'users', userId, PROFILE_COLLECTION, userId);
    const grade = calculateGrade(totalDeliveries);

    await updateDoc(profileRef, {
      'gillerInfo.totalDeliveries': totalDeliveries,
      'gillerInfo.grade': grade,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating delivery count:', error);
    throw error;
  }
}

/**
 * 인증 상태 업데이트
 */
export async function updateVerificationStatus(
  userId: string,
  isVerified: boolean
): Promise<void> {
  try {
    const profileRef = doc(db, 'users', userId, PROFILE_COLLECTION, userId);

    await updateDoc(profileRef, {
      isVerified,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating verification status:', error);
    throw error;
  }
}
