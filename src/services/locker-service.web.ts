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
};

function normalizeOperator(raw: string | undefined): LockerOperator {
  if (!raw) return LockerOperator.SEOLL_METRO;
  const lower = raw.toLowerCase();
  if (lower.includes('korail') || lower.includes('코레일')) return LockerOperator.KORAIL;
  if (lower.includes('seoul') || lower.includes('서울')) return LockerOperator.SEOLL_METRO;
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
  const location = raw.location;
  const pricing = raw.pricing;
  const availability = raw.availability;
  const status = typeof raw.status === 'string' ? normalizeLockerStatus(raw.status) : raw.status ?? LockerStatus.AVAILABLE;

  return {
    lockerId,
    type: raw.type ?? LockerType.PUBLIC,
    operator: normalizeOperator(typeof raw.operator === 'string' ? raw.operator : undefined),
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
    availability: {
      total: availability?.total ?? 1,
      occupied: availability?.occupied ?? (status === LockerStatus.OCCUPIED ? 1 : 0),
      available: availability?.available ?? (status === LockerStatus.AVAILABLE ? 1 : 0),
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
    const q = query(lockersRef, where('stationId', '==', stationId));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) =>
      mapFirestoreLocker(docSnap.id, docSnap.data() as LockerDoc)
    );
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
