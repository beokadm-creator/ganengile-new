import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  Locker,
  LockerAvailability,
  LockerOperator,
  LockerReservation,
  LockerSize,
  LockerStatus,
  LockerType,
} from '../types/locker';
import { getStationConfig } from './config-service';
import { QRCodeService, verifyQRCode } from './qrcode-service';

const LOCKERS_COLLECTION = 'lockers';
const RESERVATIONS_COLLECTION = 'locker_reservations';
const NON_SUBWAY_LOCKERS_COLLECTION = 'non_subway_lockers';
const EXTERNAL_LOCKER_API_URL = String(process.env.EXPO_PUBLIC_LOCKER_API_URL ?? '');
const EXTERNAL_LOCKER_API_KEY = String(process.env.EXPO_PUBLIC_LOCKER_API_KEY ?? '');
const KRIC_LOCKER_API_URL =
  String(process.env.EXPO_PUBLIC_KRIC_LOCKER_API_URL ?? '') || 'https://openapi.kric.go.kr/openapi/convenientInfo/stationLocker';
const KRIC_SERVICE_KEY = String(process.env.EXPO_PUBLIC_KRIC_SERVICE_KEY ?? '');
const KRIC_RAIL_OPR_ISTT_CD = String(process.env.EXPO_PUBLIC_KRIC_RAIL_OPR_ISTT_CD ?? 'S1');

type UnknownRecord = Record<string, unknown>;
type LockerDoc = Partial<Locker> & {
  status?: string;
  operator?: string;
};
type ReservationStatus = LockerReservation['status'];
type ReservationDoc = Partial<LockerReservation> & {
  startTime?: Timestamp | Date | string | number;
  endTime?: Timestamp | Date | string | number;
  createdAt?: Timestamp | Date | string | number;
  updatedAt?: Timestamp | Date | string | number;
  status?: ReservationStatus;
};
type ExternalLockerPayload = UnknownRecord & {
  items?: unknown;
  item?: unknown;
  stationLocker?: unknown;
  response?: {
    body?: {
      items?: {
        item?: unknown;
      };
    };
  };
  body?: {
    items?: {
      item?: unknown;
    };
  };
};

function asRecord(value: unknown): UnknownRecord {
  return typeof value === 'object' && value !== null ? (value as UnknownRecord) : {};
}

function readString(record: UnknownRecord, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return undefined;
}

function readNumber(record: UnknownRecord, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

function readBoolean(record: UnknownRecord, ...keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'boolean') {
      return value;
    }
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return undefined;
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function toDate(value: Timestamp | Date | string | number | undefined): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }
  return new Date();
}

function normalizeLockerSize(value?: string): LockerSize {
  const normalized = (value ?? '').toLowerCase();
  if (normalized.includes('소')) return LockerSize.SMALL;
  if (normalized.includes('대')) return LockerSize.LARGE;
  if (normalized.includes('중')) return LockerSize.MEDIUM;
  if (normalized.includes('small')) return LockerSize.SMALL;
  if (normalized.includes('large')) return LockerSize.LARGE;
  return LockerSize.MEDIUM;
}

function normalizeLockerStatus(value?: string): LockerStatus {
  const normalized = (value ?? '').toLowerCase();
  if (normalized.includes('occupied') || normalized.includes('busy') || normalized.includes('in_use')) {
    return LockerStatus.OCCUPIED;
  }
  if (normalized.includes('maintenance') ?? normalized.includes('broken')) {
    return LockerStatus.MAINTENANCE;
  }
  return LockerStatus.AVAILABLE;
}

function normalizeOperator(value?: string): LockerOperator {
  if (!value) return LockerOperator.SEOUL_METRO;
  const normalized = value.toLowerCase();
  
  // KRIC 기관 코드 (railOprIsttCd) 처리
  if (normalized === 'k1') return LockerOperator.KORAIL;
  if (['i1', 'd1', 'b1', 'g1'].includes(normalized)) return LockerOperator.LOCAL_GOV;
  if (normalized === 's1') return LockerOperator.SEOUL_METRO;

  switch (normalized) {
    case LockerOperator.KORAIL:
    case LockerOperator.LOCAL_GOV:
    case LockerOperator.CU:
    case LockerOperator.GS25:
    case LockerOperator.LOCKER_BOX:
      return normalized as LockerOperator;
    default:
      return LockerOperator.SEOUL_METRO;
  }
}

