import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const onRatingCreated = functions.firestore
  .document('ratings/{ratingId}')
  .onCreate(async (snapshot, context) => {
    const ratingData = snapshot.data();
    if (!ratingData) return null;

    const { toUserId } = ratingData;

    try {
      const db = admin.firestore();
      
      // 1. 해당 유저의 모든 별점을 가져와서 평균을 다시 계산합니다.
      const ratingsSnapshot = await db.collection('ratings')
        .where('toUserId', '==', toUserId)
        .get();

      if (ratingsSnapshot.empty) return null;

      let totalRating = 0;
      let totalCount = 0;
      const distribution: { [key: string]: number } = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
      const tagStats: { [key: string]: number } = {
        'FRIENDLY': 0, 'FAST': 0, 'TRUSTWORTHY': 0, 'COMMUNICATIVE': 0, 'PUNCTUAL': 0
      };

      let recentRatings = 0;
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      ratingsSnapshot.forEach((doc) => {
        const data = doc.data();
        const r = data.rating || 0;
        
        if (r >= 1 && r <= 5) {
          totalRating += r;
          totalCount++;
          distribution[r.toString()]++;
        }

        const tags = data.tags || [];
        tags.forEach((tag: string) => {
          if (tagStats[tag] !== undefined) {
            tagStats[tag]++;
          }
        });

        const createdAt = data.createdAt?.toDate();
        if (createdAt && createdAt > thirtyDaysAgo) {
          recentRatings++;
        }
      });

      const averageRating = totalCount > 0 ? Number((totalRating / totalCount).toFixed(1)) : 0;

      // 2. 유저 문서를 업데이트합니다. (Admin SDK이므로 보안 규칙 우회 가능)
      const userRef = db.collection('users').doc(toUserId);
      await userRef.update({
        rating: averageRating,
        totalRatings: totalCount,
        ratingStats: {
          distribution,
          tagStats,
          recentRatings,
        },
        ratingUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✅ User ${toUserId} rating updated to ${averageRating} (${totalCount} ratings)`);

    } catch (error) {
      console.error(`❌ Error updating rating for user ${toUserId}:`, error);
    }

    return null;
  });