/**
 * Storage Service
 * Firebase Storage 업로드 및 관리
 */

import { ref, uploadBytesResumable, getDownloadURL, StorageError } from 'firebase/storage';
import { storage } from './firebase';

export interface UploadProgress {
  progress: number; // 0-100
  bytesTransferred: number;
  totalBytes: number;
}

export type UploadProgressCallback = (progress: UploadProgress) => void;

/**
 * 사진 업로드 (진행률 표시 포함)
 * @param path 업로드 경로 (예: 'pickup-photos/deliveryId/timestamp.jpg')
 * @param uri 로컬 이미지 URI
 * @param onProgress 진행률 콜백 (선택)
 * @returns 다운로드 URL
 */
export async function uploadPhoto(
  path: string,
  uri: string,
  onProgress?: UploadProgressCallback
): Promise<string> {
  try {
    const storageRef = ref(storage, path);

    // URI를 Blob으로 변환
    const response = await fetch(uri);
    const blob = await response.blob();

    // 파일 크기 확인 (10MB 제한)
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (blob.size > MAX_SIZE) {
      throw new Error('파일 크기가 10MB를 초과했습니다.');
    }

    // Resumable 업로드 (진행률 추적 가능)
    const uploadTask = uploadBytesResumable(storageRef, blob);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // 진행률 계산
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;

          if (onProgress) {
            onProgress({
              progress: Math.round(progress),
              bytesTransferred: snapshot.bytesTransferred,
              totalBytes: snapshot.totalBytes,
            });
          }
        },
        (error: StorageError) => {
          // 에러 처리
          console.error('Storage upload error:', error);

          let errorMessage = '업로드에 실패했습니다.';

          switch (error.code) {
            case 'storage/unauthorized':
              errorMessage = '파일 업로드 권한이 없습니다.';
              break;
            case 'storage/canceled':
              errorMessage = '업로드가 취소되었습니다.';
              break;
            case 'storage/unknown':
              errorMessage = '알 수 없는 오류가 발생했습니다.';
              break;
          }

          reject(new Error(errorMessage));
        },
        async () => {
          // 업로드 완료 후 다운로드 URL 가져오기
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadUrl);
          } catch (error) {
            reject(new Error('다운로드 URL을 가져올 수 없습니다.'));
          }
        }
      );
    });
  } catch (error: any) {
    console.error('Upload photo error:', error);

    if (error.message.includes('Network request failed')) {
      throw new Error('네트워크 연결을 확인해주세요.');
    }

    throw error;
  }
}

/**
 * 픽업 사진 업로드
 */
export async function uploadPickupPhoto(
  deliveryId: string,
  uri: string,
  onProgress?: UploadProgressCallback
): Promise<string> {
  const timestamp = Date.now();
  const path = `pickup-photos/${deliveryId}/${timestamp}.jpg`;
  return uploadPhoto(path, uri, onProgress);
}

/**
 * 배송 완료 사진 업로드
 */
export async function uploadDeliveryPhoto(
  deliveryId: string,
  uri: string,
  onProgress?: UploadProgressCallback
): Promise<string> {
  const timestamp = Date.now();
  const path = `delivery-photos/${deliveryId}/${timestamp}.jpg`;
  return uploadPhoto(path, uri, onProgress);
}

/**
 * 프로필 사진 업로드
 */
export async function uploadProfilePhoto(
  userId: string,
  uri: string,
  onProgress?: UploadProgressCallback
): Promise<string> {
  const timestamp = Date.now();
  const path = `profile-photos/${userId}/${timestamp}.jpg`;
  return uploadPhoto(path, uri, onProgress);
}

/**
 * 신분증 사진 업로드 (인증)
 */
export async function uploadIdPhoto(
  userId: string,
  uri: string,
  onProgress?: UploadProgressCallback
): Promise<string> {
  const timestamp = Date.now();
  const path = `id-photos/${userId}/${timestamp}.jpg`;
  return uploadPhoto(path, uri, onProgress);
}
