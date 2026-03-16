/**
 * Locker Service
 * 사물함 관리 서비스
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  Locker,
  PublicLocker,
  PrivateLocker,
  LockerReservation,
  LockerType,
  LockerOperator,
  LockerStatus,
  LockerSize,
} from '../types/locker';
import { getStationConfig } from './config-service';

const LOCKERS_COLLECTION = 'lockers';
const RESERVATIONS_COLLECTION = 'locker_reservations';
const NON_SUBWAY_LOCKERS_COLLECTION = 'non_subway_lockers';
const EXTERNAL_LOCKER_API_URL = process.env.EXPO_PUBLIC_LOCKER_API_URL || '';
const EXTERNAL_LOCKER_API_KEY = process.env.EXPO_PUBLIC_LOCKER_API_KEY || '';
const KRIC_LOCKER_API_URL =
  process.env.EXPO_PUBLIC_KRIC_LOCKER_API_URL ||
  'https://openapi.kric.go.kr/openapi/convenientInfo/stationLocker';
const KRIC_SERVICE_KEY = process.env.EXPO_PUBLIC_KRIC_SERVICE_KEY || '';
const KRIC_RAIL_OPR_ISTT_CD = process.env.EXPO_PUBLIC_KRIC_RAIL_OPR_ISTT_CD || 'S1';

function normalizeLockerSize(value?: string): LockerSize {
  const v = (value || '').toLowerCase();
  if (v.includes('small') || v.includes('소')) return LockerSize.SMALL;
  if (v.includes('medium') || v.includes('중')) return LockerSize.MEDIUM;
  if (v.includes('large') || v.includes('대')) return LockerSize.LARGE;
  return LockerSize.MEDIUM;
}

function normalizeLockerStatus(value?: string): LockerStatus {
  const v = (value || '').toLowerCase();
  if (v.includes('available') || v.includes('free') || v.includes('empty')) return LockerStatus.AVAILABLE;
  if (v.includes('occupied') || v.includes('in_use') || v.includes('busy')) return LockerStatus.OCCUPIED;
  if (v.includes('maintenance') || v.includes('broken')) return LockerStatus.MAINTENANCE;
  return LockerStatus.AVAILABLE;
}

function mapExternalLocker(raw: any): Locker | null {
  const lockerId = raw?.lockerId ?? raw?.id ?? raw?.locker_id;
  const stationId = raw?.stationId ?? raw?.station_id;
  if (!lockerId || !stationId) return null;

  const status = normalizeLockerStatus(raw?.status);
  const size = normalizeLockerSize(raw?.size);

  return {
    lockerId: String(lockerId),
    type: LockerType.PUBLIC,
    operator: (raw?.operator ?? 'seoul_metro') as any,
    location: {
      stationId: String(stationId),
      stationName: raw?.stationName ?? raw?.station_name ?? '',
      line: raw?.line ?? raw?.line_name ?? '',
      floor: raw?.floor ?? 1,
      section: raw?.section ?? raw?.locker_no ?? String(lockerId),
      address: raw?.address,
      nearby: raw?.nearby ?? false,
    },
    size,
    pricing: {
      base: raw?.basePrice ?? raw?.base_price ?? 0,
      baseDuration: raw?.baseDuration ?? raw?.base_duration ?? 240,
      extension: raw?.extensionPrice ?? raw?.extension_price ?? 0,
      maxDuration: raw?.maxDuration ?? raw?.max_duration,
    },
    availability: {
      total: raw?.total ?? 1,
      occupied: raw?.occupied ?? (status === LockerStatus.OCCUPIED ? 1 : 0),
      available: raw?.available ?? (status === LockerStatus.AVAILABLE ? 1 : 0),
    },
    status,
    qrCode: raw?.qrCode ?? raw?.qr_code ?? '',
    accessMethod: raw?.accessMethod ?? 'qr',
  };
}

function normalizeKricSize(value?: string): LockerSize {
  const v = (value || '').toLowerCase();
  if (v.includes('소') || v.includes('small')) return LockerSize.SMALL;
  if (v.includes('중') || v.includes('medium')) return LockerSize.MEDIUM;
  if (v.includes('대') || v.includes('large')) return LockerSize.LARGE;
  return LockerSize.MEDIUM;
}

async function fetchKricLockers(stationId?: string): Promise<Locker[]> {
  if (!KRIC_SERVICE_KEY) return [];
  if (!stationId) return [];

  try {
    const stationConfig = await getStationConfig(stationId);
    const lineCode =
      stationConfig?.kric?.lineCode ||
      stationConfig?.lines?.[0]?.lineCode ||
      '';
    const stinCd =
      stationConfig?.kric?.stationCode ||
      stationId;
    const railOprIsttCd =
      stationConfig?.kric?.railOprIsttCd ||
      KRIC_RAIL_OPR_ISTT_CD;

    if (!lineCode || !stinCd) {
      return [];
    }

    const url = new URL(KRIC_LOCKER_API_URL);
    url.searchParams.set('serviceKey', KRIC_SERVICE_KEY);
    url.searchParams.set('format', 'json');
    url.searchParams.set('railOprIsttCd', railOprIsttCd);
    url.searchParams.set('lnCd', lineCode);
    url.searchParams.set('stinCd', stinCd);

    const res = await fetch(url.toString());
    if (!res.ok) return [];

    const data = await res.json();
    const items =
      data?.response?.body?.items?.item ||
      data?.body?.items?.item ||
      data?.items ||
      data?.item ||
      data?.stationLocker ||
      [];

    const list = Array.isArray(items) ? items : [items];
    const stationName = stationConfig?.stationName || '';

    return list
      .filter(Boolean)
      .map((item: any, index: number) => {
        const size = normalizeKricSize(item?.szNm);
        const facilityCount = Number(item?.faclNum ?? 0);
        const baseFare = Number(item?.utlFare ?? 0);

        return {
          lockerId: `${stinCd}-${size}-${index}`,
          type: LockerType.PUBLIC,
          operator: LockerOperator.SEOUL_METRO,
          location: {
            stationId: stinCd,
            stationName,
            line: item?.lnCd ? `${item.lnCd}호선` : '',
            floor: Number(item?.stinFlor ?? 1),
            section: item?.dtlLoc ?? `보관함-${index + 1}`,
            address: '',
            nearby: false,
          },
          size,
          pricing: {
            base: baseFare,
            baseDuration: 240,
            extension: 0,
          },
          availability: {
            total: facilityCount || 1,
            occupied: 0,
            available: facilityCount || 1,
          },
          status: LockerStatus.AVAILABLE,
          qrCode: '',
          accessMethod: 'qr',
        } as Locker;
      });
  } catch (error) {
    console.error('KRIC locker API fetch failed:', error);
    return [];
  }
}

async function fetchExternalLockers(stationId?: string): Promise<Locker[]> {
  if (KRIC_SERVICE_KEY) {
    const kric = await fetchKricLockers(stationId);
    if (kric.length > 0) return kric;
  }
  if (!EXTERNAL_LOCKER_API_URL) return [];
  try {
    const url = new URL(EXTERNAL_LOCKER_API_URL);
    if (stationId) {
      url.searchParams.set('stationId', stationId);
    }
    const res = await fetch(url.toString(), {
      headers: EXTERNAL_LOCKER_API_KEY
        ? { Authorization: `Bearer ${EXTERNAL_LOCKER_API_KEY}` }
        : undefined,
    });
    if (!res.ok) {
      return [];
    }
    const data = await res.json();
    const items = Array.isArray(data) ? data : data?.items ?? [];
    const mapped = items.map(mapExternalLocker).filter(Boolean) as Locker[];
    return mapped;
  } catch (error) {
    console.error('External locker API fetch failed:', error);
    return [];
  }
}

export class LockerService {
  /**
   * 모든 사물함 조회
   */
  async getAllLockers(): Promise<Locker[]> {
    const external = await fetchExternalLockers();
    const q = query(collection(db, LOCKERS_COLLECTION));
    const snapshot = await getDocs(q);

    const lockers: Locker[] = [];
    snapshot.forEach((doc) => {
      lockers.push({
        lockerId: doc.id,
        ...doc.data(),
      } as Locker);
    });

    if (external.length === 0) {
      return lockers.filter((l) => l.isSubway !== false);
    }

    const merged = new Map<string, Locker>();
    lockers.forEach((l) => {
      if (l.isSubway !== false) merged.set(l.lockerId, l);
    });
    external.forEach((l) => merged.set(l.lockerId, l));
    return Array.from(merged.values());
  }

  /**
   * 가용 사물함 조회
   */
  async getAvailableLockers(
    stationId?: string,
    size?: string
  ): Promise<Locker[]> {
    const external = await fetchExternalLockers(stationId);

    const q = query(
      collection(db, LOCKERS_COLLECTION),
      where('status', '==', LockerStatus.AVAILABLE)
    );

    const snapshot = await getDocs(q);

    const lockers: Locker[] = [];
    snapshot.forEach((doc) => {
      const locker = {
        lockerId: doc.id,
        ...doc.data(),
      } as Locker;

      // 필터링
      if (stationId && locker.location.stationId !== stationId) {
        return;
      }
      if (size && locker.size !== size) {
        return;
      }

      if (locker.isSubway !== false) {
        lockers.push(locker);
      }
    });

    if (external.length === 0) {
      return lockers;
    }

    const filteredExternal = external.filter((locker) => {
      if (stationId && locker.location.stationId !== stationId) {
        return false;
      }
      if (size && locker.size !== size) {
        return false;
      }
      return locker.status === LockerStatus.AVAILABLE;
    });

    const merged = new Map<string, Locker>();
    lockers.forEach((l) => merged.set(l.lockerId, l));
    filteredExternal.forEach((l) => merged.set(l.lockerId, l));
    return Array.from(merged.values());
  }

  /**
   * 사물함 조회
   */
  async getLocker(lockerId: string): Promise<Locker | null> {
    const docRef = doc(db, LOCKERS_COLLECTION, lockerId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      lockerId: docSnap.id,
      ...docSnap.data(),
    } as Locker;
  }

  /**
   * 사물함 예약 생성
   */
  async createReservation(
    lockerId: string,
    userId: string,
    requestId: string,
    size: string,
    durationMinutes: number
  ): Promise<LockerReservation> {
    const locker = await this.getLocker(lockerId);
    if (!locker) {
      throw new Error('Locker not found');
    }

    if (locker.status !== LockerStatus.AVAILABLE) {
      throw new Error('Locker is not available');
    }

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

    // 예약 생성
    const reservationData = {
      lockerId,
      userId,
      requestId,
      size,
      startTime,
      endTime,
      accessCode: this.generateAccessCode(),
      qrCode: '', // TODO: QRCodeService로 생성
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, RESERVATIONS_COLLECTION), reservationData);

    // 사물함 상태 업데이트
    await this.updateLockerStatus(lockerId, LockerStatus.OCCUPIED);

    return {
      reservationId: docRef.id,
      ...reservationData,
    } as unknown as LockerReservation;
  }

  /**
   * 예약 조회
   */
  async getReservation(reservationId: string): Promise<LockerReservation | null> {
    const docRef = doc(db, RESERVATIONS_COLLECTION, reservationId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      reservationId: docSnap.id,
      ...docSnap.data(),
    } as LockerReservation;
  }

  /**
   * 요청에 대한 예약 조회
   */
  async getReservationByRequestId(requestId: string): Promise<LockerReservation[]> {
    const q = query(
      collection(db, RESERVATIONS_COLLECTION),
      where('requestId', '==', requestId)
    );

    const snapshot = await getDocs(q);
    const reservations: LockerReservation[] = [];

    snapshot.forEach((doc) => {
      reservations.push({
        reservationId: doc.id,
        ...doc.data(),
      } as LockerReservation);
    });

    return reservations;
  }

  /**
   * 사용자의 예약 목록 조회
   */
  async getUserReservations(userId: string): Promise<LockerReservation[]> {
    const q = query(
      collection(db, RESERVATIONS_COLLECTION),
      where('userId', '==', userId)
    );

    const snapshot = await getDocs(q);
    const reservations: LockerReservation[] = [];

    snapshot.forEach((doc) => {
      reservations.push({
        reservationId: doc.id,
        ...doc.data(),
      } as LockerReservation);
    });

    return reservations;
  }

  /**
   * 예약 완료 (사물함 반납)
   */
  async completeReservation(reservationId: string): Promise<void> {
    const reservation = await this.getReservation(reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }

    // 예약 상태 업데이트
    const docRef = doc(db, RESERVATIONS_COLLECTION, reservationId);
    await updateDoc(docRef, {
      status: 'completed',
      updatedAt: serverTimestamp(),
    });

    // 사물함 상태 업데이트
    await this.updateLockerStatus(reservation.lockerId, LockerStatus.AVAILABLE);
  }

  /**
   * 사물함 상태 업데이트
   */
  private async updateLockerStatus(
    lockerId: string,
    status: LockerStatus
  ): Promise<void> {
    const docRef = doc(db, LOCKERS_COLLECTION, lockerId);
    await updateDoc(docRef, {
      status,
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * 접근 코드 생성 (4자리 숫자)
   */
  private generateAccessCode(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  /**
   * 추천 사물함 계산
   */
  async recommendLockers(
    pickupStationId: string,
    deliveryStationId: string
  ): Promise<Locker[]> {
    // 픽업역과 배송역 중간에 있는 사물함 추천
    const allLockers = await this.getAllLockers();

    // TODO: 실제 거리 계산 로직 추가
    const pickupLockers = allLockers.filter(
      (locker) => locker.location.stationId === pickupStationId
    );

    return pickupLockers.slice(0, 5); // 상위 5개 반환
  }
}

export function createLockerService(): LockerService {
  return new LockerService();
}

// Convenience functions for backward compatibility
const lockerService = new LockerService();

/**
 * Get locker reservation by ID
 */
export async function getLockerReservation(reservationId: string): Promise<LockerReservation | null> {
  return lockerService.getReservation(reservationId);
}

/**
 * Update reservation status
 */
export async function updateReservationStatus(
  reservationId: string,
  status: string
): Promise<void> {
  const docRef = doc(db, RESERVATIONS_COLLECTION, reservationId);
  await updateDoc(docRef, {
    status,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Add photos to reservation
 */
export async function addReservationPhotos(
  reservationId: string,
  pickupPhotoUrl: string,
  deliveryPhotoUrl?: string
): Promise<void> {
  const docRef = doc(db, RESERVATIONS_COLLECTION, reservationId);
  const updateData: any = {
    updatedAt: serverTimestamp(),
  };

  if (pickupPhotoUrl) {
    updateData.pickupPhotoUrl = pickupPhotoUrl;
  }

  if (deliveryPhotoUrl) {
    updateData.deliveryPhotoUrl = deliveryPhotoUrl;
  }

  await updateDoc(docRef, updateData);
}

/**
 * Get all reservations for a delivery
 */
export async function getDeliveryReservations(deliveryId: string): Promise<LockerReservation[]> {
  const q = query(
    collection(db, RESERVATIONS_COLLECTION),
    where('deliveryId', '==', deliveryId)
  );

  const snapshot = await getDocs(q);
  const reservations: LockerReservation[] = [];

  snapshot.forEach((doc) => {
    reservations.push({
      reservationId: doc.id,
      ...doc.data(),
    } as LockerReservation);
  });

  return reservations;
}

// ==================== Standalone named exports ====================

/**
 * 단일 사물함 조회
 */
export async function getLocker(lockerId: string): Promise<Locker | null> {
  return createLockerService().getLocker(lockerId);
}

/**
 * 사물함 예약 생성 (화면에서 사용하는 시그니처)
 */
export async function createLockerReservation(
  lockerId: string,
  deliveryId: string,
  userId: string,
  type: string,
  startTime: Date,
  endTime: Date,
  qrCode: string
): Promise<LockerReservation> {
  const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
  const reservation = await createLockerService().createReservation(
    lockerId,
    userId,
    deliveryId, // requestId 자리에 deliveryId 사용
    'medium',   // 기본 size
    durationMinutes
  );
  // type과 qrCode는 별도 업데이트
  const docRef = doc(db, RESERVATIONS_COLLECTION, reservation.reservationId);
  await updateDoc(docRef, { type, qrCode, deliveryId, updatedAt: serverTimestamp() });
  return { ...reservation, type, qrCode } as unknown as LockerReservation;
}

/**
 * 사물함 잠금 해제 (QR 코드 검증 후)
 */
export async function unlockLocker(
  lockerId: string,
  qrCode: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const { verifyQRCode } = await import('./qrcode-service');
    const verification = verifyQRCode(qrCode);
    if (!verification.isValid) {
      return { success: false, message: verification.error };
    }
    await updateDoc(doc(db, LOCKERS_COLLECTION, lockerId), {
      status: LockerStatus.OCCUPIED,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

/**
 * 사용 가능한 전체 사물함 목록 조회
 */
export async function getAvailableLockers(): Promise<Locker[]> {
  return createLockerService().getAvailableLockers();
}

/**
 * 역 ID로 사물함 목록 조회
 */
export async function getLockersByStation(stationId: string): Promise<Locker[]> {
  return createLockerService().getAvailableLockers(stationId);
}

/**
 * 비지하철 사물함 목록 조회
 */
export async function getNonSubwayLockers(): Promise<Locker[]> {
  const q = query(collection(db, NON_SUBWAY_LOCKERS_COLLECTION));
  const snapshot = await getDocs(q);
  const lockers: Locker[] = [];
  snapshot.forEach((docSnapshot) => {
    lockers.push({
      lockerId: docSnapshot.id,
      ...(docSnapshot.data() as any),
    } as Locker);
  });
  return lockers;
}

/**
 * Locker 객체를 표시용 LockerLocation 형태로 변환
 */
export function createLockerLocation(locker: Locker): {
  lockerId: string;
  name: string;
  stationName: string;
  status: string;
  isAvailable: boolean;
} {
  return {
    lockerId: locker.lockerId,
    name: locker.location?.section ?? locker.lockerId,
    stationName: locker.location?.stationName ?? '',
    status: locker.status,
    isAvailable: locker.status === LockerStatus.AVAILABLE,
  };
}

/**
 * QR 코드로 예약 조회
 */
export async function getReservationByQRCode(qrCode: string): Promise<LockerReservation | null> {
  const q = query(
    collection(db, RESERVATIONS_COLLECTION),
    where('qrCode', '==', qrCode)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  return { reservationId: d.id, ...d.data() } as LockerReservation;
}

/**
 * 사물함 열기 (예약 상태를 active로 변경)
 */
export async function openLocker(
  lockerId: string,
  reservationId: string
): Promise<{ success: boolean; message?: string }> {
  try {
    await updateDoc(doc(db, RESERVATIONS_COLLECTION, reservationId), {
      status: 'active',
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
