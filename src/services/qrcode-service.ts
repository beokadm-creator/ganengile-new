import { BarcodeScanningResult } from 'expo-camera';

export type QRCodeType = 'pickup' | 'delivery' | 'verification' | 'locker_access';

export interface QRCodeMetadata {
  gillerId?: string;
  userId?: string;
  lockerId?: string;
  reservationId?: string;
  deliveryId?: string;
  requestId?: string;
  step?: 'dropoff' | 'pickup' | 'verification';
}

export interface QRCodeData {
  version: 1;
  type: QRCodeType;
  id: string;
  timestamp: number;
  signature: string;
  metadata?: QRCodeMetadata;
}

const QR_VALIDITY_MS = 24 * 60 * 60 * 1000;
const QR_SIGNATURE_SEED = 'ganengile-beta1-qr';

function computeSignature(type: QRCodeType, id: string, timestamp: number, metadata?: QRCodeMetadata): string {
  const raw = JSON.stringify({
    seed: QR_SIGNATURE_SEED,
    type,
    id,
    timestamp,
    metadata: metadata ?? null,
  });

  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = (hash * 31 + raw.charCodeAt(index)) >>> 0;
  }

  return hash.toString(16).padStart(8, '0');
}

function buildQRCodeData(type: QRCodeType, id: string, metadata?: QRCodeMetadata): QRCodeData {
  const timestamp = Date.now();
  return {
    version: 1,
    type,
    id,
    timestamp,
    signature: computeSignature(type, id, timestamp, metadata),
    metadata,
  };
}

function validateParsedQRCode(parsed: QRCodeData, expectedType?: QRCodeType): string | null {
  if (!parsed.type || !parsed.id || !parsed.timestamp || !parsed.signature) {
    return 'QR 코드 형식이 올바르지 않습니다.';
  }

  if (expectedType && parsed.type !== expectedType) {
    return '예상한 QR 유형과 일치하지 않습니다.';
  }

  const expectedSignature = computeSignature(parsed.type, parsed.id, parsed.timestamp, parsed.metadata);
  if (parsed.signature !== expectedSignature) {
    return 'QR 코드 서명이 일치하지 않습니다.';
  }

  if (Date.now() - parsed.timestamp > QR_VALIDITY_MS) {
    return 'QR 코드가 만료되었습니다.';
  }

  return null;
}

export class QRCodeService {
  static handleQRCodeScan(result: BarcodeScanningResult): QRCodeData | null {
    try {
      const parsed = JSON.parse(result.data) as QRCodeData;
      return validateParsedQRCode(parsed) ? null : parsed;
    } catch (error) {
      console.error('Error parsing QR code:', error);
      return null;
    }
  }

  static generatePickupQRCode(requestId: string, gillerId: string): string {
    return JSON.stringify(
      buildQRCodeData('pickup', requestId, {
        gillerId,
        requestId,
      })
    );
  }

  static generateDeliveryQRCode(requestId: string, gillerId: string): string {
    return JSON.stringify(
      buildQRCodeData('delivery', requestId, {
        gillerId,
        requestId,
      })
    );
  }

  static generateVerificationQRCode(userId: string, metadata?: QRCodeMetadata): string {
    return JSON.stringify(
      buildQRCodeData('verification', userId, {
        userId,
        ...metadata,
      })
    );
  }

  static generateLockerAccessQRCode(params: {
    lockerId: string;
    reservationId: string;
    userId: string;
    deliveryId?: string;
    step?: 'dropoff' | 'pickup' | 'verification';
  }): string {
    return JSON.stringify(
      buildQRCodeData('locker_access', params.reservationId, {
        lockerId: params.lockerId,
        reservationId: params.reservationId,
        userId: params.userId,
        deliveryId: params.deliveryId,
        step: params.step ?? 'verification',
      })
    );
  }

  static validateQRCodeData(data: QRCodeData, expectedType?: QRCodeType): boolean {
    return validateParsedQRCode(data, expectedType) === null;
  }

  static generateQRCodeImage(data: string): string {
    const encodedData = encodeURIComponent(data);
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodedData}`;
  }
}

export default QRCodeService;

export function verifyQRCode(
  qrString: string,
  expectedType?: QRCodeType
): {
  isValid: boolean;
  data?: QRCodeData;
  error?: string;
} {
  try {
    const parsed = JSON.parse(qrString) as QRCodeData;
    const error = validateParsedQRCode(parsed, expectedType);
    if (error) {
      return { isValid: false, error };
    }

    return { isValid: true, data: parsed };
  } catch {
    return { isValid: false, error: 'QR 코드를 해석할 수 없습니다.' };
  }
}

export function getQRCodeRemainingTime(qrCode: string): number {
  try {
    const parsed = JSON.parse(qrCode) as QRCodeData;
    const remaining = QR_VALIDITY_MS - (Date.now() - parsed.timestamp);
    return Math.max(0, Math.floor(remaining / 60000));
  } catch {
    return 0;
  }
}
