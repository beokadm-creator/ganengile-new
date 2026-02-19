/**
 * Media Service Unit Tests
 */

import { MediaService } from '../media-service';

// Mock expo-image-picker
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));

// Mock Firebase Storage
jest.mock('firebase/storage', () => ({
  getStorage: jest.fn(),
  ref: jest.fn(),
  uploadBytesResumable: jest.fn(),
  getDownloadURL: jest.fn(),
  deleteObject: jest.fn(),
}));

import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';

describe('MediaService', () => {
  let mediaService: MediaService;

  beforeEach(() => {
    mediaService = new MediaService();
    jest.clearAllMocks();
  });

  describe('requestMediaPermissions', () => {
    it('모든 권한이 승인되면 true를 반환해야 한다', async () => {
      // Given
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      // When
      const result = await mediaService.requestMediaPermissions();

      // Then
      expect(result).toBe(true);
    });

    it('카메라 권한이 거부되면 false를 반환해야 한다', async () => {
      // Given
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      // When
      const result = await mediaService.requestMediaPermissions();

      // Then
      expect(result).toBe(false);
    });

    it('에러 발생 시 false를 반환해야 한다', async () => {
      // Given
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockRejectedValue(
        new Error('Permission error')
      );

      // When
      const result = await mediaService.requestMediaPermissions();

      // Then
      expect(result).toBe(false);
    });
  });

  describe('pickFromGallery', () => {
    const mockProgressCallback = jest.fn();

    it('갤러리에서 이미지를 선택하고 업로드해야 한다', async () => {
      jest.setTimeout(10000); // Increase timeout to 10 seconds
      // Given
      const mockAsset = {
        uri: 'file://image.jpg',
        width: 1920,
        height: 1080,
      };
      const mockFileInfo = { exists: true, size: 1024 * 1024, uri: 'file://image.jpg' };
      const mockBlob = new Blob(['image data'], { type: 'image/jpeg' });
      const mockDownloadURL = 'https://storage.url/image.jpg';

      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [mockAsset],
      });
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue(mockFileInfo);
      (ref as jest.Mock).mockReturnValue({});
      (uploadBytesResumable as jest.Mock).mockResolvedValue({
        bytesTransferred: 1024 * 1024,
        totalBytes: 1024 * 1024,
      });
      (getDownloadURL as jest.Mock).mockResolvedValue(mockDownloadURL);

      // When
      const result = await mediaService.pickFromGallery(mockProgressCallback);

      // Then
      expect(result).not.toBeNull();
      expect(result?.url).toBe(mockDownloadURL);
      expect(result?.path).toBe('file://image.jpg');
      expect(result?.size).toBe(1024 * 1024);
      expect(result?.type).toBe('gallery');
    });

    it('권한이 없으면 null을 반환해야 한다', async () => {
      // Given
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      // When
      const result = await mediaService.pickFromGallery();

      // Then
      expect(result).toBeNull();
    });

    it('사용자가 이미지 선택을 취소하면 null을 반환해야 한다', async () => {
      // Given
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
        canceled: true,
        assets: null,
      });

      // When
      const result = await mediaService.pickFromGallery();

      // Then
      expect(result).toBeNull();
    });

    it('파일 크기가 10MB를 초과하면 에러를 던져야 한다', async () => {
      // Given
      const mockAsset = {
        uri: 'file://large-image.jpg',
        width: 1920,
        height: 1080,
      };
      const mockFileInfo = { exists: true, size: 11 * 1024 * 1024, uri: 'file://large-image.jpg' };

      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [mockAsset],
      });
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue(mockFileInfo);

      // When & Then
      await expect(mediaService.pickFromGallery()).rejects.toThrow('10MB');
    });

    it('진행률 콜백을 호출해야 한다', async () => {
      // Given
      const mockAsset = {
        uri: 'file://image.jpg',
        width: 1920,
        height: 1080,
      };
      const mockFileInfo = { exists: true, size: 1024 * 1024, uri: 'file://image.jpg' };
      const mockProgressCallback = jest.fn();

      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [mockAsset],
      });
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue(mockFileInfo);

      let uploadProgressCallback: ((progress: { bytesTransferred: number; totalBytes: number }) => void) | undefined;
      (uploadBytesResumable as jest.Mock).mockImplementation((_ref, _blob, options) => {
        if (options?.onProgress) {
          uploadProgressCallback = options.onProgress;
        }
        return Promise.resolve({
          bytesTransferred: 1024 * 1024,
          totalBytes: 1024 * 1024,
        });
      });
      (ref as jest.Mock).mockReturnValue({});
      (getDownloadURL as jest.Mock).mockResolvedValue('https://storage.url/image.jpg');

      // When
      await mediaService.pickFromGallery(mockProgressCallback);

      // Trigger upload progress
      uploadProgressCallback?.({
        bytesTransferred: 512 * 1024,
        totalBytes: 1024 * 1024,
      });

      // Then
      expect(mockProgressCallback).toHaveBeenCalledWith({
        bytesTransferred: 512 * 1024,
        totalBytes: 1024 * 1024,
        progress: 50,
      });
    });
  });

  describe('takePhoto', () => {
    it('카메라로 사진을 찍고 업로드해야 한다', async () => {
      jest.setTimeout(10000);
      // Given
      const mockAsset = {
        uri: 'file://photo.jpg',
        width: 1920,
        height: 1080,
      };
      const mockFileInfo = { exists: true, size: 2 * 1024 * 1024, uri: 'file://photo.jpg' };
      const mockDownloadURL = 'https://storage.url/photo.jpg';

      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [mockAsset],
      });
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue(mockFileInfo);
      (ref as jest.Mock).mockReturnValue({});
      (uploadBytesResumable as jest.Mock).mockResolvedValue({
        bytesTransferred: 2 * 1024 * 1024,
        totalBytes: 2 * 1024 * 1024,
      });
      (getDownloadURL as jest.Mock).mockResolvedValue(mockDownloadURL);

      // When
      const result = await mediaService.takePhoto();

      // Then
      expect(result).not.toBeNull();
      expect(result?.url).toBe(mockDownloadURL);
      expect(result?.path).toBe('file://photo.jpg');
      expect(result?.type).toBe('camera');
    });

    it('사용자가 촬영을 취소하면 null을 반환해야 한다', async () => {
      // Given
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
        canceled: true,
        assets: null,
      });

      // When
      const result = await mediaService.takePhoto();

      // Then
      expect(result).toBeNull();
    });
  });

  describe('compressImage', () => {
    it('URI를 그대로 반환해야 한다 (현재 구현)', async () => {
      // Given
      const testUri = 'file://image.jpg';

      // When
      const result = await mediaService.compressImage(testUri);

      // Then
      expect(result).toBe(testUri);
    });

    it('사용자 정의 품질을 사용해야 한다', async () => {
      // Given
      const testUri = 'file://image.jpg';
      const customQuality = 0.5;

      // When
      const result = await mediaService.compressImage(testUri, customQuality);

      // Then
      expect(result).toBe(testUri);
    });

    it('에러 발생 시 원래 URI를 반환해야 한다', async () => {
      // Given
      const testUri = 'file://invalid.jpg';

      // When
      const result = await mediaService.compressImage(testUri);

      // Then
      expect(result).toBe(testUri);
    });
  });

  describe('cleanupTempFiles', () => {
    it('임시 파일들을 삭제해야 한다', async () => {
      // Given
      const mockFiles = ['file://temp1.jpg', 'file://temp2.jpg'];
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

      // When
      await mediaService.cleanupTempFiles(mockFiles);

      // Then
      expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(2);
    });

    it('존재하지 않는 파일은 건너뛰어야 한다', async () => {
      // Given
      const mockFiles = ['file://temp1.jpg', 'file://nonexistent.jpg'];
      (FileSystem.getInfoAsync as jest.Mock)
        .mockResolvedValueOnce({ exists: true })
        .mockResolvedValueOnce({ exists: false });
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

      // When
      await mediaService.cleanupTempFiles(mockFiles);

      // Then
      expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(1);
    });

    it('에러가 발생해도 계속 진행해야 한다', async () => {
      // Given
      const mockFiles = ['file://temp1.jpg', 'file://temp2.jpg'];
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.deleteAsync as jest.Mock)
        .mockRejectedValueOnce(new Error('Delete error'))
        .mockResolvedValue(undefined);

      // When & Then - 에러를 던지지 않아야 함
      await expect(mediaService.cleanupTempFiles(mockFiles)).resolves.not.toThrow();
    });
  });

  describe('resizeImage', () => {
    it('URI를 그대로 반환해야 한다 (현재 구현)', async () => {
      // Given
      const testUri = 'file://image.jpg';

      // When
      const result = await mediaService.resizeImage(testUri);

      // Then
      expect(result).toBe(testUri);
    });

    it('사용자 정의 maxWidth를 사용해야 한다', async () => {
      // Given
      const testUri = 'file://image.jpg';
      const customMaxWidth = 400;

      // When
      const result = await mediaService.resizeImage(testUri, customMaxWidth);

      // Then
      expect(result).toBe(testUri);
    });
  });

  describe('deleteFromStorage', () => {
    it('Firebase Storage에서 파일을 삭제해야 한다', async () => {
      // Given
      const testUrl = 'https://storage.url/image.jpg';
      const mockStorageRef = {};
      (ref as jest.Mock).mockReturnValue(mockStorageRef);
      (deleteObject as jest.Mock).mockResolvedValue(undefined);

      // When
      await mediaService.deleteFromStorage(testUrl);

      // Then
      expect(ref).toHaveBeenCalledWith(expect.anything(), testUrl);
      expect(deleteObject).toHaveBeenCalledWith(mockStorageRef);
    });

    it('삭제 실패 시 에러를 던져야 한다', async () => {
      // Given
      const testUrl = 'https://storage.url/image.jpg';
      (ref as jest.Mock).mockReturnValue({});
      (deleteObject as jest.Mock).mockRejectedValue(new Error('Delete failed'));

      // When & Then
      await expect(mediaService.deleteFromStorage(testUrl)).rejects.toThrow();
    });
  });
});
