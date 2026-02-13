/**
 * QR Code Service
 * QR코드 생성/검증 서비스 (JWT 기반)
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  QRCodeType,
  QRCodeStatus,
  QRCodeInfo,
  QRCodePayload,
  QRCodeVerification,
  QRCodeGenerateOptions,
} from '../types/qrcode';

const QRCODES_COLLECTION = 'qrcodes';

/**
 * JWT 관리 (간소 구현)
 * NOTE: 프로덕션에서는 jsonwebtoken 라이브러리 사용 권장
 */
class JWTManager {
  private SECRET = 'ganengile-qrcode-secret-key'; // TODO: 환경 변수로 이동

  /**
   * JWT 토큰 생성
   */
  createToken(payload: QRCodePayload): string {
    const header = {
      alg: 'HS256',
      typ: 'JWT',
    };

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));

    const signature = this.sign(encodedHeader, encodedPayload);
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * JWT 토큰 검증
   */
  verifyToken(token: string): QRCodePayload | null {
    try {
      const [encodedHeader, encodedPayload, signature] = token.split('.');

      // 서명 검증
      const expectedSignature = this.sign(encodedHeader, encodedPayload);
      if (signature !== expectedSignature) {
        return null;
      }

      const payload = JSON.parse(this.base64UrlDecode(encodedPayload));

      // 만료 검증
      if (payload.expiresAt < Date.now()) {
        return null;
      }

      return payload;
    } catch (error) {
      console.error('JWT verification error:', error);
      return null;
    }
  }

  private sign(header: string, payload: string): string {
    const data = `${header}.${payload}`;
    // 간소 HMAC-SHA256 구현 (실제로는 crypto 라이브러리 사용)
    return this.base64UrlEncode(this.simpleHash(data));
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

  private base64UrlEncode(str: string): string {
    return Buffer.from(str).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  private base64UrlDecode(str: string): string {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) {
      str += '=';
    }
    return Buffer.from(str, 'base64').toString();
  }
}

export class QRCodeService {
  private jwt: JWTManager;

  constructor() {
    this.jwt = new JWTManager();
  }

  /**
   * QR코드 생성
   */
  async generateQRCode(options: QRCodeGenerateOptions): Promise<string> {
    const expiresAt = Date.now() + options.expiresInMinutes * 60 * 1000;

    // JWT 페이로드 생성
    const payload: QRCodePayload = {
      type: options.type,
      reservationId: options.reservationId,
      userId: options.userId,
      lockerId: options.lockerId,
      expiresAt,
      createdAt: Date.now(),
      signature: '', // JWT 서명으로 채워짐
    };

    // JWT 토큰 생성
    const token = this.jwt.createToken(payload);

    // QR코드 정보 저장
    const qrCodeData = {
      type: options.type,
      reservationId: options.reservationId,
      userId: options.userId,
      lockerId: options.lockerId,
      code: token,
      expiresAt: new Date(expiresAt),
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = await addDoc(collection(db, QRCODES_COLLECTION), qrCodeData);

    return token;
  }

  /**
   * QR코드 검증
   */
  async verifyQRCode(code: string): Promise<QRCodeVerification> {
    // JWT 토큰 검증
    const payload = this.jwt.verifyToken(code);

    if (!payload) {
      return {
        isValid: false,
        error: 'Invalid QR code or signature mismatch',
      };
    }

    // 만료 검증
    if (payload.expiresAt < Date.now()) {
      // QR코드 상태 업데이트
      await this.updateQRCodeStatus(code, 'expired');
      
      return {
        isValid: false,
        error: 'QR code has expired',
      };
    }

    // DB에서 QR코드 정보 조회
    const qrCode = await this.getQRCodeByPayload(payload);
    if (!qrCode) {
      return {
        isValid: false,
        error: 'QR code not found in database',
      };
    }

    if (qrCode.status !== 'active') {
      return {
        isValid: false,
        error: `QR code is ${qrCode.status}`,
      };
    }

    return {
      isValid: true,
      qrCode,
      payload,
    };
  }

  /**
   * QR코드 사용 완료 처리
   */
  async markQRCodeAsUsed(code: string, userId: string): Promise<void> {
    const verification = await this.verifyQRCode(code);
    if (!verification.isValid) {
      throw new Error(verification.error || 'Invalid QR code');
    }

    await this.updateQRCodeStatus(code, 'used', {
      usedAt: new Date(),
      usedBy: userId,
    });
  }

  /**
   * QR코드 상태 업데이트
   */
  private async updateQRCodeStatus(
    code: string,
    status: QRCodeStatus,
    additionalData?: any
  ): Promise<void> {
    // 페이로드에서 reservationId 추출
    const payload = this.jwt.verifyToken(code);
    if (!payload) {
      throw new Error('Invalid QR code');
    }

    const q = query(
      collection(db, QRCODES_COLLECTION),
      where('reservationId', '==', payload.reservationId)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      throw new Error('QR code not found');
    }

    const docRef = snapshot.docs[0].ref;
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (additionalData) {
      Object.assign(updateData, additionalData);
    }

    await updateDoc(docRef, updateData);
  }

  /**
   * 페이로드로 QR코드 조회
   */
  private async getQRCodeByPayload(payload: QRCodePayload): Promise<QRCodeInfo | null> {
    const q = query(
      collection(db, QRCODES_COLLECTION),
      where('reservationId', '==', payload.reservationId)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      qrCodeId: doc.id,
      ...doc.data(),
    } as QRCodeInfo;
  }

  /**
   * 예약에 대한 QR코드 조회
   */
  async getQRCodeByReservationId(reservationId: string): Promise<QRCodeInfo | null> {
    const q = query(
      collection(db, QRCODES_COLLECTION),
      where('reservationId', '==', reservationId)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      qrCodeId: doc.id,
      ...doc.data(),
    } as QRCodeInfo;
  }
}

export function createQRCodeService(): QRCodeService {
  return new QRCodeService();
}
