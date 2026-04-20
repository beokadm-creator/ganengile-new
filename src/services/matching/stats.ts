import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { GillerMatchingStats } from '../../types/matching-extended';
import type {
  FirestoreUserDoc,
  FirestorePendingRequestDoc,
  FilterRequestBase,
} from './types';
import { isMissionBoardManagedRequest, normalizeStation } from './types';
import { snapshotExists } from './internal-helpers';

export async function fetchGillerStats(
  gillerId: string
): Promise<GillerMatchingStats> {
  try {
    const userDoc = await getDoc(doc(db, 'users', gillerId));

    if (!snapshotExists(userDoc)) {
      return {
        gillerId,
        gillerName: 'giller',
        rating: 3.5,
        totalDeliveries: 0,
        completedDeliveries: 0,
        completionRate: 0,
        averageResponseTime: 30,
      };
    }

    const data = userDoc.data() as FirestoreUserDoc;
    const stats = data.stats ?? data.gillerInfo ?? {};
    const ratingValue = 'rating' in stats ? Number(stats.rating ?? data.rating ?? 3.5) : (data.rating ?? 3.5);
    const averageResponseTime =
      'averageResponseTime' in stats ? Number(stats.averageResponseTime ?? 30) : 30;

    const totalDeliveries = stats.totalDeliveries ?? stats.completedDeliveries ?? 0;
    const completedDeliveries = stats.completedDeliveries ?? totalDeliveries;
    const completionRate = totalDeliveries > 0
      ? (completedDeliveries / totalDeliveries) * 100
      : 0;

    return {
      gillerId,
      gillerName: data.name ?? 'giller',
      rating: ratingValue,
      totalDeliveries,
      completedDeliveries,
      completionRate: Math.round(completionRate),
      averageResponseTime,
      professionalLevel: data.professionalLevel ?? 'regular',
      badgeBonus: data.badgeBonus ?? 0,
    };
  } catch (error) {
    console.error('Error fetching giller stats:', error);
    return {
      gillerId,
      gillerName: 'giller',
      rating: 3.5,
      totalDeliveries: 0,
      completedDeliveries: 0,
      completionRate: 0,
      averageResponseTime: 30,
    };
  }
}

export async function getPendingGillerRequests(): Promise<FilterRequestBase[]> {
  try {
    const q = query(
      collection(db, 'requests'),
      where('status', '==', 'pending')
    );

    const snapshot = await getDocs(q);
    const requests: FilterRequestBase[] = [];

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data() as FirestorePendingRequestDoc;

      const fee = data.fee ?? data.feeBreakdown ?? {
        totalFee: 0,
        baseFee: 0,
        distanceFee: 0,
        weightFee: 0,
        sizeFee: 0,
        serviceFee: 0,
        vat: 0,
      };

      const recipientName = data.requesterName ?? data.senderName ?? 'requester';

      if (data.matchedGillerId) {
        return;
      }

      if (isMissionBoardManagedRequest(data)) {
        return;
      }

      requests.push({
        requestId: docSnapshot.id,
        ...data,
        fee,
        recipientName,
        pickupStation: normalizeStation(data.pickupStation) ?? data.pickupStation,
        deliveryStation: normalizeStation(data.deliveryStation) ?? data.deliveryStation,
      });
    });

    return requests;
  } catch (error) {
    console.error('Error fetching pending giller requests:', error);
    return [];
  }
}
