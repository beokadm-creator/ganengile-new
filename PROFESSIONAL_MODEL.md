# 가는길에 - 전문 퀵 서비스 및 운송사업자 모델

## 개요

기존 모델의 "길러"는 **비전문 개인**(출퇴근길 부수입)이지만, **전문 배송 전문가** 계층을 추가하여 시장을 양분화합니다.

---

## 배송 참여자 4가지 유형 (확장)

### 1. 길러 (Giller) - 개인 파트타임
```typescript
{
  role: 'giller';
  userType: 'individual';
  status: 'part_time';  // NEW

  // 특징
  - 출퇴근길에만 배송 (비전문)
  - 소액 부수성 목적
  - 평점 관리
  - 신고 대상: 분실/파손 시 개인 책임
}
```

### 2. 전문 길러 (Pro Giller) - 개인 전업 ★ NEW
```typescript
{
  role: 'pro_giller';
  userType: 'individual';
  status: 'full_time';  // NEW

  // 특징
  - 전업 배송 전문가 (퀵 라이더)
  - 하루 8시간+ 배송
  - 전문 장비 보유 (박스, 온열가방, 냉장박스 등)
  - 프로필: 사진, 경력, 특기 (식품/전자기기/귀중품)
  - 라이선스: 운전면허, 자격증 (선택)

  // 전문 장비
  equipment: {
    hasInsulatedBag: boolean;      // 보냉백
    hasHeatedBag: boolean;         // 온열가방
    hasSecureBox: boolean;         // 보관 박스
    hasSmartLock: boolean;         // 스마트 잠금
    vehicleType: 'walk' | 'bike' | 'motorcycle' | 'car';
  };

  // 인증 상태
  verification: {
    isVerified: boolean;           // 신원 확인
    hasInsurance: boolean;         // 배송 보험 가입
    trainingCompleted: boolean;    // 배송 교육 이수
    backgroundCheckPassed: boolean; // 범죄 경력 조회
  };

  // 수익
  earnings: {
    totalEarnings: number;
    completedDeliveries: number;
    averageRating: number;
    responseTime: number;          // 평균 응답 시간 (분)
    cancellationRate: number;      // 취소율
  };

  // 프리미엄 기능
  premiumFeatures: {
    priorityMatching: boolean;     // 우선 매칭
    higherRatePerKm: number;       // km당 더 높은 수수료
    multiDropEnabled: boolean;     // 다중 배송 (1회에 여러 건)
    instantPay: boolean;           // 즉시 정산
  };
}
```

### 3. 운송사업자 (Logistics Partner) - 법인 ★ NEW
```typescript
{
  role: 'logistics_partner';
  userType: 'business';

  // 특징
  - 배송 대행사 (퀵 서비스, 물류 3사 등)
  - 다수의 라이더 보유
  - 플랫폼 내 자사 라이더 매칭

  // 사업자 정보
  businessInfo: {
    businessName: string;          // "GFM퀵서비스"
    businessNumber: string;
    ceoName: string;
    phone: string;
    email: string;
    address: { ... };
  };

  // 라이더 관리
  fleetManagement: {
    totalRiders: number;           // 총 라이더 수
    activeRiders: number;          // 현재 활성 라이더
    averageRatings: number;        // 평균 평점
    dispatchCapacity: number;      // 일일 처리 가능 용량
  };

  // 계약 조건
  contractTerms: {
    commissionRate: number;        // 플랫폼 수수료 (%)
    settlementCycle: 'daily' | 'weekly' | 'monthly';
    insuranceIncluded: boolean;    // 배송 보험 포함 여부
    slaGuarantee: boolean;         // SLA 보장 (배송 시간)
  };

  // 우선순위
  priorityLevel: 'gold' | 'silver' | 'bronze';

  // 라이더 목록
  riders: string[];                // users.uid 배열

  // 정산 정보
  settlementInfo: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
  };
}
```

