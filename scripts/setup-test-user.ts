/**
 * Get User UID from Firebase Auth
 * Firebase Auth에서 사용자 UID 조회
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

const auth = admin.auth();

async function getUserByEmail() {
  const email = 'test@ganengile.com';

  try {

    // Auth에서 사용자 조회
    const userRecord = await auth.getUserByEmail(email);

    console.log('✅ User found in Firebase Auth!');
    console.log('UID:', userRecord.uid);
    console.log('Email:', userRecord.email);
    console.log('Display Name:', userRecord.displayName || '(none)');
    console.log('Email Verified:', userRecord.emailVerified);

    return userRecord.uid;

  } catch (error: any) {
    console.error('❌ Error getting user:', error.message);

    if (error.code === 'auth/user-not-found') {
      console.log('⚠️ User does not exist in Firebase Auth');
      console.log('Creating user...');

      // 사용자 생성
      const userRecord = await auth.createUser({
        email: email,
        emailVerified: false,
        password: 'test123456',
        displayName: '테스트 사용자',
        disabled: false,
      });

      console.log('✅ User created!');
      console.log('UID:', userRecord.uid);

      return userRecord.uid;
    }

    throw error;
  }
}

async function createFirestoreUser(uid: string) {
  const db = admin.firestore();

  const userDoc = {
    uid: uid,
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
  await db.collection('users').doc(uid).set(userDoc);

  console.log('✅ User document created in Firestore!');
}

// 실행
(async () => {
  try {
    const uid = await getUserByEmail();
    await createFirestoreUser(uid);

    console.log('\n✨ Test user setup complete!');
    console.log('UID:', uid);
    console.log('You can now login with test@ganengile.com / test123456');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
})();
