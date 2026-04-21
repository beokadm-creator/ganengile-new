// Web platform implementation with full KRIC fetch support
export * from './locker-service';

// Force inclusion of fetch-based functions by providing web implementation
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
  LockerType,
  LockerOperator,
  LockerSize,
  LockerStatus,
} from '../types/locker';

// KRIC API configuration
const KRIC_API_BASE_URL = 'https://kric.kr/kric.org/kricketapi';

type LockerDoc = Partial<Locker> & {
  status?: string;
  operator?: string;
  stationId?: string;
  stationName?: string;
  line?: string;
  floor?: number | string;
  section?: string;
  latitude?: number | string;
  longitude?: number | string;
  address?: string;
  telNo?: string;
  nearby?: boolean;
  lockerNumber?: string;
  basePrice?: number | string;
  baseDuration?: number | string;
  extensionPrice?: number | string;
  maxDuration?: number | string;
  total?: number | string;
  occupied?: number | string;
  available?: number | string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function readString(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function readNumber(record: Record<string, unknown>, ...keys: string[]): number | undefined {
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

function normalizeOperator(raw: string | undefined): LockerOperator {
  if (!raw) return LockerOperator.SEOUL_METRO;
  const lower = raw.toLowerCase();
  if (lower.includes('korail') || lower.includes('코레일')) return LockerOperator.KORAIL;
  if (lower.includes('seoul') || lower.includes('서울')) return LockerOperator.SEOUL_METRO;
  return raw as LockerOperator;
}

function normalizeLockerStatus(raw: string | undefined): LockerStatus {
  switch (raw) {
    case 'occupied': return LockerStatus.OCCUPIED;
    case 'maintenance': return LockerStatus.MAINTENANCE;
    default: return LockerStatus.AVAILABLE;
  }
}

function normalizeLockerSize(raw: string | undefined): LockerSize {
  switch (raw) {
    case 'small': return LockerSize.SMALL;
    case 'large': return LockerSize.LARGE;
    default: return LockerSize.MEDIUM;
  }
}

function mapFirestoreLocker(lockerId: string, raw: LockerDoc): Locker {
  const rawRecord = asRecord(raw);
  const location = raw.location;
  const pricing = raw.pricing;
  const availability = raw.availability;
  const locationRecord = asRecord(location);
  const pricingRecord = asRecord(pricing);
  const availabilityRecord = asRecord(availability);
  const status = typeof raw.status === 'string' ? normalizeLockerStatus(raw.status) : raw.status ?? LockerStatus.AVAILABLE;

  return {
    lockerId,
    type: raw.type ?? LockerType.PUBLIC,
    operator: normalizeOperator(typeof raw.operator === 'string' ? raw.operator : undefined),
    location: {
      stationId: readString(locationRecord, 'stationId') ?? readString(rawRecord, 'stationId') ?? '',
      stationName: readString(locationRecord, 'stationName') ?? readString(rawRecord, 'stationName') ?? '',
      line: readString(locationRecord, 'line') ?? readString(rawRecord, 'line') ?? '',
      floor: readNumber(locationRecord, 'floor') ?? readNumber(rawRecord, 'floor') ?? 1,
      section:
        readString(locationRecord, 'section') ??
        readString(rawRecord, 'section', 'lockerNumber') ??
        lockerId,
      latitude: readNumber(locationRecord, 'latitude', 'lat') ?? readNumber(rawRecord, 'latitude', 'lat'),
      longitude: readNumber(locationRecord, 'longitude', 'lng') ?? readNumber(rawRecord, 'longitude', 'lng'),
      address: readString(locationRecord, 'address') ?? readString(rawRecord, 'address'),
      contactPhone:
        readString(locationRecord, 'contactPhone', 'telNo') ?? readString(rawRecord, 'contactPhone', 'telNo'),
      nearby: location?.nearby ?? raw.nearby ?? false,
    },
    size: raw.size ?? LockerSize.MEDIUM,
    pricing: {
      base: readNumber(pricingRecord, 'base', 'basePrice', 'utlFare') ?? readNumber(rawRecord, 'base', 'basePrice', 'utlFare') ?? 0,
      baseDuration: readNumber(pricingRecord, 'baseDuration') ?? readNumber(rawRecord, 'baseDuration') ?? 240,
      extension: readNumber(pricingRecord, 'extension', 'extensionPrice') ?? readNumber(rawRecord, 'extension', 'extensionPrice') ?? 0,
      maxDuration: readNumber(pricingRecord, 'maxDuration') ?? readNumber(rawRecord, 'maxDuration'),
    },
    availability: {
      total: readNumber(availabilityRecord, 'total') ?? readNumber(rawRecord, 'total') ?? 1,
      occupied: readNumber(availabilityRecord, 'occupied') ?? readNumber(rawRecord, 'occupied') ?? (status === LockerStatus.OCCUPIED ? 1 : 0),
      available: readNumber(availabilityRecord, 'available') ?? readNumber(rawRecord, 'available') ?? (status === LockerStatus.AVAILABLE ? 1 : 0),
    },
    status,
    qrCode: raw.qrCode ?? '',
    accessMethod: raw.accessMethod ?? 'qr',
    isSubway: raw.isSubway ?? true,
  };
}

/**
 * Fetches all lockers from Firestore.
 * This is a web-specific implementation that forces Metro bundler to include this function.
 */
export async function getAllLockers(): Promise<Locker[]> {
  try {
    const lockersRef = collection(db, 'lockers');
    const snapshot = await getDocs(lockersRef);

    if (snapshot.empty) {
      console.log('[locker-service.web] No lockers found in Firestore');
      return [];
    }

    const lockers = snapshot.docs.map((docSnap) =>
      mapFirestoreLocker(docSnap.id, docSnap.data() as LockerDoc)
    );

    console.log(`[locker-service.web] Fetched ${lockers.length} lockers from Firestore`);
    return lockers;
  } catch (error) {
    console.error('[locker-service.web] Error fetching lockers:', error);
    throw new Error('Failed to fetch lockers');
  }
}

/**
 * Fetches locker information from KRIC API for multiple stations.
 * @param stationIds - Array of station IDs to fetch lockers for
 * @returns Promise<Record<string, any>> - Object mapping station IDs to their locker data
 */
export async function fetchKricLockersForStations(stationIds: string[]): Promise<Record<string, any>> {
  if (!Array.isArray(stationIds)) {
    console.error('[locker-service.web] stationIds must be an array');
    throw new Error('stationIds must be an array');
  }

  if (stationIds.length === 0) {
    console.log('[locker-service.web] No station IDs provided');
    return {};
  }

  console.log(`[locker-service.web] Fetching KRIC lockers for ${stationIds.length} stations`);

  const results: Record<string, any> = {};
  const errors: Record<string, string> = {};

  // Fetch data for each station
  await Promise.all(
    stationIds.map(async (stationId) => {
      try {
        const url = `${KRIC_API_BASE_URL}/station/${stationId}/lockers`;
        console.log(`[locker-service.web] Fetching from KRIC: ${url}`);

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Validate response structure
        if (data && typeof data === 'object') {
          results[stationId] = data;
          console.log(`[locker-service.web] Successfully fetched lockers for station ${stationId}`);
        } else {
          throw new Error('Invalid response structure from KRIC API');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[locker-service.web] Error fetching lockers for station ${stationId}:`, errorMessage);
        errors[stationId] = errorMessage;
      }
    })
  );

  // Log summary
  const successCount = Object.keys(results).length;
  const errorCount = Object.keys(errors).length;
  console.log(`[locker-service.web] KRIC fetch complete: ${successCount} successful, ${errorCount} failed`);

  if (errorCount > 0) {
    console.warn('[locker-service.web] Stations with errors:', errors);
  }

  return results;
}

export async function getLockerById(lockerId: string): Promise<Locker | null> {
  try {
    const lockerRef = doc(db, 'lockers', lockerId);
    const snapshot = await getDoc(lockerRef);

    if (!snapshot.exists()) {
      return null;
    }

    return mapFirestoreLocker(snapshot.id, snapshot.data() as LockerDoc);
  } catch (error) {
    console.error('[locker-service.web] Error fetching locker:', error);
    throw new Error('Failed to fetch locker');
  }
}

export async function getLockersByStation(stationId: string): Promise<Locker[]> {
  try {
    const lockersRef = collection(db, 'lockers');
    const [topLevelSnapshot, nestedSnapshot] = await Promise.all([
      getDocs(query(lockersRef, where('stationId', '==', stationId))),
      getDocs(query(lockersRef, where('location.stationId', '==', stationId))),
    ]);

    const merged = new Map<string, Locker>();

    topLevelSnapshot.docs.forEach((docSnap) => {
      merged.set(docSnap.id, mapFirestoreLocker(docSnap.id, docSnap.data() as LockerDoc));
    });

    nestedSnapshot.docs.forEach((docSnap) => {
      merged.set(docSnap.id, mapFirestoreLocker(docSnap.id, docSnap.data() as LockerDoc));
    });

    return Array.from(merged.values());
  } catch (error) {
    console.error('[locker-service.web] Error fetching station lockers:', error);
    throw new Error('Failed to fetch station lockers');
  }
}

/**
 * Updates a locker's status.
 * @param lockerId - The locker ID
 * @param status - The new status
 * @returns Promise<void>
 */
export async function updateLockerStatus(lockerId: string, status: LockerStatus): Promise<void> {
  try {
    const lockerRef = doc(db, 'lockers', lockerId);
    await updateDoc(lockerRef, {
      status,
      updatedAt: serverTimestamp(),
    });
    console.log(`[locker-service.web] Updated locker ${lockerId} status to ${status}`);
  } catch (error) {
    console.error('[locker-service.web] Error updating locker status:', error);
    throw new Error('Failed to update locker status');
  }
}

/**
 * Creates a new reservation for a locker.
 * @param lockerId - The locker ID
 * @param reservationData - The reservation data
 * @returns Promise<string> - The reservation ID
 */
export async function createLockerReservation(
  lockerId: string,
  reservationData: {
    userId: string;
    startTime: Date;
    endTime: Date;
  }
): Promise<string> {
  try {
    // Create reservation
    const reservationRef = await addDoc(collection(db, 'reservations'), {
      lockerId,
      userId: reservationData.userId,
      startTime: Timestamp.fromDate(reservationData.startTime),
      endTime: Timestamp.fromDate(reservationData.endTime),
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Update locker with current reservation
    const lockerRef = doc(db, 'lockers', lockerId);
    await updateDoc(lockerRef, {
      status: 'reserved',
      currentReservationId: reservationRef.id,
      updatedAt: serverTimestamp(),
    });

    console.log(`[locker-service.web] Created reservation ${reservationRef.id} for locker ${lockerId}`);
    return reservationRef.id;
  } catch (error) {
    console.error('[locker-service.web] Error creating reservation:', error);
    throw new Error('Failed to create reservation');
  }
}