### 4. 화물 운송사업자 (Cargo Partner) - 대형 물품 ★ NEW
```typescript
{
  role: 'cargo_partner';
  userType: 'business';

  // 특징
  - 이삿짐 센터, 택배사, 용달차 업체
  - 대형 물품 전문 (가구, 냉장고, 피아노 등)
  - 1톤 트럭, 5톤 트럭 보유

  // 차량 정보
  fleet: {
    vehicles: {
      vehicleId: string;
      type: 'motorcycle' | '1ton_truck' | '5ton_truck' | 'cargo_van';
      capacity: {
        weight: number;            // 적재 중량 (kg)
        volume: number;            // 적재 용적 (m³)
      };
      features: string[];         // ["리프트", "냉동", "윙바디"]
    }[];
  };

  // 전문 분야
  specializations: [
    'furniture',                  // 가구
    'appliance',                  // 가전
    'piano',                      // 피아노/악기
    'moving',                     // 이사
    'cargo',                      // 일반 화물
    'fragile'                     // 깨지기 쉬운 물품
  ];

  // 보험
  insurance: {
    hasCargoInsurance: boolean;   // 화물 보험
    coverageAmount: number;        // 보상 한도 (원)
    deductible: number;           // 자기부담금
  };

  // 요금
  pricing: {
    baseFee: number;              // 기본 요금 (출발지 도착지 상관없이)
    perKmFee: number;             // km당 요금
    perWeightFee: number;          // kg당 요금
    heavyItemSurcharge: number;    // 중량물 추가 요금
    nightSurcharge: number;        // 야간 추가 요금
  };
}
```

---

## Firebase Collections (수정)

### users (확장)
```typescript
{
  uid: string;
  email: string;
  name: string;

  // 사용자 타입 확장
  role: 'gler' | 'giller' | 'business_gler' | 'location_partner'
        | 'pro_giller' | 'logistics_partner' | 'cargo_partner';
  userType: 'individual' | 'business';

  // 개인 길러 vs 전문 길러 구분
  gillerType?: 'part_time' | 'full_time';

  // 전문 길러 정보
  proGillerInfo?: {
    equipment: { ... };
    verification: { ... };
    earnings: { ... };
    premiumFeatures: { ... };
  };

  // 운송사업자 정보
  logisticsInfo?: {
    fleetManagement: { ... };
    contractTerms: { ... };
    priorityLevel: string;
    riders: string[];
  };

  // 화물 운송사업자 정보
  cargoInfo?: {
    fleet: { ... };
    specializations: string[];
    insurance: { ... };
    pricing: { ... };
  };

  // 공통 필드
  createdAt: Timestamp;
  isActive: boolean;
}
```

### requests (수정)
```typescript
{
  requestId: string;
  cityCode: string;
  requesterId: string;

  // 배송 유형 (NEW)
  deliveryType: 'standard' | 'express' | 'cargo';

  // 배송자 유형 요청 (NEW)
  preferredCourierType?: 'part_time' | 'full_time' | 'logistics' | 'cargo';

  // cargo 전용 필드
  cargoDetails?: {
    weight: number;               // kg
    dimensions: {                 // cm
      width: number;
      height: number;
      depth: number;
    };
    requiresElevator: boolean;
    stairs: number;               // 층수
    requiresHelpers: number;      // 필요한 인원
    specialHandling?: string[];   // ["fragile", "upright"]
  };

  // express/cargo 전용 필드
  urgency?: 'normal' | 'urgent' | 'emergency';

  // ... 기존 필드
}
```

### matches (수정)
```typescript
{
  matchId: string;
  requestId: string;
  courierId: string;

  // 배송자 유형 (NEW)
  courierType: 'part_time' | 'full_time' | 'logistics_rider' | 'cargo_vehicle';

  // 운송사업자인 경우
  logisticsPartnerId?: string;   // 운송사업자 UID
  vehicleId?: string;            // 차량 ID (cargo)

  // cargo 전용
  cargoInfo?: {
    vehicleType: string;
    driverName: string;
    driverPhone: string;
    vehiclePlate: string;
  };

  // ... 기존 필드
}
```

