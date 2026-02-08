# 매칭 알고리즘 기획안

## 개요

지하철 크라우드 배송 서비스 "가는길에"의 핵심인 **배송 요청과 길러(배송자) 매칭 시스템**에 대한 상세 기획입니다.

---

## 1. 매칭 기본 원칙

### 1.1 핵심 가치

1. **효율성**: 길러의 기존 동선을 활용하여 추가 이동 없이 배송
2. **신뢰성:** 평점, 인증 상태를 고려한 우선 매칭
3. **공정성:** 모든 길러에게 공평한 매칭 기회 제공
4. **수익성:** 길러와 글러 모두에게 경제적 이익 제공

### 1.2 매칭 제약 조건

| 조건 | 설명 | 우선순위 |
|------|------|----------|
| **경로 일치** | 수령역 → 배송역 경로가 길러의 동선과 일치 | 필수 |
| **시간 일치** | 길러의 출발 시간 전에 수령 가능 | 필수 |
| **요일 일치** | 길러가 활동하는 요일 | 필수 |
| **용량 가능** | 물건 크기/무게가 길러의 수용 가능 범위 | 필수 |
| **평점** | 길러의 평점 4.0 이상 권장 | 선택 (가중치) |
| **응답 시간** | 빠른 응답을 우선 | 선택 (가중치) |

---

## 2. 매칭 점수 알고리즘

### 2.1 점수 계산식

```typescript
MatchingScore =
  (RouteMatchScore × 0.4) +
  (TimeMatchScore × 0.3) +
  (GillerRating × 0.2) +
  (ResponseTimeScore × 0.1)
```

### 2.2 상세 점수 기준

#### (1) 경로 일치 점수 (40점 만점)

| 일치 유형 | 점수 | 설명 |
|-----------|------|------|
| **완벽 일치** | 40 | 수령역 == 길러 출발역 && 배송역 == 길러 도착역 |
| **부분 일치 (상)** | 30 | 수령역과 배송역이 길러 경로 상에 있음 |
| **부분 일치 (하)** | 20 | 수령역 또는 배송역 하나만 일치 |
| **불일치** | 0 | 경로가 전혀 맞지 않음 |

**예시:**
```
길러 동선: 서울역 → 강남역
요청 1: 서울역 → 강남역 = 40점 (완벽 일치)
요청 2: 시청역 → 강남역 = 30점 (시청은 서울역 근처, 배송역 일치)
요청 3: 서울역 → 역삼역 = 20점 (수령역만 일치, 역삼은 강남 근처)
요청 4: 홍대입구역 → 신촌역 = 0점 (전혀 다른 경로)
```

#### (2) 시간 일치 점수 (30점 만점)

```typescript
TimeMatchScore =
  (PickupTimeScore × 0.6) +
  (DeliveryTimeScore × 0.4)

// 수령 시간 점수
PickupTimeScore = max(0, 30 - |요청 수령 시간 - 길러 출발 시간| / 10분)

// 배송 시간 점수
DeliveryTimeScore = max(0, 30 - |길러 도착 시간 - 요청 배송 마감 시간| / 10분)
```

**예시:**
```
길러 동선: 08:30 출발, 09:00 도착
요청: 08:00~08:20 수령, 09:00 전 배송

PickupTimeScore:
  |08:00~08:20 - 08:30| = 10분 차이
  30 - (10 / 10) = 29점

DeliveryTimeScore:
  |09:00 - 09:00| = 0분 차이
  30 - 0 = 30점

TimeMatchScore = (29 × 0.6) + (30 × 0.4) = 17.4 + 12 = 29.4점
```

#### (3) 길러 평점 (20점 만점)

```typescript
GillerRating = (길러 평점 - 3.0) / 2.0 × 20
```

| 평점 | 점수 | 설명 |
|------|------|------|
| 5.0 | 20점 | 최상 |
| 4.5 | 15점 | 우수 |
| 4.0 | 10점 | 양호 |
| 3.5 | 5점 | 보통 |
| 3.0 미만 | 0점 | 매칭 제한 |

#### (4) 응답 시간 점수 (10점 만점)

```typescript
ResponseTimeScore = max(0, 10 - (응답 시간(분) / 3))
```

