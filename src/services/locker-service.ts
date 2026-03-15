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
  LockerStatus,
} from '../types/locker';

const LOCKERS_COLLECTION = 'lockers';
const RESERVATIONS_COLLECTION = 'locker_reservations';

export class LockerService {
  /**
   * 모든 사물함 조회
   */
  async getAllLockers(): Promise<Locker[]> {
    const q = query(collection(db, LOCKERS_COLLECTION));
    const snapshot = await getDocs(q);

    const lockers: Locker[] = [];
    snapshot.forEach((doc) => {
      lockers.push({
        lockerId: doc.id,
        ...doc.data(),
      } as Locker);
    });

    return lockers;
  }

  /**
   * 가용 사물함 조회
   */
  async getAvailableLockers(
    stationId?: string,
    size?: string
  ): Promise<Locker[]> {
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

      lockers.push(locker);
    });

    return lockers;
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