### logistics_partners (NEW) - 운송사업자 마스터
```typescript
{
  partnerId: string;
  userId: string;
  businessInfo: { ... };
  fleetManagement: { ... };
  contractTerms: { ... };
  priorityLevel: 'gold' | 'silver' | 'bronze';
  riders: string[];              // 소속 라이더 UID 목록
  isActive: boolean;
  createdAt: Timestamp;
}
```

---

## 비즈니스 로직

### 1. 길러 매칭 우선순위

#### 표준 (Standard)
```
요청: "서울역 → 강남역, 서류 1건"
  ↓
[1순위] 전문 길러 (Pro Giller)
  - 우선 매칭
  - 1km당 높은 요금
  - 전문 장비 보유
  ↓
[2순위] 길러 (Part-time Giller)
  - 일반 매칭
  - 기존 요금
  ↓
[3순위] 운송사업자 (Logistics Partner)
  - 소속 라이더 매칭
  - 플랫폼 수수료 할인 (거래량 기반)
```

#### 익스프레스 (Express)
```
요청: "긴급 서류, 1시간 내 배송"
  ↓
[1순위] 전문 길러 (익스프레스 전문)
  - 즉시 응답
  - 익스프레스 요금 (2배)
  ↓
[2순위] 운송사업자 (Gold 티어)
  - 전용 라이더 배정
  - SLA 보장
```

#### 카고 (Cargo)
```
요청: "냉장고 배송, 100kg"
  ↓
[전용] 화물 운송사업자만 매칭
  - 1톤 트럭
  - 리프트 장착 차량
  - 2인 1조
```

---

### 2. 수수료 구조

#### 개인 길러 (Part-time)
```
수수료: 20% (플랫폼)
정산: 매일
수익: 월 30~50만원 추정
```

#### 전문 길러 (Pro Giller) ★
```
수수료: 15% (플랫폼) - 우대
정산: 즉시 정산 가능
수익: 월 150~300만원 추정
혜택:
  - 우선 매칭
  - km당 더 높은 요금 (+20%)
  - 다중 배송 (한 번에 3건까지)
```

#### 운송사업자 (Logistics Partner) ★
```
수수료: 10~15% (거래량 협상)
정산: 주간/월간
최소 보증금: 500만원
SLA 미달 시 페널티:
  - 배송 지연: -5% 수수료
  - 취소/파손: -10% 수수료
```

#### 화물 운송사업자 (Cargo Partner) ★
```
수수료: 5~10% (대형 물품)
정산: 건당 결제
보험: 필수 (화물 보험)
책임: 전담 (파손 시 100% 배상)
```

---

### 3. 전문 길러 (Pro Giller) 플로우

#### 가입
```
개인 길러 → 전문 길러 신청
  ↓
서류 제출
  - 신분증
  - 운전면허증 (옵션)
  - 배송 보험 가입 증명
  ↓
교육 이수
  - 배송 매뉴얼
  - 고객 응대
  - 분실/파손 대처
  ↓
실습/테스트
  - 모의 배송 3건
  ↓
승인
  - 전문 길러 배지 획득
  - 프리미엄 기능 활성화
```

#### 매칭
```
배송 요청 들어옴
  ↓
[우선] 전문 길러에게 푸시 (5분 우선)
  - 반경 3km 내
  - 평점 4.5+ 이상
  ↓
응답 없으면
  - 일반 길러에게 공개
  ↓
전문 길러 수락
  - 즉시 매칭 완료
  - 글러에게 "전문 배송사 표시"
```

#### 수익
```
전문 길러: 월 200만원
  - km당 1,500원 (일반 1,200원)
  - 다중 배송: 동시 3건
    - 예: 강남역 → 역삼역 → 선릉역 → 삼성역
    - 수익: 3건 × 2,000원 = 6,000원
  - 즉시 정산: 완료 후 10분 내 입금
```

---

### 4. 운송사업자 (Logistics Partner) 플로우

