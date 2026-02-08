# 지하철 데이터 기반 매칭 시스템

## 개요

서울 지하철 1~9호선 및 신분당선의 주요 30개 역 데이터를 하드코딩하여, **시간 기반의 지능형 매칭 알고리즘**을 구현합니다.

---

## 데이터 구조

### 1. 역 정보 (`subway-stations.ts`)

**30개 주요 역:**
- 1호선: 서울역, 시청, 종각, 종로3가
- 2호선: 을지로입구, 을지로3가, 강남, 역삼, 선릉, 교대
- 3호선: 충무로, 양재, 고속터미널
- 4호선: 이촌, 사당
- 5호선: 광화문, 여의도
- 6호선: 공덕
- 7호선: 도봉산, 수락산
- 8호선: 잠실, 석촌
- 9호선: 여의도, 강남, 교대
- 신분당선: 양재, 강남, 역삼, 선릉
- 공항철도: 서울역, 공덕

**데이터 포맷:**
```typescript
interface Station {
  stationId: string;
  stationName: string;
  stationNameEnglish: string;
  lines: Line[];
  location: { latitude: number; longitude: number };
  isTransferStation: boolean;
  facilities: { hasElevator: boolean; hasEscalator: boolean };
}
```

---

### 2. 소요 시간 (`travel-times.ts`)

**실제 소요 시간 데이터 (초 단위):**
```typescript
TRAVEL_TIME_MATRIX['150-222'] = {
  normalTime: 35 * 60,      // 일반 35분 (1→4→2)
  expressTime: 22 * 60,     // 급행 22분 (신분당선)
  transferCount: 1,
  transferStations: ['D08'],
  hasExpress: true,
  walkingDistance: 200,
};
```

**주요 경로 예시:**
| 경로 | 일반 | 급행 | 환승 |
|------|------|------|------|
| 서울역 → 강남 | 35분 | 22분 | 1회 |
| 강남 → 역삼 | 4분 | 2분 | 0회 |
| 서울역 → 교대 | 30분 | 20분 | 1회 |

---

### 3. 급행 열차 (`express-trains.ts`)

**급행 종류:**
- **1호선 특급:** 서울~천안 (주요역만 정차)
- **1호선 급행:** 서울~구로
- **신분당선 급행:** 2~3분 간격 (가장 빈번)
- **9호선 급행:** 6~8분 간격
- **3호선 급행:** 8~15분 간격
- **공항철도 직행:** 20~30분 간격

**운행 빈도:**
```typescript
expressTrain.intervals = {
  rushHourMorning: 3 * 60,  // 3분 (신분당선)
  rushHourEvening: 5 * 60,  // 5분
  daytime: 8 * 60,          // 8분
  night: 10 * 60,           // 10분
};
```

---

### 4. 혼잡도 (`congestion.ts`)

**혼잡도 등급 (1~10):**
- **1~3:** 여유 (신분당선, 공항철도)
- **4~6:** 보통 (3, 5, 6, 9호선)
- **7~8:** 혼잡 (1, 4, 7, 8호선)
- **9~10:** 매우 혼잡 (2호선 출퇴근)

**시간대별 혼잡도:**
```typescript
congestion.timeSlots = {
  earlyMorning: 3,        // 05:00-07:00
  rushHourMorning: 9,     // 07:00-09:00 (최고 혼잡)
  morning: 6,             // 09:00-12:00
  lunch: 5,               // 12:00-14:00
  afternoon: 7,           // 14:00-18:00
  rushHourEvening: 9,     // 18:00-20:00 (최고 혼잡)
  evening: 4,             // 20:00-23:00
};
```

---

## 매칭 알고리즘

### 점수 계산식 (100점 만점)

```
MatchingScore =
  (TimeEfficiencyScore × 0.5) +      // 50점: 시간 효율
  (RouteConvenienceScore × 0.3) +    // 30점: 경로 편의성
  (GillerReliabilityScore × 0.2)     // 20점: 길러 신뢰도
```

---

### 1. 시간 효율성 점수 (50점)

#### (1) 이동 시간 점수 (30점)
```typescript
if (timeMargin >= 30분) {
  travelTimeScore = 30;  // ⭐ 우수
} else if (timeMargin >= 15분) {
  travelTimeScore = 25;  // ✅ 좋음
} else if (timeMargin >= 5분) {
  travelTimeScore = 20;  // 👍 양호
} else if (timeMargin >= 0) {
  travelTimeScore = 10;  // ⚠️ 촉박
} else {
  travelTimeScore = 0;   // ❌ 불가
}
```

#### (2) 대기 시간 점수 (10점)
```typescript
waitingTimeScore = max(0, 10 - |길러_출발 - 요청_수령| / 5분);

// 예시
길러 08:00 출발, 요청 08:00 수령 → |0분| → 10점 ⭐
길러 08:00 출발, 요청 08:15 수령 → |15분| → 7점
길러 08:00 출발, 요청 08:30 수령 → |30분| → 4점
```