function buildAvailability(total: number, occupied: number, available: number): LockerAvailability {
  return {
    total: total > 0 ? total : Math.max(available + occupied, 1),
    occupied: occupied >= 0 ? occupied : 0,
    available: available >= 0 ? available : 0,
  };
}

function mapFirestoreLocker(lockerId: string, raw: LockerDoc): Locker {
  const location = raw.location;
  const pricing = raw.pricing;
  const availability = raw.availability;
  const status = typeof raw.status === 'string' ? normalizeLockerStatus(raw.status) : raw.status ?? LockerStatus.AVAILABLE;

  return {
    lockerId,
    type: raw.type ?? LockerType.PUBLIC,
    operator: normalizeOperator(typeof raw.operator === 'string' ? raw.operator : raw.operator),
    location: {
      stationId: location?.stationId ?? '',
      stationName: location?.stationName ?? '',
      line: location?.line ?? '',
      floor: location?.floor ?? 1,
      section: location?.section ?? lockerId,
      latitude: location?.latitude,
      longitude: location?.longitude,
      address: location?.address,
      contactPhone: location?.contactPhone,
      nearby: location?.nearby ?? false,
    },
    size: raw.size ?? LockerSize.MEDIUM,
    pricing: {
      base: pricing?.base ?? 0,
      baseDuration: pricing?.baseDuration ?? 240,
      extension: pricing?.extension ?? 0,
      maxDuration: pricing?.maxDuration,
    },
    availability: buildAvailability(
      availability?.total ?? 1,
      availability?.occupied ?? (status === LockerStatus.OCCUPIED ? 1 : 0),
      availability?.available ?? (status === LockerStatus.AVAILABLE ? 1 : 0)
    ),
    status,
    qrCode: raw.qrCode ?? '',
    accessMethod: raw.accessMethod ?? 'qr',
    isSubway: raw.isSubway ?? true,
  };
}

function mapExternalLocker(raw: unknown): Locker | null {
  const record = asRecord(raw);
  const lockerId = readString(record, 'lockerId', 'id', 'locker_id');
  const stationId = readString(record, 'stationId', 'station_id');

  if (!lockerId || !stationId) {
    return null;
  }

  const status = normalizeLockerStatus(readString(record, 'status'));

  return {
    lockerId,
    type: LockerType.PUBLIC,
    operator: normalizeOperator(readString(record, 'operator')),
    location: {
      stationId,
      stationName: readString(record, 'stationName', 'station_name') ?? '',
      line: readString(record, 'line', 'line_name') ?? '',
      floor: readNumber(record, 'floor') ?? 1,
      section: readString(record, 'section', 'locker_no') ?? lockerId,
      latitude: readNumber(record, 'latitude', 'lat'),
      longitude: readNumber(record, 'longitude', 'lng'),
      address: readString(record, 'address'),
      contactPhone: readString(record, 'telNo', 'phone', 'contactPhone'),
      nearby: readBoolean(record, 'nearby') ?? false,
    },
    size: normalizeLockerSize(readString(record, 'size')),
    pricing: {
      base: readNumber(record, 'basePrice', 'base_price') ?? 0,
      baseDuration: readNumber(record, 'baseDuration', 'base_duration') ?? 240,
      extension: readNumber(record, 'extensionPrice', 'extension_price') ?? 0,
      maxDuration: readNumber(record, 'maxDuration', 'max_duration'),
    },
    availability: buildAvailability(
      readNumber(record, 'total') ?? 1,
      readNumber(record, 'occupied') ?? (status === LockerStatus.OCCUPIED ? 1 : 0),
      readNumber(record, 'available') ?? (status === LockerStatus.AVAILABLE ? 1 : 0)
    ),
    status,
    qrCode: readString(record, 'qrCode', 'qr_code') ?? '',
    accessMethod: (readString(record, 'accessMethod') as Locker['accessMethod'] | undefined) ?? 'qr',
    isSubway: true,
  };
}