#### 계약
```
운송사업자 신청
  ↓
제안서 검토
  - 라이더 수
  - 평균 평점
  - 처리 용량
  ↓
계약 체결
  - 수수료: 10% (예시)
  - SLA: 95% 배송 완료율
  - 보증금: 500만원
  ↓
API 액세스 키 발급
  - 자사 시스템과 연동
```

#### 매칭
```
배송 요청 들어옴
  ↓
운송사업자 API로 전송
  POST /api/v1/partners/{partnerId}/dispatch
  {
    "requestId": "REQ-12345",
    "pickup": "서울역",
    "delivery": "강남역"
  }
  ↓
운송사업자가 자사 라이더 배정
  ← { "riderId": "rider-001", "eta": "14:23" }
  ↓
매칭 완료
  - 플랫폼 수수료: 10%
  - 운송사업자 수익: 90%
```

#### SLA 관리
```
주간 리포트
  - 배송 완료율: 97%
  - 평균 배송 시간: 23분
  - 취소율: 1%
  ↓
SLA 달성
  - 다음 주 우선순위 유지
  ↓
SLA 미달
  - 경고
  - 수수료 +2%
  - 계약 해지 위험
```

---

### 5. 화물 운송사업자 (Cargo Partner) 플로우

#### 견적
```
글러: "냉장고 배송, 서울역 → 강남역"
  ↓
화물 운송사업자들에게 견적 요청
  - 무게: 80kg
  - 층수: 3층 (엘리베이터 없음)
  - 인원: 2명 필요
  ↓
견적 도착 (3개사)
  1. A사: 50,000원 (리프트 O)
  2. B사: 65,000원 (리프트 O)
  3. C사: 45,000원 (리프트 X, 계단 운반)
  ↓
글러 선택
  ↓
배송 진행
```

#### 보험 처리
```
배송 중 파손
  ↓
화물 운송사업자 책임
  - 100% 배상
  - 자체 보험 처리
  ↓
플랫폼 개입 없음
  - 운송사업자가 직접 처리
```

---

## UI 화면 (추가)

### 1. ProGillerApplicationScreen
```
┌─────────────────────────────┐
│ 전문 길러 신청               │
├─────────────────────────────┤
│ 현재 상태                    │
│ □ 개인 길러                 │
│ ☑ 전문 길러                 │
│                              │
│ 전문 장비                    │
│ ☑ 보냉백                    │
│ ☑ 온열가방                  │
│ □ 보관 박스                  │
│ □ 스마트 잠금                │
│                              │
│ 이동 수단                    │
│ ○ 도보                      │
│ ○ 자전거                    │
│ ○ 오토바이                  │
│ ○ 승용차                    │
│                              │
│ 서류 업로드                   │
│ [신분증]                    │
│ [운전면허증]                │
│ [배송 보험 가입증명서]        │
│                              │
│ [신청하기]                   │
└─────────────────────────────┘
```

### 2. CourierSelectionScreen
```
┌─────────────────────────────┐
│ 배송자 선택                  │
├─────────────────────────────┤
│ 요청: 서울역 → 강남역         │
│                              │
│ ○ 자동 (가까운 길러)         │
│                              │
│ ● 전문 길러만                │
│                              │
│   김길러 (전문)              │
│   평점 4.8 · 1,234건 완료     │
│   보냉백, 온열가방 보유       │
│   요금: 3,500원               │
│   [선택]                     │
│                              │
│   이길러 (전문)              │
│   평점 4.9 · 2,345건 완료     │
│   다중 배송 가능             │
│   요금: 3,500원               │
│   [선택]                     │
│                              │
│ ● 운송사업자                  │
│                              │
│   GFM퀵서비스                 │
│   평점 4.7 · 15,000건/월      │
│   SLA 보장                   │
│   요금: 3,200원               │
│   [선택]                     │
└─────────────────────────────┘
```

