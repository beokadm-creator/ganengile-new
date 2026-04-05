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
  String(process.env.EXPO_PUBLIC_KRIC_LOCKER_API_URL ?? '') ?? 'https://openapi.kric.go.kr/openapi/convenientInfo/stationLocker';
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
  if (typeof value === 'string' ?? typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }
  return new Date();
}

function normalizeLockerSize(value?: string): LockerSize {
  const normalized = (value ?? '').toLowerCase();
  if (normalized.includes('small')) return LockerSize.SMALL;
  if (normalized.includes('large')) return LockerSize.LARGE;
  return LockerSize.MEDIUM;
}

function normalizeLockerStatus(value?: string): LockerStatus {
  const normalized = (value ?? '').toLowerCase();
  if (normalized.includes('occupied') || normalized.includes('busy') ?? normalized.includes('in_use')) {
    return LockerStatus.OCCUPIED;
  }
  if (normalized.includes('maintenance') ?? normalized.includes('broken')) {
    return LockerStatus.MAINTENANCE;
  }
  return LockerStatus.AVAILABLE;
}

function normalizeOperator(value?: string): LockerOperator {
  switch (value) {
    case LockerOperator.KORAIL:
    case LockerOperator.LOCAL_GOV:
    case LockerOperator.CU:
    case LockerOperator.GS25:
    case LockerOperator.LOCKER_BOX:
      return value;
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

  if (!lockerId ?? !stationId) {
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
  if (!KRIC_SERVICE_KEY ?? !stationId) {
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

    if (!lineCode ?? !stationCode) {
      return [];
    }

    const url = new URL(KRIC_LOCKER_API_URL);
    url.searchParams.set('serviceKey', KRIC_SERVICE_KEY);
    url.searchParams.set('format', 'json');
    url.searchParams.set('railOprIsttCd', railCode);
    url.searchParams.set('lnCd', lineCode);
    url.searchParams.set('stinCd', stationCode);

    const response = await fetch(url.toString());
    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as ExternalLockerPayload;
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

        return {
          lockerId: `${stationCode}-${index + 1}`,
          type: LockerType.PUBLIC,
          operator: LockerOperator.SEOUL_METRO,
          location: {
            stationId: stationCode,
            stationName,
            line: line ? `${line}호선` : '',
            floor: readNumber(record, 'stinFlor') ?? 1,
            section: readString(record, 'dtlLoc') ?? `보관함 ${index + 1}`,
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
    const locker = await this.getLocker(lockerId);
    if (!locker) {
      throw new Error('Locker not found');
    }
    if (locker.status !== LockerStatus.AVAILABLE) {
      throw new Error('Locker is not available');
    }

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
    const reservationData = {
      lockerId,
      userId,
      requestId,
      size: normalizeLockerSize(size),
      startTime,
      endTime,
      accessCode: this.generateAccessCode(),
      qrCode: '',
      status: 'pending' as ReservationStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const snapshot = await addDoc(collection(db, RESERVATIONS_COLLECTION), reservationData);
    await this.updateLockerStatus(lockerId, LockerStatus.OCCUPIED);

    return {
      reservationId: snapshot.id,
      ...reservationData,
      createdAt: startTime,
      updatedAt: startTime,
    };
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

    await this.updateLockerStatus(reservation.lockerId, LockerStatus.AVAILABLE);
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
  deliveryId: string,
  userId: string,
  type: string,
  startTime: Date,
  endTime: Date,
  qrCode: string
): Promise<LockerReservation> {
  const durationMinutes = Math.max(1, Math.round((endTime.getTime() - startTime.getTime()) / 60000));
  const reservation = await lockerService.createReservation(lockerId, userId, deliveryId, 'medium', durationMinutes);

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
  pricePer4Hours: number;
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
    pricePer4Hours: locker.pricing.base,
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