#### (3) 스케줄 일치 점수 (10점)
```typescript
scheduleMatchScore = (trainFrequencyScore + expressBonus) / 2;

// 신분당선 출퇴근 (2~3분 간격, 급행 있음)
trainFrequencyScore = 10, expressBonus = 10 → 10점 ⭐

// 1호선 낮 시간 (10분 간격, 급행 있음)
trainFrequencyScore = 5, expressBonus = 10 → 7.5점

// 일반 노선 (5~10분 간격, 급행 없음)
trainFrequencyScore = 5, expressBonus = 5 → 5점
```

---

### 2. 경로 편의성 점수 (30점)

#### (1) 환승 페널티 (12점)
```typescript
transferPenalty = 12 - (환승_횟수 × 3);

환승 0회 → 12점 ⭐
환승 1회 → 9점
환승 2회 → 6점
환승 3회 → 3점
환승 4회+ → 0점
```

#### (2) 혼잡도 점수 (9점)
```typescript
congestionScore = baseCongestionScore + rushHourPenalty;

// 신분당선 낮 시간
baseCongestionScore = 9, rushHourPenalty = 0 → 9점 ⭐

// 신분당선 출퇴근
baseCongestionScore = 9, rushHourPenalty = -3 → 6점

// 2호선 출퇴근
baseCongestionScore = 2, rushHourPenalty = -3 → 0점 ❌
```

#### (3) 도보 거리 점수 (9점)
```typescript
walkingDistanceScore = max(0, 9 - 총_도보_거리_m / 100);

역 내 이동 50m → 9점 ⭐
역 내 이동 200m → 7점
역 내 이동 500m → 4점
역 내 이동 900m → 0점
```

---

### 3. 길러 신뢰도 점수 (20점)

```typescript
// 평점 점수 (12점 만점)
ratingScore = (길러_평점 - 3.0) / 2.0 × 12;

평점 5.0 → 12점 ⭐
평점 4.5 → 9점
평점 4.0 → 6점
평점 3.5 → 3점
평점 3.0 미만 → 0점

// 응답 시간 점수 (8점 만점)
responseTimeScore = max(0, 8 - 응답_시간_분 / 3);

응답 0~5분 → 8점 ⭐
응답 5~15분 → 5점
응답 15~30분 → 3점
응답 30분+ → 0점
```

---

## 실제 매칭 예시

### 시나리오

**배송 요청:**
```
수령역: 서울역
배송역: 강남역
수령 시간: 08:00~08:20
배송 마감: 09:00
물건: 소형 (2kg)
```

**길러 후보:**

| 길러 | 동선 | 출발 | 평점 |
|------|------|------|------|
| A | 서울역→강남역 (1→4→2) | 08:00 | 4.5 |
| B | 서울역→강남역 (신분당 급행) | 08:05 | 4.2 |
| C | 서울역→역삼역 (신분당) | 08:10 | 4.8 |

---

### 길러 A 점수 계산

```
[시간 효율성]
이동 시간: 35분
마감까지: 10분 여유 (08:35 도착, 09:00 마감)
→ travelTimeScore = 25점 ✅

대기 시간: |08:00 - 08:00| = 0분
→ waitingTimeScore = 10점 ⭐

스케줄: 1호선 (5~10분 간격, 급행 있음)
→ scheduleMatchScore = 7.5점

TimeEfficiencyScore = 25×0.6 + 10×0.2 + 7.5×0.2 = 15 + 2 + 1.5 = 18.5점

[경로 편의성]
환승: 2회 (서울역 1→4, 사당 4→2)
→ transferPenalty = 12 - 6 = 6점

혼잡도: 1호선 출퇴근 (혼잡도 9, 출퇴근 페널티 -3)
→ congestionScore = 9 - 3 = 6점

도보: 200m
→ walkingDistanceScore = 9 - 2 = 7점

RouteConvenienceScore = 6×0.4 + 6×0.3 + 7×0.3 = 2.4 + 1.8 + 2.1 = 6.3점

[길러 신뢰도]
평점: 4.5
→ ratingScore = ((4.5 - 3.0) / 2.0) × 12 = 9점

응답: 3분 (가정)
→ responseTimeScore = 8 - (3 / 3) = 7점

GillerReliabilityScore = 9×0.6 + 7×0.4 = 5.4 + 2.8 = 8.2점

[총점]
Total = 18.5×0.5 + 6.3×0.3 + 8.2×0.2
     = 9.25 + 1.89 + 1.64
     = 12.78점 (환산 100점 만점 기준)
```

---

### 길러 B 점수 계산 (우수 🌟)

