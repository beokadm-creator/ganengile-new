/**
 * QR Code Service Unit Tests
 */

import { QRCodeService, QRCodeData } from '../qrcode-service';

// Mock expo-camera
jest.mock('expo-camera', () => ({
  CameraView: {},
}));

describe('QRCodeService', () => {
  describe('handleQRCodeScan', () => {
    it('유효한 QR 코드 데이터를 파싱해야 한다', () => {
      // Given
      const validQRData: QRCodeData = {
        type: 'pickup',
        id: 'req-123',
        timestamp: Date.now(),
        metadata: {
          gillerId: 'giller-456',
        },
      };
      const mockScanResult = {
        data: JSON.stringify(validQRData),
        type: 'org.iso.QRCode',
        cornerPoints: [],
        bounds: { origin: { x: 0, y: 0 }, size: { width: 100, height: 100 } },
      };

      // When
      const result = QRCodeService.handleQRCodeScan(mockScanResult);

      // Then
      expect(result).not.toBeNull();
      expect(result?.type).toBe('pickup');
      expect(result?.id).toBe('req-123');
    });

    it('만료된 QR 코드는 null을 반환해야 한다', () => {
      // Given - 25시간 전의 타임스탬프
      const expiredQRData: QRCodeData = {
        type: 'pickup',
        id: 'req-123',
        timestamp: Date.now() - 25 * 60 * 60 * 1000,
        metadata: {
          gillerId: 'giller-456',
        },
      };
      const mockScanResult = {
        data: JSON.stringify(expiredQRData),
        type: 'org.iso.QRCode',
        cornerPoints: [],
        bounds: { origin: { x: 0, y: 0 }, size: { width: 100, height: 100 } },
      };

      // When
      const result = QRCodeService.handleQRCodeScan(mockScanResult);

      // Then
      expect(result).toBeNull();
    });

    it('잘못된 형식의 QR 코드는 null을 반환해야 한다', () => {
      // Given
      const invalidQRData = {
        type: 'pickup',
        // id 필드 누락
        timestamp: Date.now(),
      };
      const mockScanResult = {
        data: JSON.stringify(invalidQRData),
        type: 'org.iso.QRCode',
        cornerPoints: [],
        bounds: { origin: { x: 0, y: 0 }, size: { width: 100, height: 100 } },
      };

      // When
      const result = QRCodeService.handleQRCodeScan(mockScanResult);

      // Then
      expect(result).toBeNull();
    });

    it('JSON 파싱 실패 시 null을 반환해야 한다', () => {
      // Given
      const mockScanResult = {
        data: 'invalid-json-data',
        type: 'org.iso.QRCode',
        cornerPoints: [],
        bounds: { origin: { x: 0, y: 0 }, size: { width: 100, height: 100 } },
      };

      // When
      const result = QRCodeService.handleQRCodeScan(mockScanResult);

      // Then
      expect(result).toBeNull();
    });
  });

  describe('generatePickupQRCode', () => {
    it('픽업 QR 코드를 생성해야 한다', () => {
      // Given
      const requestId = 'req-123';
      const gillerId = 'giller-456';

      // When
      const qrCodeString = QRCodeService.generatePickupQRCode(requestId, gillerId);

      // Then
      const parsed = JSON.parse(qrCodeString) as QRCodeData;
      expect(parsed.type).toBe('pickup');
      expect(parsed.id).toBe(requestId);
      expect(parsed.metadata?.gillerId).toBe(gillerId);
      expect(parsed.timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('생성된 QR 코드는 유효해야 한다', () => {
      // Given
      const requestId = 'req-123';
      const gillerId = 'giller-456';

      // When
      const qrCodeString = QRCodeService.generatePickupQRCode(requestId, gillerId);
      const parsed = JSON.parse(qrCodeString) as QRCodeData;

      // Then
      expect(QRCodeService.validateQRCodeData(parsed, 'pickup')).toBe(true);
    });
  });

  describe('generateDeliveryQRCode', () => {
    it('배송 완료 QR 코드를 생성해야 한다', () => {
      // Given
      const requestId = 'req-123';
      const gillerId = 'giller-456';

      // When
      const qrCodeString = QRCodeService.generateDeliveryQRCode(requestId, gillerId);

      // Then
      const parsed = JSON.parse(qrCodeString) as QRCodeData;
      expect(parsed.type).toBe('delivery');
      expect(parsed.id).toBe(requestId);
      expect(parsed.metadata?.gillerId).toBe(gillerId);
    });
  });

  describe('generateVerificationQRCode', () => {
    it('인증 QR 코드를 생성해야 한다', () => {
      // Given
      const userId = 'user-789';

      // When
      const qrCodeString = QRCodeService.generateVerificationQRCode(userId);

      // Then
      const parsed = JSON.parse(qrCodeString) as QRCodeData;
      expect(parsed.type).toBe('verification');
      expect(parsed.id).toBe(userId);
    });
  });

  describe('validateQRCodeData', () => {
    it('모든 필수 필드가 있으면 true를 반환해야 한다', () => {
      // Given
      const validData: QRCodeData = {
        type: 'pickup',
        id: 'req-123',
        timestamp: Date.now(),
      };

      // When
      const result = QRCodeService.validateQRCodeData(validData);

      // Then
      expect(result).toBe(true);
    });

    it('type 필드가 없으면 false를 반환해야 한다', () => {
      // Given
      const invalidData = {
        id: 'req-123',
        timestamp: Date.now(),
      } as any;

      // When
      const result = QRCodeService.validateQRCodeData(invalidData);

      // Then
      expect(result).toBe(false);
    });

    it('id 필드가 없으면 false를 반환해야 한다', () => {
      // Given
      const invalidData = {
        type: 'pickup',
        timestamp: Date.now(),
      } as any;

      // When
      const result = QRCodeService.validateQRCodeData(invalidData);

      // Then
      expect(result).toBe(false);
    });

    it('timestamp 필드가 없으면 false를 반환해야 한다', () => {
      // Given
      const invalidData = {
        type: 'pickup',
        id: 'req-123',
      } as any;

      // When
      const result = QRCodeService.validateQRCodeData(invalidData);

      // Then
      expect(result).toBe(false);
    });

    it('expectedType과 일치하지 않으면 false를 반환해야 한다', () => {
      // Given
      const data: QRCodeData = {
        type: 'pickup',
        id: 'req-123',
        timestamp: Date.now(),
      };

      // When
      const result = QRCodeService.validateQRCodeData(data, 'delivery');

      // Then
      expect(result).toBe(false);
    });

    it('만료된 QR 코드는 false를 반환해야 한다', () => {
      // Given - 25시간 전
      const expiredData: QRCodeData = {
        type: 'pickup',
        id: 'req-123',
        timestamp: Date.now() - 25 * 60 * 60 * 1000,
      };

      // When
      const result = QRCodeService.validateQRCodeData(expiredData);

      // Then
      expect(result).toBe(false);
    });

    it('24시간 이내의 QR 코드는 유효해야 한다', () => {
      // Given - 23시간 전
      const recentData: QRCodeData = {
        type: 'pickup',
        id: 'req-123',
        timestamp: Date.now() - 23 * 60 * 60 * 1000,
      };

      // When
      const result = QRCodeService.validateQRCodeData(recentData);

      // Then
      expect(result).toBe(true);
    });
  });

  describe('generateQRCodeImage', () => {
    it('QR 코드 이미지 URL을 생성해야 한다', () => {
      // Given
      const testData = 'test-qr-data';

      // When
      const imageUrl = QRCodeService.generateQRCodeImage(testData);

      // Then
      expect(imageUrl).toContain('https://api.qrserver.com/v1/create-qr-code/');
      expect(imageUrl).toContain('size=200x200');
      expect(imageUrl).toContain(encodeURIComponent(testData));
    });

    it('특수 문자가 포함된 데이터도 인코딩해야 한다', () => {
      // Given
      const specialData = 'test data with spaces & special=chars';

      // When
      const imageUrl = QRCodeService.generateQRCodeImage(specialData);

      // Then
      expect(imageUrl).toContain(encodeURIComponent(specialData));
    });
  });
});
