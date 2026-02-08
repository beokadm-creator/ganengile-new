# 지하철 데이터 구조 및 시간 기반 매칭 알고리즘

## 1. 문제점 분석

### 1.1 단순 거리 기반 매칭의 한계

```
[예시 상황]
요청: 서울역 → 강남역
길러 A: 서울역 → 강남역 (일반 9호선, 35분)
길러 B: 서울역 → 강남역 (2호선 환승, 20분)
길러 C: 서울역 → 양재역 (신분당선 급행, 18분)

단순 거리 기반:
- A, B 동일 점수 → ❌ 구별 불가
- C는 배송역이 다름 → ❌ 제외

시간 기반:
- B 우선 (20분 소요)
- C도 가능 (양재는 강남 인접, +3분 도보)
```

### 1.2 고려해야 할 요소

| 요소 | 설명 | 중요도 |
|------|------|--------|
| **소요 시간** | 실제 이동 시간 (환승, 대기 시간 포함) | ⭐⭐⭐⭐⭐ |
| **급행 여부** | 급행/특급 정차역 확인 | ⭐⭐⭐⭐ |
| **환승 횟수** | 환승역에서의 대기 시간 | ⭐⭐⭐ |
| **방향** | 내선/외선, 상행/하행 일치 | ⭐⭐⭐⭐ |
| **혼잡도** | 출퇴근 시간대 혼잡도 | ⭐⭐ |
| **도보 거리** | 역 내 이동 거리 | ⭐⭐ |

---

## 2. 서울 지하철 데이터 구조

### 2.1 Station (역 정보)

```typescript
interface Station {
  stationId: string;              // "150" (서울역)
  stationName: string;            // "서울역"
  stationNameEnglish: string;     // "Seoul Station"
  lines: LineInfo[];             // 해당 역의 노선들

  // 위치 정보
  location: {
    latitude: number;
    longitude: number;
  };

  // 역 구분
  isTransferStation: boolean;    // 환승역 여부
  isExpressStop: boolean;         // 급행 정차역
  isTerminus: boolean;            // 종점역

  // 시설 정보
  facilities: {
    hasElevator: boolean;
    hasEscalator: boolean;
    wheelchairAccessible: boolean;
  };

  // 역간 연결
  connections: StationConnection[];
}

interface LineInfo {
  line: string;                   // "1", "2", "3", "4", "5", "6", "7", "8", "9"
  lineName: string;               // "1호선", "2호선"...
  lineColor: string;              // "#0052A4"
  lineType: 'general' | 'express' | 'special';
  stationCode: string;            // "150"
}
```

### 2.2 StationConnection (역간 연결)

```typescript
interface StationConnection {
  fromStationId: string;          // 출발역 ID
  toStationId: string;            // 도착역 ID
  line: string;                   // 노선

  // 거리/시간 정보
  distance: number;               // 미터 단위
  travelTime: number;             // 초 단위 (실제 소요 시간)

  // 급행 정보
  isExpressRoute: boolean;        // 급행 경로 여부
  expressTypes?: string[];        // ["특급", "급행", "ITX"]

  // 방향 정보
  direction: 'inbound' | 'outbound';  // 내선/외선 (순환선)

  // 운행 정보
  operationInfo: {
    weekdayInterval: number;      // 평일 운행 간격 (초)
    weekendInterval: number;      // 주말 운행 간격 (초)
    firstTrain: string;           // "05:30"
    lastTrain: string;            // "23:40"
  };
}
```

### 2.3 Route (경로)

