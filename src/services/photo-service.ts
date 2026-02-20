/**
 * Photo Service
 * 사진 인증 서비스
 */

import {
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  uploadBytes,
  getDownloadURL,
  ref,
} from 'firebase/firestore';
import { db } from './firebase';
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL as getStorageDownloadURL } from 'firebase/storage';
import type {
  Photo,
  PhotoType,
  PhotoStatus,
  Dispute,
  PhotoVerification,
} from '../types/photo';

const PHOTOS_COLLECTION = 'photos';
const DISPUTES_COLLECTION = 'disputes';
const STORAGE_PATH = 'locker_photos';

export class PhotoService {
  private storage = getStorage();

  /**
   * 사진 업로드
   */
  async uploadPhoto(
    userId: string,
    requestId: string,
    type: PhotoType,
    fileUri: string,
    metadata?: any
  ): Promise<Photo> {
    // 파일명 생성
    const fileName = `${userId}_${requestId}_${type}_${Date.now()}.jpg`;
    const storageRefPath = storageRef(this.storage, `${STORAGE_PATH}/${fileName}`);

    // TODO: 실제 파일 업로드 로직 (현재는 mock)
    // React Native에서는 expo-document-picker 등 사용 필요
    const downloadURL = `https://storage.example.com/${fileName}`;

    // 사진 메타데이터 저장
    const photoData = {
      type,
      userId,
      requestId,
      url: downloadURL,
      thumbnailUrl: `${downloadURL}_thumb`, // TODO: 썸네일 생성
      takenAt: new Date(),
      uploadedAt: serverTimestamp(),
      status: 'pending',
      metadata: {
        ...metadata,
        fileName,
      },
    };

    const docRef = await addDoc(collection(db, PHOTOS_COLLECTION), photoData);

    return {
      photoId: docRef.id,
      ...photoData,
    } as Photo;
  }

  /**
   * 사진 URL로 업로드 (base64 데이터)
   */
  async uploadPhotoFromBase64(
    userId: string,
    requestId: string,
    type: PhotoType,
    base64Data: string,
    metadata?: any
  ): Promise<Photo> {
    // Base64 데이터를 Blob으로 변환
    const blob = this.base64ToBlob(base64Data);
    const fileName = `${userId}_${requestId}_${type}_${Date.now()}.jpg`;

    // Firebase Storage에 업로드
    const storageRefPath = storageRef(this.storage, `${STORAGE_PATH}/${fileName}`);
    await uploadBytesResumable(storageRefPath, blob);

    const downloadURL = await getStorageDownloadURL(storageRefPath);

    // 사진 메타데이터 저장
    const photoData = {
      type,
      userId,
      requestId,
      url: downloadURL,
      thumbnailUrl: downloadURL, // TODO: 썸네일 생성
      takenAt: new Date(),
      uploadedAt: serverTimestamp(),
      status: 'pending',
      metadata: {
        ...metadata,
        fileName,
        fileSize: blob.size,
        mimeType: 'image/jpeg',
      },
    };

    const docRef = await addDoc(collection(db, PHOTOS_COLLECTION), photoData);

    return {
      photoId: docRef.id,
      ...photoData,
    } as Photo;
  }

  /**
   * 사진 검증
   */
  async verifyPhoto(photoId: string): Promise<PhotoVerification> {
    const docRef = doc(db, PHOTOS_COLLECTION, photoId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists) {
      throw new Error('Photo not found');
    }

    const photo = {
      photoId: docSnap.id,
      ...docSnap.data(),
    } as Photo;

    // TODO: AI 기반 검증 로직 (현재는 mock)
    // 실제로는 TensorFlow.js 또는 외부 API 사용
    const verification: PhotoVerification = {
      photoId,
      isValid: true,
      confidence: 0.95, // 95% confidence
      issues: [],
      verifiedAt: new Date(),
    };

    // 사진 상태 업데이트
    await updateDoc(docRef, {
      status: 'verified',
      verifiedBy: 'system',
      verifiedAt: serverTimestamp(),
    });

    return verification;
  }

  /**
   * 인수 사진 촬영
   */
  async capturePickupPhoto(
    userId: string,
    requestId: string,
    deliveryId: string,
    base64Data: string
  ): Promise<Photo> {
    return this.uploadPhotoFromBase64(
      userId,
      requestId,
      PhotoType.PICKUP,
      base64Data,
      {
        deliveryId,
        deviceInfo: 'Mock Device',
        appVersion: '1.0.0',
      }
    );
  }

  /**
   * 인계 사진 촬영
   */
  async captureDropoffPhoto(
    userId: string,
    requestId: string,
    deliveryId: string,
    base64Data: string
  ): Promise<Photo> {
    return this.uploadPhotoFromBase64(
      userId,
      requestId,
      PhotoType.DROPOFF,
      base64Data,
      {
        deliveryId,
        deviceInfo: 'Mock Device',
        appVersion: '1.0.0',
      }
    );
  }

  /**
   * 분쟁 신고
   */
  async reportDispute(
    reporterId: string,
    reporterType: 'requester' | 'giller',
    requestId: string,
    type: 'damage' | 'loss' | 'quality',
    description: string,
    photoUrls: string[]
  ): Promise<Dispute> {
    const disputeData = {
      reporterId,
      reporterType,
      requestId,
      type,
      description,
      photoUrls,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, DISPUTES_COLLECTION), disputeData);

    return {
      disputeId: docRef.id,
      ...disputeData,
    } as Dispute;
  }

  /**
   * 분쟁 해결
   */
  async resolveDispute(
    disputeId: string,
    resolution: {
      responsibility: 'requester' | 'giller' | 'system';
      compensation: number;
      note?: string;
    }
  ): Promise<void> {
    const docRef = doc(db, DISPUTES_COLLECTION, disputeId);
    await updateDoc(docRef, {
      status: 'resolved',
      resolution,
      resolvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * 요청에 대한 모든 사진 조회
   */
  async getPhotosByRequestId(requestId: string): Promise<Photo[]> {
    const q = query(
      collection(db, PHOTOS_COLLECTION),
      where('requestId', '==', requestId)
    );

    const snapshot = await getDocs(q);
    const photos: Photo[] = [];

    snapshot.forEach((doc) => {
      photos.push({
        photoId: doc.id,
        ...doc.data(),
      } as Photo);
    });

    return photos;
  }

  /**
   * Base64를 Blob으로 변환
   */
  private base64ToBlob(base64: string): Blob {
    const bytes = atob(base64.split(',')[1] || base64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      arr[i] = bytes.charCodeAt(i);
    }
    return new Blob([arr], { type: 'image/jpeg' });
  }
}

export function createPhotoService(): PhotoService {
  return new PhotoService();
}
