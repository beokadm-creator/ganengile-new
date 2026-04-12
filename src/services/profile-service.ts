/**
 * Profile Service
 * 프로필 관리 서비스 - Firestore CRUD
 */

import {
  addDoc,
  collection,
  deleteField,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { UserProfile, ProfileFormData, SavedAddress } from '../types/profile';
import { calculateGrade } from './grade-service';

const PROFILE_COLLECTION = 'profile';
const SAVED_ADDRESSES_COLLECTION = 'saved_addresses';
const RECENT_ADDRESSES_COLLECTION = 'recent_addresses';

/**
 * 프로필 조회
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    if (!userId) {
      console.error('getUserProfile: userId is required');
      return null;
    }

    // Fetching profile for userId

    const profileRef = doc(db, 'users', userId, PROFILE_COLLECTION, userId);
    const docSnapshot = await getDoc(profileRef);

    if (!docSnapshot.exists()) {
      console.warn('getUserProfile: No profile found for userId:', userId);
      return null;
    }

    const data = docSnapshot.data();
    if (!data) {
      console.warn('getUserProfile: Profile data is empty for userId:', userId);
      return null;
    }

    // Profile found for userId

    return {
      userId: data.userId ?? userId,
      name: data.name ?? '',
      phoneNumber: data.phoneNumber ?? '',
      profilePhotoUrl: data.profilePhotoUrl,
      defaultAddress: data.defaultAddress,
      bankAccount: data.bankAccount,
      gillerInfo: data.gillerInfo,
      isVerified: data.isVerified ?? false,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  } catch (error) {
    console.error('❌ Error fetching user profile:', error);
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
      defaultAddress: data.defaultAddress,
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
    const userRef = doc(db, 'users', userId);

    const updateData: any = {
      ...data,
      updatedAt: serverTimestamp(),
    };

    await runTransaction(db, async (transaction) => {
      transaction.update(profileRef, updateData);
      
      // name, phoneNumber 등 users 메인 문서와 동기화가 필요한 필드가 있다면 함께 업데이트
      const userUpdate: any = { updatedAt: serverTimestamp() };
      if (data.name) userUpdate.nickname = data.name;
      if (data.profilePhotoUrl) userUpdate.profileImage = data.profilePhotoUrl;
      
      if (Object.keys(userUpdate).length > 1) {
        transaction.update(userRef, userUpdate);
      }
    });

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
    const userRef = doc(db, 'users', userId);

    await runTransaction(db, async (transaction) => {
      transaction.update(profileRef, {
        isVerified,
        updatedAt: serverTimestamp(),
      });
      transaction.update(userRef, {
        isVerified,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    console.error('Error updating verification status:', error);
    throw error;
  }
}

function profileDocRef(userId: string) {
  return doc(db, 'users', userId, PROFILE_COLLECTION, userId);
}

function savedAddressCollection(userId: string) {
  return collection(profileDocRef(userId), SAVED_ADDRESSES_COLLECTION);
}

function recentAddressCollection(userId: string) {
  return collection(profileDocRef(userId), RECENT_ADDRESSES_COLLECTION);
}

function mapSavedAddress(addressId: string, data: Record<string, any>): SavedAddress {
  return {
    addressId,
    label: data.label ?? '저장된 주소',
    roadAddress: data.roadAddress ?? '',
    detailAddress: data.detailAddress ?? '',
    fullAddress: data.fullAddress ?? '',
    isDefault: Boolean(data.isDefault ?? false),
    isFavorite: Boolean(data.isFavorite ?? false),
    lastUsedAt: data.lastUsedAt,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function getSavedAddresses(userId: string): Promise<SavedAddress[]> {
  const snapshot = await getDocs(query(savedAddressCollection(userId), orderBy('updatedAt', 'desc'), limit(20)));
  return snapshot.docs.map((item) => mapSavedAddress(item.id, item.data() as Record<string, any>));
}

export async function getRecentAddresses(userId: string): Promise<SavedAddress[]> {
  const snapshot = await getDocs(query(recentAddressCollection(userId), orderBy('lastUsedAt', 'desc'), limit(10)));
  return snapshot.docs.map((item) => mapSavedAddress(item.id, item.data() as Record<string, any>));
}

export async function saveAddress(
  userId: string,
  input: {
    addressId?: string;
    label: string;
    roadAddress: string;
    detailAddress: string;
    isDefault?: boolean;
    isFavorite?: boolean;
  }
): Promise<string> {
  const fullAddress = `${input.roadAddress.trim()} ${input.detailAddress.trim()}`.trim();
  const payload = {
    label: input.label.trim() ?? '저장된 주소',
    roadAddress: input.roadAddress.trim(),
    detailAddress: input.detailAddress.trim(),
    fullAddress,
    isDefault: Boolean(input.isDefault),
    isFavorite: Boolean(input.isFavorite),
    lastUsedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (input.isDefault) {
    const existing = await getSavedAddresses(userId);
    
    await runTransaction(db, async (transaction) => {
      // 다른 주소들의 기본 설정을 해제
      existing
        .filter((address) => address.addressId !== input.addressId && address.isDefault)
        .forEach((address) => {
          transaction.update(doc(savedAddressCollection(userId), address.addressId), { 
            isDefault: false, 
            updatedAt: serverTimestamp() 
          });
        });

      // 현재 입력된 주소 문서를 업데이트 또는 생성 (미리 Ref를 잡아둠)
      const currentAddressRef = input.addressId 
        ? doc(savedAddressCollection(userId), input.addressId) 
        : doc(savedAddressCollection(userId));

      transaction.set(currentAddressRef, {
        ...payload,
        createdAt: input.addressId ? undefined : serverTimestamp(),
      }, { merge: true });

      // userProfile 문서에 기본 주소 반영
      const pRef = profileDocRef(userId);
      transaction.set(pRef, {
        defaultAddress: {
          roadAddress: input.roadAddress.trim(),
          detailAddress: input.detailAddress.trim(),
          fullAddress,
        },
        updatedAt: serverTimestamp()
      }, { merge: true });
    });

    return input.addressId || 'new-address-created';
  }

  if (input.addressId) {
    await updateDoc(doc(savedAddressCollection(userId), input.addressId), payload);
    return input.addressId;
  }

  const created = await addDoc(savedAddressCollection(userId), {
    ...payload,
    createdAt: serverTimestamp(),
  });
  return created.id;
}

export async function deleteSavedAddress(userId: string, addressId: string): Promise<void> {
  const addressRef = doc(savedAddressCollection(userId), addressId);
  const snapshot = await getDoc(addressRef);
  const data = snapshot.exists() ? (snapshot.data() as Record<string, any>) : null;
  await deleteDoc(doc(savedAddressCollection(userId), addressId));

  if (data?.isDefault) {
    await updateDoc(profileDocRef(userId), {
      defaultAddress: deleteField(),
      updatedAt: serverTimestamp(),
    });
  }
}

export async function setDefaultSavedAddress(userId: string, addressId: string): Promise<void> {
  const existing = await getSavedAddresses(userId);
  const target = existing.find((address) => address.addressId === addressId);
  if (!target) {
    throw new Error('기본 주소로 지정할 대상을 찾을 수 없습니다.');
  }

  await runTransaction(db, async (transaction) => {
    existing.forEach((address) => {
      transaction.update(doc(savedAddressCollection(userId), address.addressId), {
        isDefault: address.addressId === addressId,
        updatedAt: serverTimestamp(),
      });
    });

    transaction.set(profileDocRef(userId), {
      defaultAddress: {
        roadAddress: target.roadAddress,
        detailAddress: target.detailAddress,
        fullAddress: target.fullAddress,
      },
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });
}

export async function toggleFavoriteSavedAddress(
  userId: string,
  addressId: string,
  isFavorite: boolean
): Promise<void> {
  await updateDoc(doc(savedAddressCollection(userId), addressId), {
    isFavorite,
    updatedAt: serverTimestamp(),
  });
}

export async function addRecentAddress(
  userId: string,
  input: {
    label?: string;
    roadAddress: string;
    detailAddress: string;
  }
): Promise<void> {
  const fullAddress = `${input.roadAddress.trim()} ${input.detailAddress.trim()}`.trim();
  const dedupeId = `${input.roadAddress.trim()}__${input.detailAddress.trim()}`.replace(/[/.#[\]$]/g, '_');
  await setDoc(
    doc(recentAddressCollection(userId), dedupeId),
    {
      label: input.label?.trim() ?? '최근 사용 주소',
      roadAddress: input.roadAddress.trim(),
      detailAddress: input.detailAddress.trim(),
      fullAddress,
      isDefault: false,
      lastUsedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}