```typescript
interface Route {
  routeId: string;
  startStation: Station;
  endStation: Station;

  // 경로 세그먼트 (환승 포함)
  segments: RouteSegment[];

  // 총 소요 시간
  totalTravelTime: number;        // 초 단위
  totalDistance: number;          // 미터 단위

  // 환승 정보
  transferCount: number;
  transferStations: Station[];

  // 급행 여부
  hasExpress: boolean;
  expressSegments: number;        // 급행 구간 수

  // 방향
  direction: 'inbound' | 'outbound' | 'up' | 'down';
}

interface RouteSegment {
  fromStation: Station;
  toStation: Station;
  line: string;

  distance: number;
  travelTime: number;             // 이 구간의 소요 시간

  isExpress: boolean;             // 급행 구간 여부
  direction: string;

  // 환승 정보
  requiresTransfer: boolean;
  transferTime?: number;          // 환승 대기 시간 (초)
  transferLine?: string;          // 환승 노선
}
```

---

## 3. 개선된 매칭 점수 알고리즘 (시간 기반)

### 3.1 새로운 점수 계산식

```typescript
MatchingScore =
  (TimeEfficiencyScore × 0.5) +      // ⭐ 시간 효율성: 50%
  (RouteConvenienceScore × 0.3) +    // 경로 편의성: 30%
  (GillerReliabilityScore × 0.2)     // 길러 신뢰도: 20%
```

### 3.2 시간 효율성 점수 (50점 만점)

```typescript
TimeEfficiencyScore =
  (TravelTimeScore × 0.6) +
  (WaitingTimeScore × 0.2) +
  (ScheduleMatchScore × 0.2)
```

#### (1) 이동 시간 점수 (30점 만점)

```typescript
// 길러의 동선 소요 시간 기준
TravelTimeScore = max(0, 30 - (길러_소요시간 / 요청_허용시간) × 30)

// 예시
요청 허용 시간: 40분
길러 A: 35분 소요 → 30 - (35/40) × 30 = 3.75점 ❌
길러 B: 25분 소요 → 30 - (25/40) × 30 = 11.25점 ✅
길러 C: 18분 소요 → 30 - (18/40) × 30 = 16.5점 ⭐
```

#### (2) 대기 시간 점수 (10점 만점)

```typescript
// 길러의 출발 시간과 요청 수령 시간의 간격
WaitingTimeScore = max(0, 10 - |길러_출발시간 - 요청_수령시간| / 5분)

// 예시
길러 A: 08:30 출발, 요청 08:00 수령 → |30분| / 5 = 6 → 4점
길러 B: 08:15 출발, 요청 08:00 수령 → |15분| / 5 = 3 → 7점
길러 C: 08:05 출발, 요청 08:00 수령 → |5분| / 5 = 1 → 9점 ⭐
```

#### (3) 스케줄 일치 점수 (10점 만점)

```typescript
// 열차 운행 빈도 및 급행 여부
ScheduleMatchScore =
  (TrainFrequencyScore × 0.5) +
  (ExpressBonusScore × 0.5)

// 열차 운행 빈도
TrainFrequencyScore = min(10, (1 / 운행간격_분) × 30)

// 예시
평일 출퇴근 시간 (2~3분 간격) → 10점 ⭐
평일 낮 시간 (5~10분 간격) → 5점
주말 (10분 이상 간격) → 3점

// 급행 보너스
ExpressBonusScore =
  경로에_급행_있음 ? 10 : 5
```

### 3.3 경로 편의성 점수 (30점 만점)

```typescript
RouteConvenienceScore =
  (TransferPenalty × 0.4) +
  (CongestionScore × 0.3) +
  (WalkingDistanceScore × 0.3)
```

#### (1) 환승 페널티 (12점 만점, 감점 방식)

```typescript
TransferPenalty = 12 - (환승_횟수 × 3)

// 예시
환승 0회 (직통) → 12점 ⭐
환승 1회 → 9점
환승 2회 → 6점
환승 3회 → 3점
환승 4회 이상 → 0점 ❌
```

#### (2) 혼잡도 점수 (9점 만점)