### 3. LogisticsPartnerDashboard
```
┌─────────────────────────────┐
│ 운송사업자 대시보드           │
├─────────────────────────────┤
│ GFM퀵서비스 (Gold)            │
│                              │
│ 실시간 현황                  │
│ 활성 라이더: 45명            │
│ 진행 중 배송: 12건           │
│                              │
│ 주간 성적                    │
│ 배송 완료율: 97% (목표 95%)   │
│ 평균 시간: 22분             │
│ 취소율: 0.8%                │
│                              │
│ [새 배송 요청]                │
│ [라이더 관리]                │
│ [SLA 리포트]                 │
│ [정산 내역]                  │
└─────────────────────────────┘
```

### 4. CargoRequestScreen
```
┌─────────────────────────────┐
│ 카고 (대형 물품) 배송         │
├─────────────────────────────┤
│ 물품 정보                    │
│                              │
│ 종류                         │
│ ○ 가구  ○ 가전              │
│ ○ 이삿짐  ○ 기타             │
│                              │
│ 무게                         │
│ [  80  ] kg                 │
│                              │
│ 규격                         │
│ 가로: [100] cm               │
│ 세로: [ 60] cm               │
│ 높이: [180] cm               │
│                              │
│ 출발지 정보                  │
│ 엘리베이터: ○ 유  ○ 무       │
│ 층수: [  3  ] 층            │
│ 계단: [  2  ] 개             │
│                              │
│ 인력 필요                    │
│ [  2  ] 명                  │
│                              │
│ 특이사항                     │
│ [     ]                     │
│                              │
│ [견적 요청]                  │
└─────────────────────────────┘
```

---

## 비교 분석

### 개인 길러 vs 전문 길러

| 항목 | 개인 길러 | 전문 길러 |
|------|----------|----------|
| 근무 형태 | 파트타임 | 풀타임 |
| 장비 | 없음 | 보냉백, 온열가방 등 |
| 평점 기준 | 상관없음 | 4.5+ 이상 |
| 수익 | 월 30~50만원 | 월 150~300만원 |
| 수수료 | 20% | 15% (우대) |
| 매칭 | 일반 | 우선 |
| 다중 배송 | 불가 | 가능 (최대 3건) |
| 정산 | 매일 | 즉시 가능 |

### 전문 길러 vs 운송사업자

| 항목 | 전문 길러 | 운송사업자 |
|------|----------|-----------|
| 형태 | 개인 | 법인 |
| 라이더 수 | 1명 | 10~100명 |
| 책임 | 개인 | 회사 |
| 수수료 | 15% | 10~15% |
| SLA | 없음 | 있음 |
| API 연동 | 불가 | 가능 |
| 정산 주기 | 즉시/매일 | 주간/월간 |

---

## 구현 순서 (수정)

### Phase 1: 기본 구조
- [ ] 네비게이션
- [ ] Auth
- [ ] 개인 길러 기능

### Phase 2: 전문 길러 (NEW)
- [ ] 전문 길러 신청/승인
- [ ] 장비 정보 입력
- [ ] 우선 매칭 로직
- [ ] 즉시 정산

### Phase 3: 운송사업자 (NEW)
- [ ] 운송사업자 가입
- [ ] API 개발 (운송사업자 전용)
- [ ] SLA 모니터링
- [ ] 라이더 관리

### Phase 4: 카고 (NEW)
- [ ] 대형 물품 주문
- [ ] 화물 운송사업자 매칭
- [ ] 견적 시스템
- [ ] 보험 처리

### Phase 5: 핵심 기능
- [ ] 실시간 추적
- [ ] 결제
- [ ] 사업자/위상사업자

---

## 경쟁사 분석

### 기존 퀵 서비스
- **배달의민족, 배달통:** 음식 배송만
- **GFM, 버즈빌, 덴다:** 소형 물품만

### "가는길에"만의 차별점

1. **다층 구조:** 개인 → 전문 → 운송사업자
2. **지하철 특화:** 출퇴근길에 배송
3. **대형 물품:** 카고 운송사업자
4. **멀티테넌트:** 다중 도시 확장

---

_기획일: 2026년 2월 5일_
_추가: 전문 길러, 운송사업자, 화물 운송사업자 모델_
_시장: 개인/전문/법인 3층 구조_
