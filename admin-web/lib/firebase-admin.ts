import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const apps = getApps();

// 로컬 빌드 환경(Vercel 빌드 타임 등)에서 에러가 발생하지 않도록 더미 데이터를 사용하거나 초기화를 지연합니다.
const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ganengile-dummy';
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || 'dummy@ganengile.iam.gserviceaccount.com';

// 빌드 시점에 firebase-admin 초기화를 방지합니다. (앱 호스팅/로컬 환경에서는 정상 작동)
const isBuild = process.env.npm_lifecycle_event === 'build';

export const app = !apps.length && !isBuild
  ? initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || 'ganengile-dummy',
    })
  : apps[0];

export const getAdminApp = () => app;
export const db = isBuild ? ({} as any) : getFirestore(app);
export const auth = isBuild ? ({} as any) : getAuth(app);
