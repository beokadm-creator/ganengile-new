/**
 * Consent Templates Seeding Script
 *
 * Firestore `consentTemplates` 컬렉션에 한국 법령 기반 9개 동의 항목을 초기 시드한다.
 * 관리자에서 약관을 생성하기 전에 실행하거나, 초기 배포 시 사용한다.
 *
 * Usage:
 *   npx ts-node scripts/seed-consent-templates.ts
 *   or
 *   npm run seed:consents
 *
 * Options:
 *   --force  : 기존 문서가 있어도 덮어쓰기
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, writeBatch, collection } from 'firebase/firestore';

import 'dotenv/config';

// Firebase initialization
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ─── 시드 데이터 ──────────────────────────────────────────────

interface SeedTemplate {
  id: string;
  key: string;
  title: string;
  description: string;
  content: string;
  version: string;
  category: 'required' | 'optional';
  sortOrder: number;
  effectiveDate: string;
}

const SEED_TEMPLATES: SeedTemplate[] = [
  // ─── 필수 동의 (6개) ───────────────────────────────────
  {
    id: 'service_terms',
    key: 'service_terms',
    title: '서비스 이용약관 동의',
    description: '가넹길 서비스 이용에 관한 기본 약관입니다.',
    content: `제1조 (목적)
본 약관은 "가넹길"(이하 "회사")이 제공하는 배달 매칭 서비스(이하 "서비스")의 이용조건 및 절차, 회사와 이용자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.

제2조 (정의)
1. "서비스"란 회사가 제공하는 배달 매칭 플랫폼을 말합니다.
2. "이용자"란 본 약관에 따라 회사가 제공하는 서비스를 받는 회원을 말합니다.
3. "회원"이란 회사에 개인정보를 제공하여 회원등록을 한 자를 말합니다.

제3조 (약관의 효력 및 변경)
1. 본 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력이 발생합니다.
2. 회사는 관계법령을 위배하지 않는 범위 내에서 본 약관을 개정할 수 있습니다.

제4조 (서비스의 제공)
1. 회사는 이용자에게 배달 요청 및 매칭 서비스를 제공합니다.
2. 회사는 서비스의 종류와 내용을 변경할 수 있으며, 변경 사항은 사전에 공지합니다.

제5조 (이용자의 의무)
1. 이용자는 본 약관에서 규정하는 사항을 준수하여야 합니다.
2. 이용자는 타인의 정보를 도용하거나 허위 정보를 제공하여서는 안 됩니다.

제6조 (책임의 한계)
1. 회사는 천재지변, 시스템 장애 등 불가항력적 사유로 인한 서비스 중단에 대하여 책임을 지지 않습니다.
2. 회사는 이용자 간 또는 이용자와 제3자 간에 발생한 분쟁에 대하여 개입할 의무가 없습니다.`,
    version: '1.0.0',
    category: 'required',
    sortOrder: 0,
    effectiveDate: '2026-04-01',
  },
  {
    id: 'privacy_collection',
    key: 'privacy_collection',
    title: '개인정보 수집 및 이용 동의',
    description: '주문, 정산, 본인 확인에 필요한 개인정보 처리에 대한 안내입니다.',
    content: `가넹길 개인정보 수집·이용 동의서

[개인정보보호법 제15조 및 제22조에 따른 안내]

1. 수집·이용 목적
- 회원 가입 및 본인 확인
- 배달 서비스 제공 및 관리
- 요금 정산 및 결제 처리
- 민원 처리 및 고객 지원

2. 수집하는 개인정보 항목
- 필수항목: 성명, 이메일, 휴대전화번호, 프로필 정보
- 서비스 이용 시 자동 수집: IP주소, 서비스 이용기록

3. 보유 및 이용기간
- 회원 탈퇴 시까지 (단, 관계법령에 따라 보존이 필요한 경우 제외)
- 결제 및 정산 기록: 5년 (전자상거래법 제6조)
- 서비스 이용 기록: 1년

4. 동의를 거부할 권리
개인정보의 수집·이용에 대한 동의를 거부할 권리가 있습니다.
다만, 필수 항목에 대한 동의를 거부하는 경우 서비스 이용이 제한됩니다.`,
    version: '1.0.0',
    category: 'required',
    sortOrder: 1,
    effectiveDate: '2026-04-01',
  },
  {
    id: 'privacy_policy',
    key: 'privacy_policy',
    title: '개인정보처리방침 동의',
    description: '개인정보의 처리 방침 및 보호 조치에 대한 안내입니다.',
    content: `가넹길 개인정보처리방침

[개인정보보호법 제30조에 따른 안내]

1. 개인정보의 처리 목적
회사는 다음의 목적을 위하여 개인정보를 처리합니다.
- 회원 관리: 회원제 서비스 제공, 본인확인, 부정이용 방지
- 서비스 제공: 배달 매칭, 경로 안내, 실시간 위치 추적
- 결제 및 정산: 요금 결제, 정산 처리, 세금 계산서 발급
- 고객 지원: 민원 처리, 서비스 개선

2. 개인정보의 보유 및 이용기간
- 회원정보: 회원 탈퇴 시까지
- 거래정보: 5년 (전자상거래법)
- 접속기록: 6개월 (통신비밀보호법)

3. 개인정보의 파기절차 및 방법
- 파기절차: 보유기간 경과 후 지체 없이 파기
- 파기방법: 전자적 파일은 복구 불가능한 방법으로 삭제

4. 개인정보의 안전성 확보조치
- 개인정보의 암호화
- 해킹 등에 대비한 기술적 대책
- 접근 통제 및 권한 관리

5. 정보주체의 권리·의무
- 개인정보 열람, 정정, 삭제, 처리정지 요구권
- 개인정보 보호책임자: 가넹길 고객지원팀`,
    version: '1.0.0',
    category: 'required',
    sortOrder: 2,
    effectiveDate: '2026-04-01',
  },
  {
    id: 'third_party_sharing',
    key: 'third_party_sharing',
    title: '제3자 정보제공 동의',
    description: '배송 파트너, 결제 PG 등에 대한 정보 제공 안내입니다.',
    content: `가넹길 제3자 정보제공 동의서

[개인정보보호법 제17조에 따른 안내]

1. 정보제공 대상
- 배달 길러(매칭된 배송 담당자)
- 결제 대행사(PG사)
- 배송 경로상 필요 시 운송사

2. 제공하는 개인정보 항목
- 배달 길러에게: 배달 주소, 연락처(발신번호)
- 결제 대행사에게: 결제 정보, 거래 내역
- 운송사에게: 배송 주소, 연락처

3. 정보제공 목적
- 배달 서비스 원활한 수행
- 결제 및 정산 처리
- 배송 상태 안내

4. 보유 및 이용기간
- 제공받는 자의 개인정보 이용목적 달성 시까지
- 단, 관계법령에 따라 보존이 필요한 경우 해당 기간까지

5. 동의를 거부할 권리
제3자 정보제공에 대한 동의를 거부할 권리가 있습니다.
다만, 본 동의를 거부하는 경우 배달 서비스 이용이 불가합니다.`,
    version: '1.0.0',
    category: 'required',
    sortOrder: 3,
    effectiveDate: '2026-04-01',
  },
  {
    id: 'location_terms',
    key: 'location_terms',
    title: '위치정보 서비스 이용약관 동의',
    description: '배달 경로 및 매칭에 위치 정보 사용에 대한 안내입니다.',
    content: `가넹길 위치정보 서비스 이용약관

[위치정보의 보호 및 이용 등에 관한 법률 제6조에 따른 안내]

1. 위치정보의 수집 방법
- 모바일 기기의 GPS, Wi-Fi, 기지국 정보를 통한 수집
- 사용자가 직접 입력한 주소 정보

2. 위치정보의 이용 목적
- 배달 매칭을 위한 거리 및 소요시간 계산
- 배달 경로 안내 및 실시간 추적
- 배송 완료 확인
- 서비스 개선을 위한 통계 분석

3. 위치정보의 보유 및 이용기간
- 실시간 위치: 서비스 이용 중에만 활용 (저장하지 않음)
- 주소 정보: 회원 탈퇴 시까지
- 통계 데이터: 개인 식별 불가 상태로 1년간 보관

4. 위치정보의 제3자 제공
- 매칭된 배달 길러에게 배송 목적지 정보만 제공
- 실시간 위치는 배달 진행 중에만 공유

5. 위치정보 관리의 권리
- 언제든지 위치정보 수집을 중단할 수 있습니다.
- 위치정보 수집 중단 시 일부 서비스 이용이 제한될 수 있습니다.`,
    version: '1.0.0',
    category: 'required',
    sortOrder: 4,
    effectiveDate: '2026-04-01',
  },
  {
    id: 'age_confirmation',
    key: 'age_confirmation',
    title: '만 14세 이상 확인',
    description: '만 14세 미만은 법정대리인 동의가 필요합니다.',
    content: `만 14세 이상 확인

[정보통신망 이용촉진 및 정보보호 등에 관한 법률 제44조의5에 따른 안내]

1. 만 14세 미만 아동의 개인정보 처리
- 만 14세 미만 아동의 경우 법정대리인(부모 등)의 동의가 필요합니다.
- 법정대리인의 동의 없이 수집된 만 14세 미만 아동의 개인정보는 즉시 파기됩니다.

2. 확인 방법
- 본 서비스에 가입함으로써 본인이 만 14세 이상임을 확인합니다.
- 회사는 필요한 경우 본인 확인 절차를 요청할 수 있습니다.

3. 법정대리인 동의 (만 14세 미만인 경우)
- 법정대리인의 성명, 연락처, 아동과의 관계
- 법정대리인의 서명(전자서명 포함)

※ 본인은 만 14세 이상임을 확인합니다.`,
    version: '1.0.0',
    category: 'required',
    sortOrder: 5,
    effectiveDate: '2026-04-01',
  },

  // ─── 선택 동의 (3개) ───────────────────────────────────
  {
    id: 'marketing',
    key: 'marketing',
    title: '마케팅 정보 수신 동의',
    description: '이벤트와 혜택 소식을 받습니다.',
    content: `마케팅 정보 수신 동의

[정보통신망 이용촉진 및 정보보호 등에 관한 법률 제50조에 따른 안내]

1. 수신 정보의 내용
- 이벤트 및 프로모션 안내
- 할인 쿠폰 및 혜택 정보
- 신규 서비스 안내

2. 수신 방법
- 푸시 알림
- 이메일
- SMS (문자메시지)

3. 동의를 거부할 권리
- 본 동의는 선택 사항이며, 동의를 거부하더라도 서비스 이용에 제한이 없습니다.
- 언제든지 설정에서 수신 동의를 철회할 수 있습니다.`,
    version: '1.0.0',
    category: 'optional',
    sortOrder: 6,
    effectiveDate: '2026-04-01',
  },
  {
    id: 'advertising',
    key: 'advertising',
    title: '광고성 정보 수신 동의',
    description: '광고성 알림을 수신합니다.',
    content: `광고성 정보 수신 동의

[정보통신망 이용촉진 및 정보보호 등에 관한 법률 제50조에 따른 안내]

1. 수신 정보의 내용
- 파트너사 프로모션 및 광고
- 서비스 관련 추천 정보
- 혜택 안내

2. 수신 방법
- 푸시 알림
- 이메일

3. 동의를 거부할 권리
- 본 동의는 선택 사항이며, 동의를 거부하더라도 서비스 이용에 제한이 없습니다.
- 언제든지 설정에서 수신 동의를 철회할 수 있습니다.`,
    version: '1.0.0',
    category: 'optional',
    sortOrder: 7,
    effectiveDate: '2026-04-01',
  },
  {
    id: 'nighttime_ads',
    key: 'nighttime_ads',
    title: '야간 광고성 정보 수신 동의',
    description: '21:00~08:00 광고성 알림을 수신합니다.',
    content: `야간 광고성 정보 수신 동의

[정보통신망 이용촉진 및 정보보호 등에 관한 법률 제50조의2에 따른 안내]

1. 야간 광고성 정보 안내
- 야간(21:00~08:00)에 광고성 정보를 수신합니다.
- 긴급 서비스 알림은 제외됩니다.

2. 수신 정보의 내용
- 야간 한정 프로모션
- 이벤트 리마인더
- 혜택 만료 알림

3. 동의를 거부할 권리
- 본 동의는 선택 사항이며, 동의를 거부하더라도 서비스 이용에 제한이 없습니다.
- 일반 광고성 정보 수신 동의가 있어야 본 동의가 유효합니다.
- 언제든지 설정에서 수신 동의를 철회할 수 있습니다.`,
    version: '1.0.0',
    category: 'optional',
    sortOrder: 8,
    effectiveDate: '2026-04-01',
  },
];

// ─── 메인 실행 ────────────────────────────────────────────────

async function main(): Promise<void> {
  const forceMode = process.argv.includes('--force');

  console.log(`\n📋 Consent Templates Seeding`);
  console.log(`   Mode: ${forceMode ? 'FORCE (overwrite)' : 'SKIP existing'}`);
  console.log(`   Templates: ${SEED_TEMPLATES.length} items\n`);

  // Check existing docs first (non-force mode)
  if (!forceMode) {
    let skipCount = 0;
    for (const template of SEED_TEMPLATES) {
      const existing = await getDoc(doc(db, 'consentTemplates', template.id));
      if (existing.exists()) {
        console.log(`   ⏭️  ${template.id} — already exists, skipping`);
        skipCount++;
      }
    }
    if (skipCount === SEED_TEMPLATES.length) {
      console.log('\n✅ All templates already exist. Use --force to overwrite.\n');
      return;
    }
  }

  // Seed all templates
  const batch = writeBatch(db);

  for (const template of SEED_TEMPLATES) {
    const docRef = doc(db, 'consentTemplates', template.id);
    const now = new Date();

    batch.set(docRef, {
      id: template.id,
      key: template.key,
      title: template.title,
      description: template.description,
      content: template.content,
      version: template.version,
      category: template.category,
      sortOrder: template.sortOrder,
      effectiveDate: template.effectiveDate,
      createdAt: now,
      updatedAt: now,
    }, { merge: !forceMode });

    console.log(`   ✅ ${template.id} — v${template.version} (${template.category})`);
  }

  await batch.commit();

  console.log(`\n✅ Seeded ${SEED_TEMPLATES.length} consent templates successfully.\n`);
}

main().catch((error: unknown) => {
  console.error('\n❌ Seeding failed:', error);
  process.exit(1);
});