```
[시간 효율성]
이동 시간: 22분 (신분당 급행)
마감까지: 38분 여유
→ travelTimeScore = 30점 ⭐

대기 시간: |08:05 - 08:10| = 5분
→ waitingTimeScore = 9점

스케줄: 신분당선 (2~3분 간격, 급행)
→ scheduleMatchScore = 10점 ⭐

TimeEfficiencyScore = 30×0.6 + 9×0.2 + 10×0.2 = 18 + 1.8 + 2 = 21.8점

[경로 편의성]
환승: 1회 (서울역 1→신분당)
→ transferPenalty = 12 - 3 = 9점 ⭐

혼잡도: 신분당선 낮 시간 (여유)
→ congestionScore = 9점 ⭐

도보: 180m
→ walkingDistanceScore = 7.2점

RouteConvenienceScore = 9×0.4 + 9×0.3 + 7.2×0.3 = 3.6 + 2.7 + 2.16 = 8.46점

[길러 신뢰도]
평점: 4.2 → ratingScore = 7.2점
응답: 3분 → responseTimeScore = 7점

GillerReliabilityScore = 7.2×0.6 + 7×0.4 = 4.32 + 2.8 = 7.12점

[총점]
Total = 21.8×0.5 + 8.46×0.3 + 7.12×0.2
     = 10.9 + 2.54 + 1.42
     = 14.86점 ⭐ (1위)
```

---

## 사용 방법

### 1. 기본 사용

```typescript
import { matchGillersToRequest, getStationByName } from './data';

// 길러 데이터
const gillers = [
  {
    gillerId: 'giller1',
    gillerName: '김길러',
    startStation: getStationByName('서울역')!,
    endStation: getStationByName('강남역')!,
    departureTime: '08:05',
    daysOfWeek: [1, 2, 3, 4, 5],
    rating: 4.2,
  },
  // ... more gillers
];

// 배송 요청
const request = {
  requestId: 'req1',
  pickupStationName: '서울역',
  deliveryStationName: '강남역',
  pickupStartTime: '08:00',
  pickupEndTime: '08:20',
  deliveryDeadline: '09:00',
  preferredDays: [1, 2, 3, 4, 5],
  packageSize: 'small',
  packageWeight: 2,
};

// 매칭 실행
const matches = matchGillersToRequest(gillers, request);

// 결과 확인
matches.forEach((match, index) => {
  console.log(`#${index + 1} ${match.gillerName}: ${match.totalScore}점`);
  console.log(`  이동 시간: ${Math.round(match.routeDetails.travelTime / 60)}분`);
  console.log(`  환승: ${match.routeDetails.transferCount}회`);
  console.log(`  급행: ${match.routeDetails.isExpressAvailable ? '✅' : '❌'}`);
  console.log(`  이유: ${match.reasons.join(', ')}`);
});
```

---

### 2. 상위 N명 추출

```typescript
import { getTopMatches } from './data';

const top3 = getTopMatches(gillers, request, 3);
console.log(top3[0].gillerName); // "김길러" (highest score)
```

---

### 3. 단일 기능 사용

```typescript
import {
  getStationById,
  getTravelTime,
  hasExpressBetween,
  getCongestionLevel,
  isRushHour,
} from './data';

// 역 정보 조회
const seoul = getStationById('150');
console.log(seoul.stationName); // "서울역"

// 소요 시간 조회
const travelTime = getTravelTime('150', '222');
console.log(travelTime.normalTime / 60); // 35분
console.log(travelTime.expressTime / 60); // 22분

// 급행 확인
const hasExpress = hasExpressBetween('150', '222', 'sinbundang');
console.log(hasExpress); // true

// 혼잡도 확인
const congestion = getCongestionLevel('sinbundang', '08:30');
console.log(congestion); // 5 (보통)

// 출퇴근 시간 확인
const isRush = isRushHour('08:30');
console.log(isRush); // true
```

---

## 파일 구조

```
data/
├── index.ts                 # 메인 진입점 (모든 모듈 re-export)
├── subway-stations.ts       # 30개 주요 역 데이터
├── travel-times.ts          # 역 간 소요 시간 매트릭스
├── express-trains.ts        # 급행 열차 정보
├── congestion.ts            # 혼잡도 데이터
└── matching-engine.ts       # 매칭 알고리즘 엔진
```

---

## 다음 단계

1. **Firestore 연동**
   - 길러의 동선(routes collection)에서 gillers 배열로 변환
   - 배송 요청 생성 시 자동 매칭 트리거

2. **Cloud Functions 구현**
   - `onRequestCreated`: 배송 요청 시 매칭 시작
   - 매칭 결과를 matches collection에 저장
   - FCM 푸시 알림 전송

3. **UI 구현**
   - 매칭 결과 화면
   - 길러에게 알림 전송
   - 수락/거절 버튼

4. **API 연동**
   - 서울지하철공사 데이터로 교체
   - 실시간 열차 정보 연동
   - 역 간 거리 정확도 개선

---

_버전: 1.0_  
_생성일: 2026년 2월 5일_  
_작성자: OpenClaw (AI DevOps Assistant)_
