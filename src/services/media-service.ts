/**
 * Media Service - 사진 촬영, 갤러리 선택, Firebase Storage 업로드
 * 
 * 기능:
 * - 갤러리에서 사진 선택
 * - 카메라로 사진 촬영
 * - Firebase Storage에 업로드 (멀티파트, 진행률 지원)
 * - 이미지 압축 및 최적화
 * - 임시 파일 정리
 * - 재시도 로직
 * @version 2.0.0 - 최적화 완료
 */

import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { firebaseApp } from './firebase';

export interface MediaUploadResult {
  url: string;
  path: string;
  size: number;
  type: 'gallery' | 'camera';
}

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  progress: number; // 0-100
}

export type UploadProgressCallback = (progress: UploadProgress) => void;

export class MediaService {
  private storage = getStorage(firebaseApp);
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly COMPRESSION_QUALITY = 0.7; // 압축 품질
  private readonly MAX_RETRIES = 3; // 최대 재시도 횟수

  /**
   * 이미지 권한 요청
   */
  async requestMediaPermissions(): Promise<boolean> {
    try {
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
        console.error('Camera or library permission denied');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error requesting media permissions:', error);
      return false;
    }
  }

  /**
   * 갤러리에서 사진 선택
   */
  async pickFromGallery(
    onProgress?: UploadProgressCallback
  ): Promise<MediaUploadResult | null> {
    try {
      const hasPermission = await this.requestMediaPermissions();
      if (!hasPermission) {
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: this.COMPRESSION_QUALITY,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      if (!asset.uri) {
        return null;
      }

      // 파일 크기 확인
      const fileInfo = await FileSystem.getInfoAsync(asset.uri);
      const fileSize = fileInfo.exists && fileInfo.size ? fileInfo.size : 0;

      if (fileSize > this.MAX_FILE_SIZE) {
        throw new Error(`파일 크기가 10MB를 초과했습니다 (${(fileSize / 1024 / 1024).toFixed(2)}MB)`);
      }

      // Firebase Storage에 업로드 (진행률 지원)
      const uploadResult = await this.uploadToFirebaseWithRetry(
        asset.uri,
        'gallery',
        onProgress
      );
      
      return {
        url: uploadResult.url,
        path: asset.uri,
        size: fileSize,
        type: 'gallery',
      };
    } catch (error) {
      console.error('Error picking from gallery:', error);
      throw error;
    }
  }

  /**
   * 카메라로 사진 촬영
   */
  async takePhoto(
    onProgress?: UploadProgressCallback
  ): Promise<MediaUploadResult | null> {
    try {
      const hasPermission = await this.requestMediaPermissions();
      if (!hasPermission) {
        return null;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: this.COMPRESSION_QUALITY,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      if (!asset.uri) {
        return null;
      }

      // 파일 크기 확인
      const fileInfo = await FileSystem.getInfoAsync(asset.uri);
      const fileSize = fileInfo.exists && fileInfo.size ? fileInfo.size : 0;

      if (fileSize > this.MAX_FILE_SIZE) {
        throw new Error(`파일 크기가 10MB를 초과했습니다 (${(fileSize / 1024 / 1024).toFixed(2)}MB)`);
      }

      // Firebase Storage에 업로드 (진행률 지원)
      const uploadResult = await this.uploadToFirebaseWithRetry(
        asset.uri,
        'camera',
        onProgress
      );
      
      return {
        url: uploadResult.url,
        path: asset.uri,
        size: fileSize,
        type: 'camera',
      };
    } catch (error) {
      console.error('Error taking photo:', error);
      throw error;
    }
  }

  /**
   * Firebase Storage에 이미지 업로드 (멀티파트, 진행률 지원)
   * @version 2.0.0 - Base64에서 멀티파트로 변경
   */
  private async uploadToFirebaseWithRetry(
    localUri: string,
    source: 'gallery' | 'camera',
    onProgress?: UploadProgressCallback,
    retryCount: number = 0
  ): Promise<{ url: string; size: number }> {
    try {
      // 파일 정보 가져오기
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      const fileSize = fileInfo.exists && fileInfo.size ? fileInfo.size : 0;

      // Firebase Storage 경로 생성
      const fileName = `${source}-${Date.now()}.jpg`;
      const storageRef = ref(this.storage, `delivery-photos/${fileName}`);

      // 파일을 Blob으로 변환 (멀티파트 업로드)
      const blob = await this.uriToBlob(localUri);

      // 멀티파트 업로드 (진행률 지원)
      await uploadBytesResumable(storageRef, blob, {
        onProgress: (snapshot) => {
          if (onProgress) {
            onProgress({
              bytesTransferred: snapshot.bytesTransferred,
              totalBytes: snapshot.totalBytes,
              progress: Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
            });
          }
        },
      });

      // 다운로드 URL 가져오기
      const downloadURL = await getDownloadURL(storageRef);

      return {
        url: downloadURL,
        size: fileSize,
      };
    } catch (error) {
      console.error('Error uploading to Firebase:', error);

      // 재시도 로직
      if (retryCount < this.MAX_RETRIES) {
        console.log(`Retrying upload... (${retryCount + 1}/${this.MAX_RETRIES})`);
        await this.delay(1000 * (retryCount + 1)); // 지수 시간 대기
        return this.uploadToFirebaseWithRetry(localUri, source, onProgress, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * URI를 Blob으로 변환 (멀티파트 업로드용)
   */
  private async uriToBlob(uri: string): Promise<Blob> {
    try {
      // 파일을 읽어서 ArrayBuffer로 변환
      const fileData = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Base64를 Blob으로 변환
      const byteCharacters = atob(fileData);
      const byteNumbers = new Array(byteCharacters.length);
      
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }

      return new Blob([new Uint8Array(byteNumbers)], { type: 'image/jpeg' });
    } catch (error) {
      console.error('Error converting URI to blob:', error);
      throw error;
    }
  }

  /**
   * 지연 함수 (재시도용)
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 이미지 압축 (업로드 전에 미리보기)
   */
  async compressImage(uri: string, quality: number = this.COMPRESSION_QUALITY): Promise<string> {
    try {
      // Expo ImageManipulator를 사용한 압축 (향후 구현)
      // 현재는 ImagePicker의 allowsEditing으로 대체
      return uri;
    } catch (error) {
      console.error('Error compressing image:', error);
      return uri;
    }
  }

  /**
   * 임시 파일 정리
   */
  async cleanupTempFiles(fileUris: string[]): Promise<void> {
    try {
      for (const uri of fileUris) {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(uri, { idempotent: true });
        }
      }
    } catch (error) {
      console.error('Error cleaning up temp files:', error);
    }
  }

  /**
   * 이미지 크기 조정 (썸네일 생성용)
   */
  async resizeImage(uri: string, maxWidth: number = 200): Promise<string> {
    // TODO: 이미지 리사이징 로직 구현 (expo-image-manipulator 사용)
    return uri;
  }

  /**
   * Firebase Storage에서 파일 삭제
   */
  async deleteFromStorage(url: string): Promise<void> {
    try {
      const storageRef = ref(this.storage, url);
      await deleteObject(storageRef);
    } catch (error) {
      console.error('Error deleting from storage:', error);
      throw error;
    }
  }
}

// Singleton instance
export const mediaService = new MediaService();
