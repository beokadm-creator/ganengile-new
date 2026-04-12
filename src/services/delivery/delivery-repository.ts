import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { DeliveryDoc } from '../../types/delivery';

export const deliveryRepository = {
  async getDeliveryById(deliveryId: string): Promise<DeliveryDoc | null> {
    const docRef = doc(db, 'deliveries', deliveryId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as DeliveryDoc;
  },

  async getDeliveryByRequestId(requestId: string): Promise<DeliveryDoc | null> {
    const q = query(
      collection(db, 'deliveries'),
      where('requestId', '==', requestId),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const docSnap = snap.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as DeliveryDoc;
  },

  async getGillerDeliveries(gillerId: string): Promise<DeliveryDoc[]> {
    const q = query(
      collection(db, 'deliveries'),
      where('gillerId', '==', gillerId),
      where('status', 'in', ['accepted', 'picked_up', 'in_transit', 'arrived', 'at_locker'])
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DeliveryDoc));
  },

  async getRequesterDeliveries(requesterId: string): Promise<DeliveryDoc[]> {
    const q = query(
      collection(db, 'deliveries'),
      where('requesterId', '==', requesterId),
      where('status', 'in', ['accepted', 'picked_up', 'in_transit', 'arrived', 'at_locker'])
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DeliveryDoc));
  },

  subscribeToDeliveryByRequestId(
    requestId: string,
    onData: (delivery: DeliveryDoc | null) => void,
    onError?: (error: Error) => void
  ): () => void {
    const q = query(
      collection(db, 'deliveries'),
      where('requestId', '==', requestId),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    return onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          onData(null);
        } else {
          const docSnap = snap.docs[0];
          onData({ id: docSnap.id, ...docSnap.data() } as DeliveryDoc);
        }
      },
      (error) => {
        if (onError) onError(error);
      }
    );
  },
};