function mapReservation(reservationId: string, raw: ReservationDoc): LockerReservation {
  return {
    reservationId,
    lockerId: raw.lockerId ?? '',
    userId: raw.userId ?? '',
    requestId: raw.requestId ?? '',
    deliveryId: raw.deliveryId,
    type: raw.type,
    size: raw.size ?? LockerSize.MEDIUM,
    startTime: toDate(raw.startTime),
    endTime: toDate(raw.endTime),
    accessCode: raw.accessCode ?? '',
    qrCode: raw.qrCode ?? '',
    status: raw.status ?? 'pending',
    pickupPhotoUrl: raw.pickupPhotoUrl,
    dropoffPhotoUrl: raw.dropoffPhotoUrl,
    createdAt: toDate(raw.createdAt),
    updatedAt: toDate(raw.updatedAt),
  };
}

async function fetchKricLockers(stationId?: string): Promise<Locker[]> {
  if (!KRIC_SERVICE_KEY || !stationId) {
    return [];
  }

  try {
    const stationConfig = (await getStationConfig(stationId)) as {
      stationName?: string;
      kric?: {
        lineCode?: string;
        stationCode?: string;
        railOprIsttCd?: string;
      };
      lines?: Array<{ lineCode?: string }>;
    } | null;
    const lineCode = stationConfig?.kric?.lineCode ?? stationConfig?.lines?.[0]?.lineCode ?? '';
    const stationCode = stationConfig?.kric?.stationCode ?? stationId;
    const railCode = stationConfig?.kric?.railOprIsttCd ?? KRIC_RAIL_OPR_ISTT_CD;

    if (!lineCode || !stationCode) {
      return [];
    }

    const queryString = `?serviceKey=${KRIC_SERVICE_KEY}&format=json&railOprIsttCd=${railCode}&lnCd=${lineCode}&stinCd=${stationCode}`;
    const fullUrl = KRIC_LOCKER_API_URL + queryString;

    const response = await fetch(fullUrl);
    if (!response.ok) {
      return [];
    }

    const text = await response.text();
    let payload: ExternalLockerPayload;
    try {
      payload = JSON.parse(text) as ExternalLockerPayload;
    } catch (e) {
      console.warn('Failed to parse KRIC Locker API response:', text);
      return [];
    }

    const rawItems =
      payload.response?.body?.items?.item ??
      payload.body?.items?.item ??
      payload.items ??
      payload.item ??
      payload.stationLocker ??
      [];

    const stationName = stationConfig?.stationName ?? '';

    return toArray(rawItems)
      .map((item, index) => {
        const record = asRecord(item);
        const facilityCount = readNumber(record, 'faclNum') ?? 1;
        const baseFare = readNumber(record, 'utlFare') ?? 0;
        const line = readString(record, 'lnCd');
        const floorNum = readNumber(record, 'stinFlor') ?? 1;
        const isUnderground = readString(record, 'grndDvNm') === '지하';
        const operatorCode = readString(record, 'railOprIsttCd');

        return {
          lockerId: `${stationCode}-${index + 1}`,
          type: LockerType.PUBLIC,
          operator: normalizeOperator(operatorCode),
          location: {
            stationId: stationCode,
            stationName,
            line: line ? `${line}호선` : '',
            floor: isUnderground ? -floorNum : floorNum,
            section: readString(record, 'dtlLoc') ?? `보관함 ${index + 1}`,
            latitude: (stationConfig as any)?.location?.latitude ?? (stationConfig as any)?.location?.lat,
            longitude: (stationConfig as any)?.location?.longitude ?? (stationConfig as any)?.location?.lng,
            address: '',
            contactPhone: readString(record, 'telNo'),
            nearby: false,
          },
          size: normalizeLockerSize(readString(record, 'szNm')),
          pricing: {
            base: baseFare,
            baseDuration: 240,
            extension: 0,
          },
          availability: buildAvailability(facilityCount, 0, facilityCount),
          status: LockerStatus.AVAILABLE,
          qrCode: '',
          accessMethod: 'qr',
          isSubway: true,
        } satisfies Locker;
      })
      .filter(Boolean);
  } catch (error) {
    console.error('KRIC locker API fetch failed:', error);
    return [];
  }
}

