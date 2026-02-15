/**
 * QR Code Service - QR 코드 스캔 및 생성
 * 
 * 기능:
 * - 카메라로 QR 코드 스캔
 * - QR 코드 생성 (배송 인증용)
 * - QR 코드 데이터 검증
 */

import { CameraView, BarcodeScanningResult } from 'expo-camera';

export interface QRCodeData {
  type: 'pickup' | 'delivery' | 'verification';
  id: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export class QRCodeService {
  /**
   * QR 코드 스캔 핸들러
   */
  static handleQRCodeScan(result: BarcodeScanningResult): QRCodeData | null {
    try {
      const data = result.data;

      // QR 코드 데이터 파싱
      const parsedData = JSON.parse(data) as QRCodeData;

      // 데이터 검증
      if (!parsedData.type || !parsedData.id || !parsedData.timestamp) {
        console.error('Invalid QR code format');
        return null;
      }

      // 타임스탬프 검증 (24시간 이내만 유효)
      const now = Date.now();
      const qrTime = parsedData.timestamp;
      const timeDiff = now - qrTime;
      const oneDay = 24 * 60 * 60 * 1000;

      if (timeDiff > oneDay) {
        console.error('QR code expired');
        return null;
      }

      return parsedData;
    } catch (error) {
      console.error('Error parsing QR code:', error);
      return null;
    }
  }

  /**
   * 픽업 인증 QR 코드 생성
   */
  static generatePickupQRCode(requestId: string, gillerId: string): string {
    const qrData: QRCodeData = {
      type: 'pickup',
      id: requestId,
      timestamp: Date.now(),
      metadata: {
        gillerId,
      },
    };

    return JSON.stringify(qrData);
  }

  /**
   * 배송 완료 QR 코드 생성
   */
  static generateDeliveryQRCode(requestId: string, gillerId: string): string {
    const qrData: QRCodeData = {
      type: 'delivery',
      id: requestId,
      timestamp: Date.now(),
      metadata: {
        gillerId,
      },
    };

    return JSON.stringify(qrData);
  }

  /**
   * 인증 QR 코드 생성
   */
  static generateVerificationQRCode(userId: string): string {
    const qrData: QRCodeData = {
      type: 'verification',
      id: userId,
      timestamp: Date.now(),
    };

    return JSON.stringify(qrData);
  }

  /**
   * QR 코드 데이터 검증
   */
  static validateQRCodeData(data: QRCodeData, expectedType?: string): boolean {
    // 필수 필드 확인
    if (!data.type || !data.id || !data.timestamp) {
      return false;
    }

    // 타입 검증
    if (expectedType && data.type !== expectedType) {
      return false;
    }

    // 타임스탬프 검증 (24시간 이내)
    const now = Date.now();
    const timeDiff = now - data.timestamp;
    const oneDay = 24 * 60 * 60 * 1000;

    if (timeDiff > oneDay) {
      return false;
    }

    return true;
  }

  /**
   * QR 코드 생성기 (Google Charts API 또는 라이브러리 사용)
   * TODO: QR 코드 생성 라이브러리 연동 (react-native-qrcode-svg 등)
   */
  static generateQRCodeImage(data: string): string {
    // Google Charts API (개발용, 프로덕션에서는 로컬 라이브러리 권장)
    const encodedData = encodeURIComponent(data);
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodedData}`;
  }
}

export default QRCodeService;
