import * as admin from 'firebase-admin';

/**
 * Cleans up 'pending_allocation' and 'pending' locker reservations that have been stuck for over 2 hours.
 * Sets their status to 'cancelled'.
 */
export async function lockerCleanupScheduler(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const db = admin.firestore();
    const reservationsRef = db.collection('locker_reservations');

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const pendingAllocQuery = reservationsRef
      .where('status', 'in', ['pending_allocation', 'pending'])
      .where('createdAt', '<', admin.firestore.Timestamp.fromDate(twoHoursAgo));

    const snapshot = await pendingAllocQuery.get();

    if (snapshot.empty) {
      return { success: true, count: 0 };
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        status: 'cancelled',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();

    console.warn(`[Locker Cleanup] Cancelled ${snapshot.size} stale locker reservations.`);
    return { success: true, count: snapshot.size };
  } catch (error) {
    console.error('Error during locker cleanup:', error);
    return { success: false, count: 0, error: error instanceof Error ? error.message : String(error) };
  }
}