```typescript
CongestionScore = 기준_혼잡도_점수 - (출퇴근_시간대_페널티)

// 기준 혼잡도
1호선, 2호선 → 6점 (혼잡)
3~7호선 → 8점 (보통)
8, 9호선, 신분당선 → 9점 (여유)

// 출퇴근 시간대 페널티 (07~09시, 18~20시)
-3점

// 예시
2호선 출퇴근 → 6 - 3 = 3점
2호선 낮 시간 → 6점
9호선 출퇴근 → 9 - 3 = 6점
```

#### (3) 도보 거리 점수 (9점 만점)

```typescript
WalkingDistanceScore = max(0, 9 - (총_도보_거리_m / 100))

// 예시
역 내 이동 50m → 9점 ⭐
역 내 이동 200m → 7점
역 내 이동 500m → 4점
역 내 이동 900m → 0점
```

### 3.4 길러 신뢰도 점수 (20점 만점)

```typescript
GillerReliabilityScore =
  (GillerRating × 0.6) +
  (ResponseTimeScore × 0.4)

// 평점 점수 (12점 만점)
GillerRating = (길러_평점 - 3.0) / 2.0 × 12

// 응답 시간 점수 (8점 만점)
ResponseTimeScore = max(0, 8 - (응답_시간_분 / 3))
```

---

## 4. 급행 열차 처리 로직

### 4.1 급행 종류

| 급행 종류 | 노선 | 정차역 수 | 비고 |
|----------|------|-----------|------|
| **특급** | 1호선 | 주요역만 | 청량리 ~ 천안 |
| **급행** | 1호선 | 중간역 일부 | |
| **급행** | 3호선 | 일부역 | |
| **급행** | 4호선 | 일부역 | |
| **ITX-청춘** | 경춘선 | | |
| **KTX** | 1호선 | | |
| **SRT** | 1호선 | | |
| **신분당선 급행** | 신분당 | | |

### 4.2 급행 정차역 데이터

```typescript
interface ExpressTrainInfo {
  line: string;
  type: 'special' | 'express' | 'itx' | 'ktx' | 'srt';
  trainNumber: string;

  // 정차역 목록
  stops: {
    stationId: string;
    stationName: string;
    arrivalTime?: string;
    departureTime?: string;
  }[];

  // 운행 시간
  operatingDays: number[];        // [1,2,3,4,5] or [1,2,3,4,5,6,7]
  firstTrain: string;
  lastTrain: string;

  // 운행 간격
  interval: number;               // 초 단위
}
```

### 4.3 급행 여부 판단

```typescript
function hasExpressRoute(startStation: Station, endStation: Station): {
  hasExpress: boolean;
  expressTypes: string[];
  timeSaved: number;              // 급행으로 절약되는 시간 (초)
} {
  // 1. 두 역이 같은 노선에 있는지 확인
  const commonLines = startStation.lines.filter(line =>
    endStation.lines.some(el => el.line === line.line)
  );

  if (commonLines.length === 0) {
    return { hasExpress: false, expressTypes: [], timeSaved: 0 };
  }

  // 2. 각 노선별 급행 확인
  const results = commonLines.map(line => {
    const expressData = getExpressDataForLine(line.line);
    const stops = expressData.stops;

    // 두 역 모두 급행 정차역인지 확인
    const startStop = stops.find(s => s.stationId === startStation.stationId);
    const endStop = stops.find(s => s.stationId === endStation.stationId);

    if (!startStop || !endStop) {
      return { hasExpress: false, expressTypes: [], timeSaved: 0 };
    }

    // 급행으로 절약되는 시간 계산
    const normalTime = getNormalTravelTime(startStation, endStation, line.line);
    const expressTime = getExpressTravelTime(startStop, endStop);
    const timeSaved = normalTime - expressTime;

    return {
      hasExpress: true,
      expressTypes: [expressData.type],
      timeSaved,
    };
  });

  // 최상의 급행 경로 선택
  const best = results.reduce((prev, curr) =>
    curr.timeSaved > prev.timeSaved ? curr : prev
  );

  return best;
}
```

---

## 5. 실제 매칭 예시