async function fetchExternalLockers(stationId?: string): Promise<Locker[]> {
  if (KRIC_SERVICE_KEY) {
    const kricLockers = await fetchKricLockers(stationId);
    if (kricLockers.length > 0) {
      return kricLockers;
    }
  }

  if (!EXTERNAL_LOCKER_API_URL) {
    return [];
  }

  try {
    const url = new URL(EXTERNAL_LOCKER_API_URL);
    if (stationId) {
      url.searchParams.set('stationId', stationId);
    }

    const response = await fetch(url.toString(), {
      headers: EXTERNAL_LOCKER_API_KEY ? { Authorization: `Bearer ${EXTERNAL_LOCKER_API_KEY}` } : undefined,
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as unknown;
    const records = Array.isArray(payload) ? payload : toArray(asRecord(payload).items);
    return records.map(mapExternalLocker).filter((locker): locker is Locker => locker !== null);
  } catch (error) {
    console.error('External locker API fetch failed:', error);
    return [];
  }
}

async function readFirestoreLockers(
  collectionName: string,
  onlyAvailable = false
): Promise<Locker[]> {
  const baseQuery = onlyAvailable
    ? query(collection(db, collectionName), where('status', '==', LockerStatus.AVAILABLE))
    : query(collection(db, collectionName));

  const snapshot = await getDocs(baseQuery);
  return snapshot.docs.map((snapshotDoc) => mapFirestoreLocker(snapshotDoc.id, snapshotDoc.data() as LockerDoc));
}

async function readReservationList(filters: { field: 'requestId' | 'userId' | 'deliveryId'; value: string }): Promise<LockerReservation[]> {
  const reservationQuery = query(collection(db, RESERVATIONS_COLLECTION), where(filters.field, '==', filters.value));
  const snapshot = await getDocs(reservationQuery);
  return snapshot.docs.map((snapshotDoc) => mapReservation(snapshotDoc.id, snapshotDoc.data() as ReservationDoc));
}

export class LockerService {
  async getAllLockers(): Promise<Locker[]> {
    const [firestoreLockers, externalLockers] = await Promise.all([
      readFirestoreLockers(LOCKERS_COLLECTION),
      fetchExternalLockers(),
    ]);

    if (externalLockers.length === 0) {
      return firestoreLockers.filter((locker) => locker.isSubway !== false);
    }

    const merged = new Map<string, Locker>();
    firestoreLockers
      .filter((locker) => locker.isSubway !== false)
      .forEach((locker) => merged.set(locker.lockerId, locker));
    externalLockers.forEach((locker) => merged.set(locker.lockerId, locker));
    return Array.from(merged.values());
  }

  async getAvailableLockers(stationId?: string, size?: string): Promise<Locker[]> {
    const [firestoreLockers, externalLockers] = await Promise.all([
      readFirestoreLockers(LOCKERS_COLLECTION, true),
      fetchExternalLockers(stationId),
    ]);

    const normalizedSize = size ? normalizeLockerSize(size) : undefined;
    const matches = (locker: Locker): boolean => {
      if (stationId && locker.location.stationId !== stationId) return false;
      if (normalizedSize && locker.size !== normalizedSize) return false;
      return locker.status === LockerStatus.AVAILABLE;
    };

    const merged = new Map<string, Locker>();
    firestoreLockers
      .filter((locker) => locker.isSubway !== false)
      .filter(matches)
      .forEach((locker) => merged.set(locker.lockerId, locker));
    externalLockers.filter(matches).forEach((locker) => merged.set(locker.lockerId, locker));
    return Array.from(merged.values());
  }

  async getLocker(lockerId: string): Promise<Locker | null> {
    const snapshot = await getDoc(doc(db, LOCKERS_COLLECTION, lockerId));
    if (snapshot.exists()) {
      return mapFirestoreLocker(snapshot.id, snapshot.data() as LockerDoc);
    }

    const external = await fetchExternalLockers();
    return external.find((locker) => locker.lockerId === lockerId) ?? null;
  }

  async createReservation(
    lockerId: string,
    userId: string,
    requestId: string,
    size: string,
    durationMinutes: number
  ): Promise<LockerReservation> {
    let lockerStatusCheckRequired = true;
    let actualLockerId: string | null = lockerId;
    let isLazyAllocation = false;

    if (lockerId.startsWith('AREA::')) {
      isLazyAllocation = true;
      actualLockerId = null;
      lockerStatusCheckRequired = false;
    }

    if (lockerStatusCheckRequired && actualLockerId) {
      const locker = await this.getLocker(actualLockerId);
      if (!locker) {
        throw new Error('Locker not found');
      }
      if (locker.status !== LockerStatus.AVAILABLE) {
        // Only warn for now, since external APIs might have outdated status
        console.warn('Locker is reported as not available, proceeding anyway for manual selection', locker.status);
      }
    }

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
    const reservationData = {
      lockerId: actualLockerId || lockerId, // Store the AREA ID if lazy allocation
      userId,
      requestId,
      size: normalizeLockerSize(size),
      startTime,
      endTime,
      accessCode: this.generateAccessCode(),
      qrCode: '',
      status: (isLazyAllocation ? 'pending_allocation' : 'pending') as ReservationStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const snapshot = await addDoc(collection(db, RESERVATIONS_COLLECTION), reservationData);
    
    if (!isLazyAllocation && actualLockerId) {
      await this.updateLockerStatus(actualLockerId, LockerStatus.OCCUPIED).catch(error => {
        console.warn('Failed to update locker status, proceeding anyway', error);
      });
    }

    return {
      reservationId: snapshot.id,
      ...reservationData,
      createdAt: startTime,
      updatedAt: startTime,
    } as LockerReservation;
  }

  async assignLockerToReservation(reservationId: string, actualLockerId: string): Promise<void> {
    const reservation = await this.getReservation(reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }

    const locker = await this.getLocker(actualLockerId);
    if (!locker) {
      throw new Error('Locker not found');
    }
    if (locker.status !== LockerStatus.AVAILABLE) {
      throw new Error('Locker is not available');
    }

    await updateDoc(doc(db, RESERVATIONS_COLLECTION, reservationId), {
      lockerId: actualLockerId,
      status: 'active',
      updatedAt: serverTimestamp(),
    });

    await this.updateLockerStatus(actualLockerId, LockerStatus.OCCUPIED);
  }

  async getReservation(reservationId: string): Promise<LockerReservation | null> {
    const snapshot = await getDoc(doc(db, RESERVATIONS_COLLECTION, reservationId));
    if (!snapshot.exists()) {
      return null;
    }

    return mapReservation(snapshot.id, snapshot.data() as ReservationDoc);
  }

  async getReservationByRequestId(requestId: string): Promise<LockerReservation[]> {
    return readReservationList({ field: 'requestId', value: requestId });
  }

  async getUserReservations(userId: string): Promise<LockerReservation[]> {
    return readReservationList({ field: 'userId', value: userId });
  }

  async completeReservation(reservationId: string): Promise<void> {
    const reservation = await this.getReservation(reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }

    await updateDoc(doc(db, RESERVATIONS_COLLECTION, reservationId), {
      status: 'completed',
      updatedAt: serverTimestamp(),
    });

    // Lazy Allocation의 경우 실제 사물함 ID가 아닐 수 있으므로 확인
    if (!reservation.lockerId.startsWith('AREA::')) {
      await this.updateLockerStatus(reservation.lockerId, LockerStatus.AVAILABLE);
    }
  }

  async cancelReservation(reservationId: string): Promise<void> {
    const reservation = await this.getReservation(reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }

    await updateDoc(doc(db, RESERVATIONS_COLLECTION, reservationId), {
      status: 'cancelled',
      updatedAt: serverTimestamp(),
    });

    if (!reservation.lockerId.startsWith('AREA::')) {
      await this.updateLockerStatus(reservation.lockerId, LockerStatus.AVAILABLE);
    }
  }

  private async updateLockerStatus(lockerId: string, status: LockerStatus): Promise<void> {
    await updateDoc(doc(db, LOCKERS_COLLECTION, lockerId), {
      status,
      updatedAt: serverTimestamp(),
    });
  }

  private generateAccessCode(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  async recommendLockers(pickupStationId: string, _deliveryStationId: string): Promise<Locker[]> {
    const allLockers = await this.getAllLockers();
    return allLockers.filter((locker) => locker.location.stationId === pickupStationId).slice(0, 5);
  }
}

const FALLBACK_LOCKER_FEE = 1000; // 정책/구성값에 따른 기본 사물함 요금

/**
 * 지연 할당(Lazy Allocation) ID를 기반으로 사물함의 최소/평균 요금을 계산합니다.
 * @param areaLockerId "AREA::stationId::section" 형태의 지연 할당 ID
 */
export async function calculateAreaLockerFee(areaLockerId: string) {
  if (!areaLockerId.startsWith('AREA::')) {
    return null;
  }

  const parts = areaLockerId.split('::');
  const stationId = parts[1];
  const section = parts[2]; // 선택 사항

  if (!stationId) return null;

  const lockers = await getLockersByStation(stationId);
  
  const targetLockers = section && section !== 'default' 
    ? lockers.filter(locker => locker.location.section === section)
    : lockers;

  if (targetLockers.length === 0) {
    return { minFee: FALLBACK_LOCKER_FEE, averageFee: FALLBACK_LOCKER_FEE };
  }

  const basePrices = targetLockers.map(locker => locker.pricing.base);
  const minFee = Math.min(...basePrices);
  const averageFee = Math.round(
    basePrices.reduce((sum, price) => sum + price, 0) / basePrices.length
  );

  return { minFee, averageFee };
}

export function createLockerService(): LockerService {
  return new LockerService();
}

const lockerService = new LockerService();

export async function getLockerReservation(reservationId: string): Promise<LockerReservation | null> {
  return lockerService.getReservation(reservationId);
}

export async function updateReservationStatus(reservationId: string, status: string): Promise<void> {
  await updateDoc(doc(db, RESERVATIONS_COLLECTION, reservationId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function assignLockerToReservation(reservationId: string, actualLockerId: string): Promise<void> {
  return lockerService.assignLockerToReservation(reservationId, actualLockerId);
}

export async function getReservationByRequestId(requestId: string): Promise<LockerReservation[]> {
  return lockerService.getReservationByRequestId(requestId);
}

export async function completeLockerReservation(reservationId: string): Promise<void> {
  await lockerService.completeReservation(reservationId);
}

export async function cancelLockerReservation(reservationId: string): Promise<void> {
  await lockerService.cancelReservation(reservationId);
}

export async function addReservationPhotos(
  reservationId: string,
  pickupPhotoUrl?: string,
  deliveryPhotoUrl?: string
): Promise<void> {
  const updateData: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (pickupPhotoUrl) {
    updateData.pickupPhotoUrl = pickupPhotoUrl;
  }

  if (deliveryPhotoUrl) {
    updateData.dropoffPhotoUrl = deliveryPhotoUrl;
  }

  await updateDoc(doc(db, RESERVATIONS_COLLECTION, reservationId), updateData);
}

export async function getDeliveryReservations(deliveryId: string): Promise<LockerReservation[]> {
  return readReservationList({ field: 'deliveryId', value: deliveryId });
}

export async function getLocker(lockerId: string): Promise<Locker | null> {
  return lockerService.getLocker(lockerId);
}

export async function createLockerReservation(
  lockerId: string,
  requestId: string,
  deliveryId: string,
  userId: string,
  type: string,
  startTime: Date,
  endTime: Date,
  qrCode: string
): Promise<LockerReservation> {
  const durationMinutes = Math.max(1, Math.round((endTime.getTime() - startTime.getTime()) / 60000));
  const reservation = await lockerService.createReservation(lockerId, userId, requestId, 'medium', durationMinutes);

  const accessQrCode = QRCodeService.generateLockerAccessQRCode({
    lockerId,
    reservationId: reservation.reservationId,
    userId,
    deliveryId,
    step: type === 'giller_dropoff' ? 'dropoff' : 'pickup',
  });

  await updateDoc(doc(db, RESERVATIONS_COLLECTION, reservation.reservationId), {
    type,
    qrCode: accessQrCode ?? qrCode,
    deliveryId,
    updatedAt: serverTimestamp(),
  });

  return {
    ...reservation,
    type,
    deliveryId,
    qrCode: accessQrCode ?? qrCode,
    startTime,
    endTime,
  };
}

export async function unlockLocker(
  lockerId: string,
  qrCode: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const verification = verifyQRCode(qrCode, 'locker_access');
    if (!verification.isValid) {
      return { success: false, message: verification.error };
    }

    const qrLockerId = verification.data?.metadata?.lockerId;
    if (qrLockerId && qrLockerId !== lockerId) {
      return { success: false, message: '이 QR 코드는 다른 사물함용입니다.' };
    }

    const reservationId = verification.data?.metadata?.reservationId as string | undefined;
    if (reservationId) {
      const reservation = await getLockerReservation(reservationId);
      if (!reservation) {
        return { success: false, message: '예약 정보를 찾을 수 없습니다.' };
      }

      if (reservation.status === 'cancelled' || reservation.status === 'completed') {
        return { success: false, message: '유효하지 않은 예약입니다 (취소 또는 완료됨).' };
      }

      const now = new Date();
      if (reservation.startTime && now < reservation.startTime) {
        return { success: false, message: '예약 시작 시간이 되지 않았습니다.' };
      }
      if (reservation.endTime && now > reservation.endTime) {
        return { success: false, message: '예약 시간이 만료되었습니다.' };
      }
    }

    await updateDoc(doc(db, LOCKERS_COLLECTION, lockerId), {
      status: LockerStatus.OCCUPIED,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : '사물함을 열 수 없습니다.';
    return { success: false, message };
  }
}

export async function getAvailableLockers(): Promise<Locker[]> {
  return lockerService.getAvailableLockers();
}

export async function getLockersByStation(stationId: string): Promise<Locker[]> {
  return lockerService.getAvailableLockers(stationId);
}

export async function getNonSubwayLockers(): Promise<Locker[]> {
  return readFirestoreLockers(NON_SUBWAY_LOCKERS_COLLECTION);
}

export function createLockerLocation(locker: Locker): {
  lockerId: string;
  name: string;
  stationName: string;
  line: string;
  floor: number;
  section: string;
  size: LockerSize;
  pricePer4Hours: number;
  baseDurationMinutes: number;
  telNo?: string;
  status: string;
  isAvailable: boolean;
} {
  return {
    lockerId: locker.lockerId,
    name: locker.location.section ?? locker.lockerId,
    stationName: locker.location.stationName,
    line: locker.location.line,
    floor: locker.location.floor,
    section: locker.location.section,
    size: locker.size,
    pricePer4Hours: locker.pricing.base,
    baseDurationMinutes: locker.pricing.baseDuration,
    telNo: locker.location.contactPhone,
    status: locker.status,
    isAvailable: locker.status === LockerStatus.AVAILABLE,
  };
}

export async function getReservationByQRCode(qrCode: string): Promise<LockerReservation | null> {
  const reservationQuery = query(collection(db, RESERVATIONS_COLLECTION), where('qrCode', '==', qrCode));
  const snapshot = await getDocs(reservationQuery);
  const first = snapshot.docs[0];
  return first ? mapReservation(first.id, first.data() as ReservationDoc) : null;
}

export async function openLocker(
  _lockerId: string,
  reservationId: string
): Promise<{ success: boolean; message?: string }> {
  try {
    await updateDoc(doc(db, RESERVATIONS_COLLECTION, reservationId), {
      status: 'active',
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : '사물함을 열 수 없습니다.';
    return { success: false, message };
  }
}
