/**
 * Create Test User in Firestore
 * 테스트 사용자 생성 스크립트
 */

import admin from 'firebase-admin';
import * as fs from 'fs';

// Service Account Key 경로
const serviceAccountPath = '/Users/aaron/Downloads/ganengile-firebase-adminsdk-fbsvc-4436800611.json';

// Load service account
const serviceAccount = JSON.parse(
  fs.readFileSync(serviceAccountPath, 'utf-8')
);

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});

const db = admin.firestore();

async function createTestUser() {
  try {
    // test@ganengile.com의 UID (Firebase Auth에서 자동 생성)
    // 이 UID는 Firebase Console의 Authentication 탭에서 확인 가능
    // 일반적으로 Auth로 생성된 사용자의 UID를 사용해야 함

    // 임시 UID - 실제 Auth UID로 교체 필요
    const testUid = 'test-user-ganengile-com';

    const userDoc = {
      uid: testUid,
      email: 'test@ganengile.com',
      name: '테스트 사용자',
      phoneNumber: '01012345678',

      // 역할 (길러 + 이용자 모두)
      role: 'both',

      // 약관 동의
      agreedTerms: {
        giller: true,
        gller: true,
        privacy: true,
        marketing: false,
      },

      // 기본 설정
      rating: 5.0,
      totalRatings: 0,
      isActive: true,
      isVerified: true,

      // 길러 정보
      gillerInfo: {
        totalDeliveries: 0,
        totalEarnings: 0,
        equipment: {
          hasInsulatedBag: false,
          hasHeatedBag: false,
          vehicleType: 'walk',
        },
      },

      // 이용자 정보
      gllerInfo: {
        totalRequests: 0,
        successfulDeliveries: 0,
      },

      // 타임스탬프
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Firestore에 사용자 생성
    await db.collection('users').doc(testUid).set(userDoc);

    console.warn('✅ Test user created successfully!');
    console.warn('UID:', testUid);
    console.warn('Email:', userDoc.email);
    console.warn('Name:', userDoc.name);
    console.warn('Role:', userDoc.role);

    // 생성된 사용자 확인
    const doc = await db.collection('users').doc(testUid).get();
    if (doc.exists) {
      console.warn('✅ User document verified in Firestore');
    }

  } catch (error) {
    console.error('❌ Error creating test user:', error);
    process.exit(1);
  }
}

// 실행
void createTestUser().then(() => {
  console.warn('\n✨ Done!');
  process.exit(0);
});