### 5.1 시나리오

```
요청: 서울역 → 강남역
수령 시간: 08:00~08:20
배송 마감: 09:00
물건: 소형 (가방에 들어감)
```

### 5.2 길러 후보

| 길러 | 동선 | 소요 시간 | 환승 | 급행 | 출발 시간 | 점수 |
|------|------|-----------|------|------|-----------|------|
| A | 서울역→강남역 (1호선→4호선→2호선) | 35분 | 2회 | X | 08:00 | 38점 |
| B | 서울역→강남역 (1호선→신분당선 급행) | 22분 | 1회 | ✅ | 08:05 | 62점 ⭐ |
| C | 서울역→역삼역 (1호선→2호선→신분당선) | 28분 | 2회 | ✅ | 08:10 | 45점 |

### 5.3 점수 계산 상세

**길러 B (우선):**
```
TimeEfficiencyScore:
  TravelTime: 22분 / 40분 = 0.55 → 30 - 16.5 = 13.5점
  Waiting: |08:05 - 08:10| = 5분 → 10 - (5/5) = 8점
  Schedule: 신분당 급행(2분 간격) → 10점
  → 13.5 + 8 + 10 = 31.5점 ✅

RouteConvenienceScore:
  Transfer: 1회 환승 → 12 - 3 = 9점
  Congestion: 신분당선 낮 시간 → 9점
  Walking: 150m → 6점
  → 9 + 9 + 6 = 24점 ✅

GillerReliabilityScore:
  Rating: 4.5 / 5.0 → 9점
  Response: 2분 → 8점
  → 9 + 8 = 17점 ✅

Total: 31.5 × 0.5 + 24 × 0.3 + 17 × 0.2
     = 15.75 + 7.2 + 3.4
     = 26.35점 (환산 100점 만점 기준)
```

---

## 6. 지하철 API 연동 대기 중 임시 방안

### 6.1 하드코딩된 주요 역 간 소요 시간

```typescript
const TRAVEL_TIME_MATRIX: Record<string, Record<string, number>> = {
  '150': {  // 서울역
    '222': 20 * 60,  // 강남역 (신분당선 급행): 20분
    '223': 22 * 60,  // 역삼역: 22분
    '221': 25 * 60,  // 선릉역: 25분
    '432': 35 * 60,  // 이촌역 (일반): 35분
  },
  // ... 더 많은 역
};
```

### 6.2 환승역 데이터

```typescript
const MAJOR_TRANSFER_STATIONS = [
  '150',  // 서울역 (1, 4, 경춘, KTX, SRT, 공항철도)
  '222',  // 강남역 (2, 신분당, 9호선)
  '234',  // 교대역 (2, 3, 9호선)
  '354',  // 고속터미널역 (3, 7, 9호선)
  // ... 30개 주요 환승역
];
```

### 6.3 급행 정차역

```typescript
const EXPRESS_STOPS = {
  '1': {
    special: ['150', '201', '202', '203', '204', '205', '300'],  // 서울~천안 특급
    express: ['150', '201', '202', '203', '204', '205'],
  },
  'sinbundang': {
    express: ['222', '223', '224', '225', '226', '227', '228'],
  },
  // ...
};
```

---

## 7. 다음 단계

### 7.1 지하철 API 수신 대기 중
- ✅ 매칭 알고리즘 기획 완료
- ✅ 데이터 구조 설계 완료
- ⏳ API 연동 대기 중

### 7.2 지금 당장 가능한 작업
1. **하드코딩된 데이터로 테스트 버전 구현**
   - 주요 30개 역 데이터
   - 급행 정보 포함
   - 환승 정보 포함

2. **매칭 로직 시뮬레이터 개발**
   - 웹에서 시나리오 테스트
   - 점수 계산 결과 확인

3. **Cloud Functions 구현 준비**
   - 의사 코드 작성
   - DB 구조 확정

어떤 작업을 먼저 진행할까요? 🛡️
