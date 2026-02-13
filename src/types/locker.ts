/**
 * Locker Types
 * 사물함 관련 타입 정의
 */

export enum LockerType {
  PUBLIC = 'public',       // 공공 사물함
  PRIVATE = 'private',     // 민간 사물함
}

export enum LockerOperator {
  SEOUL_METRO = 'seoul_metro',
  KORAIL = 'korail',
  LOCAL_GOV = 'local_gov',
  CU = 'cu',
  GS25 = 'gs25',
  LOCKER_BOX = 'locker_box',
}

export enum LockerSize {
  SMALL = 'small',         // 소형 (30cm x 30cm x 30cm)
  MEDIUM = 'medium',       // 중형 (50cm x 50cm x 50cm)
  LARGE = 'large',         // 대형 (70cm x 70cm x 70cm)
}

export enum LockerStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  MAINTENANCE = 'maintenance',
}

/**
 * 사물함 위치 정보
 */
export interface LockerLocation {
  stationId: string;
  stationName: string;
  line: string;
  floor: number;           // 층
  section: string;         // 구역 (예: "A구역", "1번홀")
  nearby?: boolean;         // 역 인근 100m 이내 (민간 사물함)
  address?: string;        // 주소 (민간 사물함)
}

/**
 * 사물함 요금 정보
 */
export interface LockerPricing {
  base: number;            // 기본 요금
  baseDuration: number;   // 기본 시간 (분)
  extension: number;       // 추가 요금 (분당)
  maxDuration?: number;   // 최대 이용 시간 (분)
}

/**
 * 사물함 가용성 정보
 */
export interface LockerAvailability {
  total: number;
  occupied: number;
  available: number;
}

/**
 * 사물함 정보 (공통)
 */
export interface Locker {
  lockerId: string;
  type: LockerType;
  operator: LockerOperator;
  location: LockerLocation;
  size: LockerSize;
  pricing: LockerPricing;
  availability: LockerAvailability;
  status: LockerStatus;
  qrCode: string;
  accessMethod: 'qr' | 'nfc' | 'pin' | 'app';
}

/**
 * 공공 사물함
 */
export interface PublicLocker extends Locker {
  type: LockerType.PUBLIC;
  operatingHours: {
    open: string;          // "06:00"
    close: string;         // "24:00"
  };
}

/**
 * 민간 사물함
 */
export interface PrivateLocker extends Locker {
  type: LockerType.PRIVATE;
  operatingHours: {
    open: string;          // "00:00"
    close: string;         - "24:00" (24시간)
  };
}

/**
 * 사물함 예약 정보
 */
export interface LockerReservation {
  reservationId: string;
  lockerId: string;
  userId: string;
  requestId: string;
  deliveryId?: string;
  size: LockerSize;
  startTime: Date;
  endTime: Date;
  accessCode: string;    // 4자리 PIN 코드
  qrCode: string;        // 사물함 개방 QR코드
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  pickupPhotoUrl?: string;   // 인수 사진 URL
  dropoffPhotoUrl?: string;  // 인계 사진 URL
  createdAt: Date;
  updatedAt: Date;
}