| 응답 시간 | 점수 | 설명 |
|-----------|------|------|
| 0~5분 | 10점 | 즉시 응답 |
| 5~15분 | 5점 | 빠른 응답 |
| 15~30분 | 3점 | 일반 응답 |
| 30분 초과 | 0점 | 늦은 응답 |

---

## 3. 매칭 프로세스

### 3.1 전체 플로우

```
[1단계] 요청 생성
  ↓
[2단계] 후보 길러 검색 (Firestore 쿼리)
  - 경로 일치 (수령역, 배송역)
  - 요일 일치
  - 시간 가능 여부
  ↓
[3단계] 매칭 점수 계산
  - 경로: 40%
  - 시간: 30%
  - 평점: 20%
  - 응답: 10%
  ↓
[4단계] 상위 N명 알림 (N=3~5)
  - FCM 푸시 알림
  - 알림 타임아웃: 5분
  ↓
[5단계] 길러 수락/거절
  - 첫 번째 수락한 길러에게 매칭
  - 나머지는 자동 거절 처리
  ↓
[6단계] 매칭 완료
  - matches collection 생성
  - 요청 상태: pending → matched
  - 길러/글러에게 알림
```

### 3.2 매칭 취소 사유

| 사유 | 설명 | 처리 |
|------|------|------|
| **시간 초과** | 5분 내 응답 없음 | 자동 취소, 다음 후보에게 알림 |
| **길러 거절** | 길러가 명시적 거절 | 다음 후보에게 알림 |
| **용량 초과** | 물건이 너무 크거나 무거움 | 해당 길러 제외 |
| **평점 미달** | 평점 3.0 미만 | 자동 제외 |
| **이미 배송 중** | 길러가 다른 배송 중 | 제외 또는 대기 |

---

## 4. 우선 매칭 시스템 (프리미엄)

### 4.1 우선순위 계층

| 우선순위 | 유형 | 설명 | 매칭 시간 |
|----------|------|------|-----------|
| 1위 | **전문 길러 (Pro Giller)** | 전업, 인증 완료, 장비 보유 | 1분 내 |
| 2위 | **프리미엄 사업자** | 월 구독 Pro 이상 | 2분 내 |
| 3위 | **일반 길러** | 파트타임, 평점 4.0+ | 3분 내 |
| 4위 | **신규 길러** | 평점 없음, 10건 미만 | 5분 내 |

### 4.2 우선 매칭 로직

```typescript
// 프리미엄 요청 여부 판단
isPremiumRequest =
  request.packageInfo.size === 'large' ||
  request.packageInfo.weight > 5 ||
  request.packageInfo.declaredValue > 100000 ||
  request.deliveryType === 'express'

// 우선 매칭 대상 선정
priorityGillers =
  gillers
    .filter(g => g.role === 'pro_giller' || g.premiumFeatures.priorityMatching)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 5)
```

---

## 5. 매칭 실패 대응

### 5.1 재매칭 조건

| 조건 | 재매칭 횟수 | 대기 시간 |
|------|-----------|-----------|
| 응답 없음 | 최대 3회 | 5분, 10분, 15분 |
| 모두 거절 | 최대 3회 | 즉시, 5분, 10분 |
| 매칭 취소 | 최대 5회 | 즉시 |

### 5.2 실패 시 대안

1. **자동 취소**: 3회 실패 후 요청 자동 취소
2. **수동 재시도**: 글러가 재매칭 요청
3. **프리미엄 업그레이드**: 추가 수수료로 우선 매칭
4. **운송사업자 매칭**: 화물 파트너 연결 (대형 물품)

---

## 6. Firestore 구조

### 6.1 matches Collection

