import { Platform } from 'react-native';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { uploadPhoto as uploadToStorage } from './storage-service';
import {
  Dispute,
  Photo,
  PhotoStatus,
  PhotoType,
  PhotoVerification,
} from '../types/photo';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

const PHOTOS_COLLECTION = 'photos';
const DISPUTES_COLLECTION = 'disputes';
const DISPUTE_HISTORY_COLLECTION = 'dispute_history';
const STORAGE_PATH = 'locker_photos';

type PhotoMetadata = Photo['metadata'] & {
  fileName?: string;
  deliveryId?: string;
};

function getDeviceInfo(): string {
  return `${Platform.OS}`;
}

export class PhotoService {
  async uploadPhoto(
    userId: string,
    requestId: string,
    type: PhotoType,
    fileUri: string,
    metadata?: PhotoMetadata
  ): Promise<Photo> {
    const fileName = `${userId}_${requestId}_${type}_${Date.now()}.jpg`;
    const downloadURL = await uploadToStorage(`${STORAGE_PATH}/${fileName}`, fileUri);

    const photoData = {
      type,
      userId,
      requestId,
      url: downloadURL,
      thumbnailUrl: downloadURL,
      takenAt: new Date(),
      uploadedAt: serverTimestamp(),
      status: PhotoStatus.PENDING,
      metadata: {
        ...metadata,
        fileName,
      },
    };

    const docRef = await addDoc(collection(db, PHOTOS_COLLECTION), photoData);

    return {
      photoId: docRef.id,
      ...photoData,
    } as unknown as Photo;
  }

  async uploadPhotoFromBase64(
    userId: string,
    requestId: string,
    type: PhotoType,
    base64Data: string,
    metadata?: PhotoMetadata
  ): Promise<Photo> {
    const fileName = `${userId}_${requestId}_${type}_${Date.now()}.jpg`;
    const blob = await this.base64ToBlobAsync(base64Data);
    const fileUri = URL.createObjectURL(blob);

    try {
      const downloadURL = await uploadToStorage(`${STORAGE_PATH}/${fileName}`, fileUri);

      const photoData = {
        type,
        userId,
        requestId,
        url: downloadURL,
        thumbnailUrl: downloadURL,
        takenAt: new Date(),
        uploadedAt: serverTimestamp(),
        status: PhotoStatus.PENDING,
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
      } as unknown as Photo;
    } finally {
      URL.revokeObjectURL(fileUri);
    }
  }

  async verifyPhoto(photoId: string): Promise<PhotoVerification> {
    const docRef = doc(db, PHOTOS_COLLECTION, photoId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Photo not found');
    }

    const photo = {
      photoId: docSnap.id,
      ...docSnap.data(),
    } as Photo;

    const isValid = Boolean(photo.url);
    const verification: PhotoVerification = {
      photoId,
      isValid,
      confidence: isValid ? 0.72 : 0.1,
      issues: isValid ? [] : ['업로드된 URL을 확인할 수 없습니다.'],
      verifiedAt: new Date(),
    };

    await updateDoc(docRef, {
      status: verification.isValid ? PhotoStatus.VERIFIED : PhotoStatus.REJECTED,
      verifiedBy: 'system',
      verifiedAt: serverTimestamp(),
    });

    return verification;
  }

  async capturePickupPhoto(
    userId: string,
    requestId: string,
    deliveryId: string,
    base64Data: string
  ): Promise<Photo> {
    return this.uploadPhotoFromBase64(userId, requestId, PhotoType.PICKUP, base64Data, {
      deliveryId,
      deviceInfo: getDeviceInfo(),
      appVersion: '1.0.0',
    });
  }

  async captureDropoffPhoto(
    userId: string,
    requestId: string,
    deliveryId: string,
    base64Data: string
  ): Promise<Photo> {
    return this.uploadPhotoFromBase64(userId, requestId, PhotoType.DROPOFF, base64Data, {
      deliveryId,
      deviceInfo: getDeviceInfo(),
      appVersion: '1.0.0',
    });
  }

  async reportDispute(
    reporterId: string,
    reporterType: 'requester' | 'giller',
    requestId: string,
    type: 'damage' | 'loss' | 'quality' | 'delay' | 'other',
    description: string,
    photoUrls: string[],
    options?: {
      deliveryId?: string;
      matchId?: string;
      urgency?: 'normal' | 'urgent' | 'critical';
      evidenceUrls?: string[];
    }
  ): Promise<Dispute> {
    const disputeData = {
      reporterId,
      reporterType,
      requestId,
      deliveryId: options?.deliveryId,
      matchId: options?.matchId,
      type,
      description,
      photoUrls,
      evidenceUrls: options?.evidenceUrls ?? [],
      urgency: options?.urgency ?? 'normal',
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, DISPUTES_COLLECTION), disputeData);
    await addDoc(collection(db, DISPUTE_HISTORY_COLLECTION), {
      disputeId: docRef.id,
      action: '분쟁 접수',
      note: description,
      actorName: reporterType === 'giller' ? '길러' : '요청자',
      createdAt: serverTimestamp(),
    });

    return {
      disputeId: docRef.id,
      ...disputeData,
    } as unknown as Dispute;
  }

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
    await addDoc(collection(db, DISPUTE_HISTORY_COLLECTION), {
      disputeId,
      action: '운영 판정 완료',
      note: resolution.note ?? '운영 검토 결과가 반영되었습니다.',
      actorName: '운영 시스템',
      createdAt: serverTimestamp(),
    });
  }

  async getPhotosByRequestId(requestId: string): Promise<Photo[]> {
    const q = query(
      collection(db, PHOTOS_COLLECTION),
      where('requestId', '==', requestId)
    );

    const snapshot = await getDocs(q);
    const photos: Photo[] = [];

    snapshot.forEach((photoDoc) => {
      photos.push({
        photoId: photoDoc.id,
        ...photoDoc.data(),
      } as Photo);
    });

    return photos;
  }

  private async base64ToBlobAsync(base64: string): Promise<Blob> {
    const dataUri = base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`;
    const response = await fetch(dataUri);
    return response.blob();
  }
}

export function createPhotoService(): PhotoService {
  return new PhotoService();
}

async function optimizeUploadImage(uri: string): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1280 } }],
      {
        compress: 0.6,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    return result.uri;
  } catch (error) {
    console.error('Failed to optimize upload image:', error);
    return uri;
  }
}

export async function takePhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.85,
  });

  if (result.canceled || result.assets.length === 0 || !result.assets[0]?.uri) {
    return null;
  }

  return result.assets[0].uri;
}

export async function pickPhotoFromLibrary(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.85,
    allowsEditing: true,
  });

  if (result.canceled || result.assets.length === 0 || !result.assets[0]?.uri) {
    return null;
  }

  return result.assets[0].uri;
}

export async function uploadPhotoWithThumbnail(
  uri: string,
  userId: string,
  type: string
): Promise<{ url: string }> {
  const path = `photos/${userId}/${type}_${Date.now()}.jpg`;
  const optimizedUri = await optimizeUploadImage(uri);
  const url = await uploadToStorage(path, optimizedUri);
  return { url };
}