```typescript
{
  matchId: string;
  requestId: string;           // requests.requestId
  gllerId: string;             // 요청자 ID
  gillerId: string;            // 배송자 ID
  matchScore: number;          // 매칭 점수

  // 매칭 상세
  matchingDetails: {
    routeScore: number;        // 경로 점수
    timeScore: number;         // 시간 점수
    ratingScore: number;       // 평점 점수
    responseScore: number;     // 응답 점수
    calculatedAt: Timestamp;
  };

  // 알림 시간
  notifiedAt: Timestamp;
  respondedAt?: Timestamp;

  // 상태
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'completed';

  // 취소 사유
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: Timestamp;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 6.2 matching_queue Collection (Cloud Functions용)

```typescript
{
  queueId: string;
  requestId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number;            // 우선순위 (1~10)

  // 재시도 정보
  retryCount: number;
  maxRetries: number;

  // 후보 길러 목록
  candidateGillers: {
    gillerId: string;
    score: number;
    notifiedAt?: Timestamp;
    respondedAt?: Timestamp;
  }[];

  createdAt: Timestamp;
  processedAt?: Timestamp;
}
```

---

## 7. Cloud Functions 구현

### 7.1 트리거 함수

```typescript
// 1. 배송 요청 생성 시 매칭 시작
exports.onRequestCreated = functions.firestore
  .document('requests/{requestId}')
  .onCreate(async (snap, context) => {
    const request = snap.data();
    await startMatchingProcess(request);
  });

// 2. 길러 수락 시 매칭 완료
exports.onMatchAccepted = functions.firestore
  .document('matches/{matchId}')
  .onUpdate(async (change, context) => {
    const after = change.after.data();
    if (after.status === 'accepted') {
      await completeMatching(after);
    }
  });
```

### 7.2 매칭 로직 (의사 코드)

```typescript
async function startMatchingProcess(request: DeliveryRequest) {
  // 1. 후보 길러 검색
  const candidates = await findCandidateGillers(request);

  // 2. 점수 계산
  const scored = calculateMatchingScores(candidates, request);

  // 3. 상위 N명 선정
  const topN = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // 4. 매칭 생성 및 알림
  for (const giller of topN) {
    await createMatch(request, giller);
    await sendNotification(giller.gillerId, request);
  }

  // 5. 타임아웃 설정 (5분)
  await setTimeout(() => checkMatchingTimeout(request.requestId), 5 * 60 * 1000);
}

async function findCandidateGillers(request: DeliveryRequest) {
  // Firestore 쿼리
  const q = query(
    collection(db, 'routes'),
    where('isActive', '==', true),
    where('daysOfWeek', 'array-contains-any', request.preferredDays),
    // 출발역이 수령역 근처인 길러
    // 도착역이 배송역 근처인 길러
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}
```

---

## 8. UI/UX 플로우

### 8.1 글러 (요청자)

```
[배송 요청 생성]
  ↓
"매칭 중입니다..." (Loading)
  ↓
[알림] "길러를 찾았습니다!"
  ↓
[매칭 완료 화면]
  - 길러 정보 (이름, 평점, 프로필 사진)
  - 예상 배송 시간
  - 실시간 채팅 버튼
```

### 8.2 길러 (배송자)

```
[푸시 알림]
  "새 배송 요청이 있습니다!"
  - 수령역: 서울역
  - 배송역: 강남역
  - 배송비: 7,000원
  ↓
[알림 탭]
  - 상세 정보
  - 수락/거절 버튼
  - 만료 시간: 5분
  ↓
[수락]
  - 매칭 완료
  - 글러 연락처 표시
  - 수령/배송 인증 코드
```

---

## 9. 성능 최적화

### 9.1 캐싱 전략

1. **길러 동선 캐싱**: 메모리에 10분 캐시
2. **매칭 결과 캐싱**: 동일 요청 재매칭 시 활용
3. **길러 활동 상태 캐싱**: 현재 배송 중인 길러 목록

### 9.2 DB 인덱스

```typescript
// routes collection 인덱스
routes.userId + routes.isActive
routes.startStation.name + routes.daysOfWeek
routes.departureTime + routes.daysOfWeek
```

---

## 10. 다음 단계

- [ ] Cloud Functions로 매칭 로직 구현
- [ ] FCM 푸시 알림 연동
- [ ] 매칭 점수 시뮬레이터 개발
- [ ] A/B 테스트로 점수 가중치 최적화
- [ ] 지하철역 API 연동 후 거리 계산 로직 추가

---

_기획일: 2026년 2월 5일_
_기획자: OpenClaw (AI DevOps Assistant)_
_버전: 1.0_
