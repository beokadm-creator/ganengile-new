# Config-Based Matching System Architecture

## 개요

하드코딩된 대신 **Firestore Config Collections**을 사용하여 지하철 데이터와 매칭 파라미터를 관리합니다.

---

## Config Collections 구조

```
config/
├── stations          # 역 정보
├── travel_times      # 소요 시간
├── express_trains    # 급행 열차
├── congestion        # 혼잡도
└── algorithm_params  # 매칭 알고리즘 파라미터
```

---

## 1. config_stations Collection

### Document Structure

```typescript
{
  stationId: string;           // "150"
  stationName: string;         // "서울역"
  stationNameEnglish: string;  // "Seoul Station"
  lines: [
    {
      lineId: string,          // "1"
      lineName: string,        // "1호선"
      lineCode: string,        // "150"
      lineColor: string,       // "#0052A4"
      lineType: string,        // "general" | "express" | "special"
    }
  ];
  location: {
    latitude: number;
    longitude: number;
  };
  isTransferStation: boolean;
  facilities: {
    hasElevator: boolean;
    hasEscalator: boolean;
  };
  isActive: boolean;
  region: string;              // "gangnam" | "jongno" | "mapo" etc
  priority: number;            // 매칭 우선순위 (1~10)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Example Document

```json
{
  "stationId": "150",
  "stationName": "서울역",
  "stationNameEnglish": "Seoul Station",
  "lines": [
    { "lineId": "1", "lineName": "1호선", "lineCode": "150", "lineColor": "#0052A4", "lineType": "general" },
    { "lineId": "4", "lineName": "4호선", "lineCode": "426", "lineColor": "#00A5DE", "lineType": "general" },
    { "lineId": "K4501", "lineName": "경춘선", "lineCode": "", "lineColor": "#0C8E72", "lineType": "general" },
    { "lineId": "airport", "lineName": "공항철도", "lineCode": "A01", "lineColor": "#0090D2", "lineType": "express" }
  ],
  "location": { "latitude": 37.5547, "longitude": 126.9707 },
  "isTransferStation": true,
  "facilities": { "hasElevator": true, "hasEscalator": true },
  "isActive": true,
  "region": "jongno",
  "priority": 10
}
```

---

## 2. config_travel_times Collection

### Document Structure

```typescript
{
  travelTimeId: string;        // "150-222" (from-to)
  fromStationId: string;       // "150"
  toStationId: string;         // "222"
  fromStationName: string;     // "서울역" (denormalized)
  toStationName: string;       // "강남역" (denormalized)
  
  // Travel time information
  normalTime: number;          // seconds (2100 = 35 minutes)
  expressTime?: number;        // seconds (1320 = 22 minutes)
  
  // Route details
  transferCount: number;       // 0, 1, 2, 3...
  transferStations: string[];  // ["D08"] (station IDs)
  hasExpress: boolean;
  
  // Additional info
  walkingDistance: number;     // meters
  distance: number;            // total distance in meters
  lineIds: string[];           // ["1", "sinbundang"] (lines used)
  
  // Quality
  reliability: number;         // 1-10 (data confidence)
  lastVerified: Timestamp;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Example Document

```json
{
  "travelTimeId": "150-222",
  "fromStationId": "150",
  "toStationId": "222",
  "fromStationName": "서울역",
  "toStationName": "강남역",
  "normalTime": 2100,
  "expressTime": 1320,
  "transferCount": 1,
  "transferStations": ["D08"],
  "hasExpress": true,
  "walkingDistance": 200,
  "distance": 8500,
  "lineIds": ["1", "sinbundang"],
  "reliability": 10,
  "lastVerified": { "seconds": 1736076000 },
  "isActive": true
}
```

---

## 3. config_express_trains Collection

### Document Structure

```typescript
{
  expressId: string;            // "sinbundang-express-1"
  lineId: string;               // "sinbundang"
  lineName: string;             // "신분당선"
  type: string;                 // "special" | "express" | "itx" | "ktx" | "srt" | "airport"
  typeName: string;             // "급행"
  
  // Operating schedule
  operatingDays: number[];      // [1,2,3,4,5] or [1,2,3,4,5,6,7]
  firstTrain: string;           // "05:30"
  lastTrain: string;            // "23:50"
  
  // Intervals (seconds)
  rushHourMorningInterval: number;
  rushHourEveningInterval: number;
  daytimeInterval: number;
  nightInterval: number;
  
  // Stops
  stops: [                     // Array of station IDs
    "D01", "D02", "D03", "D04",
    "D05", "D06", "D07", "D08",
    "D09", "D10", "D11"
  ];
  
  // Performance
  avgSpeed: number;             // km/h
  timeSavings: {                // Compared to general train
    "D05-D10": 360,            // 6 minutes saved
    "D08-D10": 180             // 3 minutes saved
  };
  
  isActive: boolean;
  seasonStart?: Timestamp;     // For seasonal trains
  seasonEnd?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Example Document

```json
{
  "expressId": "sinbundang-express-1",
  "lineId": "sinbundang",
  "lineName": "신분당선",
  "type": "express",
  "typeName": "급행",
  "operatingDays": [1, 2, 3, 4, 5, 6, 7],
  "firstTrain": "05:30",
  "lastTrain": "23:50",
  "rushHourMorningInterval": 180,
  "rushHourEveningInterval": 300,
  "daytimeInterval": 480,
  "nightInterval": 600,
  "stops": ["D01", "D02", "D03", "D04", "D05", "D06", "D07", "D08", "D09", "D10", "D11"],
  "avgSpeed": 45,
  "timeSavings": { "D05-D10": 360, "D08-D10": 180 },
  "isActive": true
}
```

---

## 4. config_congestion Collection

### Document Structure

```typescript
{
  congestionId: string;         // "line-1-rush-morning"
  lineId: string;               // "1"
  lineName: string;             // "1호선"
  
  // Congestion by time slot (1-10 scale)
  timeSlots: {
    earlyMorning: number;       // 05:00-07:00
    rushHourMorning: number;    // 07:00-09:00
    morning: number;            // 09:00-12:00
    lunch: number;              // 12:00-14:00
    afternoon: number;          // 14:00-18:00
    rushHourEvening: number;    // 18:00-20:00
    evening: number;            // 20:00-23:00
  };
  
  // Congestion by sections
  sections: [
    {
      stationId: string;
      stationName: string;
      congestionLevel: number;  // 1-10
    }
  ];
  
  // Metadata
  dataSource: string;           // "seoul-metro" | "crowdsourced"
  lastUpdated: Timestamp;
  isValid: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Example Document

```json
{
  "congestionId": "line-2-rush-morning",
  "lineId": "2",
  "lineName": "2호선",
  "timeSlots": {
    "earlyMorning": 3,
    "rushHourMorning": 10,
    "morning": 7,
    "lunch": 6,
    "afternoon": 8,
    "rushHourEvening": 10,
    "evening": 5
  },
  "sections": [
    { "stationId": "201", "stationName": "을지로입구", "congestionLevel": 9 },
    { "stationId": "222", "stationName": "강남역", "congestionLevel": 10 },
    { "stationId": "810", "stationName": "잠실역", "congestionLevel": 10 }
  ],
  "dataSource": "seoul-metro",
  "lastUpdated": { "seconds": 1736076000 },
  "isValid": true
}
```

---

## 5. config_algorithm_params Collection ⭐ 핵심

### Document Structure

```typescript
{
  paramId: string;              // "matching-weights-v1"
  version: string;              // "1.0", "1.1", etc.
  
  // Matching weights (total must be 1.0)
  weights: {
    timeEfficiency: number;     // 0.5 (50%)
    routeConvenience: number;   // 0.3 (30%)
    gillerReliability: number;  // 0.2 (20%)
  };
  
  // Time efficiency breakdown
  timeEfficiency: {
    travelTime: number;         // 0.6 (60% of timeEfficiency)
    waitingTime: number;        // 0.2 (20%)
    scheduleMatch: number;      // 0.2 (20%)
  };
  
  // Route convenience breakdown
  routeConvenience: {
    transferPenalty: number;    // 0.4 (40%)
    congestion: number;         // 0.3 (30%)
    walkingDistance: number;    // 0.3 (30%)
  };
  
  // Giller reliability breakdown
  gillerReliability: {
    rating: number;             // 0.6 (60%)
    responseTime: number;       // 0.4 (40%)
  };
  
  // Scoring parameters
  scoring: {
    // Travel time score (0-30)
    travelTime: {
      excellentMargin: number;  // 30 (minutes) → 30 points
      goodMargin: number;        // 15 (minutes) → 25 points
      acceptableMargin: number;  // 5 (minutes) → 20 points
      tightMargin: number;       // 0 (minutes) → 10 points
      impossibleMargin: number;  // <0 → 0 points
    };
    
    // Waiting time score (0-10)
    waitingTime: {
      maxWaitTime: number;       // 30 (minutes) for 0 points
      pointsPer5Minutes: number; // 1 point per 5 minutes
    };
    
    // Transfer penalty (0-12)
    transfer: {
      penaltyPerTransfer: number; // 3 points per transfer
      maxScore: number;          // 12 points (no transfer)
    };
    
    // Congestion score (0-9)
    congestion: {
      rushHourPenalty: number;   // -3 points during rush hour
      maxScore: number;          // 9 points
    };
    
    // Walking distance score (0-9)
    walkingDistance: {
      penaltyPer100m: number;    // 1 point per 100m
      maxScore: number;          // 9 points
    };
    
    // Rating score (0-12)
    rating: {
      minRating: number;         // 3.0
      maxRating: number;         // 5.0
      maxScore: number;          // 12 points
    };
    
    // Response time score (0-8)
    responseTime: {
      excellent: number;         // 0-5 minutes → 8 points
      good: number;              // 5-15 minutes → 5 points
      fair: number;              // 15-30 minutes → 3 points
      poor: number;              // >30 minutes → 0 points
    };
  };
  
  // Matching limits
  limits: {
    maxMatchesPerRequest: number;   // 5
    matchTimeoutMinutes: number;    // 5
    maxRetryCount: number;          // 3
    minScore: number;               // 20 (below this, don't match)
  };
  
  // Priority multipliers
  priorities: {
    proGillerMultiplier: number;        // 1.2 (20% bonus)
    premiumBusinessMultiplier: number;  // 1.15 (15% bonus)
    newGillerPenalty: number;           // 0.9 (10% penalty)
  };
  
  // Feature flags
  features: {
    enableExpressBonus: boolean;       // true
    enableCongestionPenalty: boolean;  // true
    enableRushHourPenalty: boolean;    // true
    enableTransferPenalty: boolean;    // true
    enableProGillerPriority: boolean;  // true
  };
  
  // Metadata
  isActive: boolean;
  description: string;
  createdBy: string;            // "admin" or user ID
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Example Document (Current Algorithm)

```json
{
  "paramId": "matching-weights-v1",
  "version": "1.0",
  "weights": {
    "timeEfficiency": 0.5,
    "routeConvenience": 0.3,
    "gillerReliability": 0.2
  },
  "timeEfficiency": {
    "travelTime": 0.6,
    "waitingTime": 0.2,
    "scheduleMatch": 0.2
  },
  "routeConvenience": {
    "transferPenalty": 0.4,
    "congestion": 0.3,
    "walkingDistance": 0.3
  },
  "gillerReliability": {
    "rating": 0.6,
    "responseTime": 0.4
  },
  "scoring": {
    "travelTime": {
      "excellentMargin": 30,
      "goodMargin": 15,
      "acceptableMargin": 5,
      "tightMargin": 0
    },
    "waitingTime": {
      "maxWaitTime": 30,
      "pointsPer5Minutes": 5
    },
    "transfer": {
      "penaltyPerTransfer": 3,
      "maxScore": 12
    },
    "congestion": {
      "rushHourPenalty": -3,
      "maxScore": 9
    },
    "walkingDistance": {
      "penaltyPer100m": 1,
      "maxScore": 9
    },
    "rating": {
      "minRating": 3.0,
      "maxRating": 5.0,
      "maxScore": 12
    },
    "responseTime": {
      "excellent": 5,
      "good": 15,
      "fair": 30
    }
  },
  "limits": {
    "maxMatchesPerRequest": 5,
    "matchTimeoutMinutes": 5,
    "maxRetryCount": 3,
    "minScore": 20
  },
  "priorities": {
    "proGillerMultiplier": 1.2,
    "premiumBusinessMultiplier": 1.15,
    "newGillerPenalty": 0.9
  },
  "features": {
    "enableExpressBonus": true,
    "enableCongestionPenalty": true,
    "enableRushHourPenalty": true,
    "enableTransferPenalty": true,
    "enableProGillerPriority": true
  },
  "isActive": true,
  "description": "초기 매칭 알고리즘 v1.0",
  "createdBy": "admin",
  "createdAt": { "seconds": 1736076000 },
  "updatedAt": { "seconds": 1736076000 }
}
```

---

## 6. config_regions Collection (선택)

### Document Structure

```typescript
{
  regionId: string;             // "gangnam", "jongno", "mapo", etc.
  regionName: string;           // "강남구"
  stationIds: string[];         // ["222", "223", "224"]
  
  // Region characteristics
  avgCongestion: number;        // 1-10
  businessDensity: number;       // 1-10 (many office buildings)
  populationDensity: number;    // 1-10
  
  // Matching preferences
  priority: number;             // 1-10 (higher = more priority)
  
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## 장점

### 1. **유연성 (Flexibility)**
- Firebase Console에서 직접 수정 가능
- 배포 없이 실시간 반영
- A/B 테스트 가능 (여러 paramId로 실험)

### 2. **확장성 (Scalability)**
- 역 개수 제한 없음 (30개 → 300개 → 전체)
- 새로운 노선 쉽게 추가 (신림선, GTX 등)
- 급행 열차 동적 추가

### 3. **유지보수 (Maintainability)**
- 데이터와 로직 분리
- 버전 관리 가능 (v1.0 → v1.1)
- 롤백 용이 (이전 설정으로 복구)

### 4. **API 연동 용이 (Seamless Integration)**
- 지하철 API 수신 후 데이터만 교체
- 알고리즘은 그대로 유지
- 데이터 품질 점수(reliability)로 자동 필터링

---

## 다음 단계

### 1. Config 초기화 스크립트
```typescript
// scripts/init-config.ts
import { initializeConfig } from './src/services/config-init';

await initializeConfig();
// → config collections에 초기 데이터 자동 생성
```

### 2. Config 서비스 구현
```typescript
// src/services/config-service.ts
export async function getStationConfig(stationId: string) {
  const doc = await getDoc(doc(db, 'config_stations', stationId));
  return doc.data();
}

export async function getTravelTimeConfig(fromId: string, toId: string) {
  const q = query(
    collection(db, 'config_travel_times'),
    where('fromStationId', '==', fromId),
    where('toStationId', '==', toId),
    where('isActive', '==', true)
  );
  // ...
}

export async function getAlgorithmParams() {
  const doc = await getDoc(doc(db, 'config_algorithm_params', 'matching-weights-v1'));
  return doc.data();
}
```

### 3. 매칭 엔진 개선
```typescript
// data/matching-engine.ts (수정)
import { getAlgorithmParams } from '../services/config-service';

export async function calculateMatchingScore(
  gillerRoute: GillerRoute,
  request: DeliveryRequest
): Promise<MatchingResult> {
  // Firebase에서 파라미터 동적 로드
  const params = await getAlgorithmParams();
  
  // params.weights, params.scoring 등 사용
  const timeScore = params.weights.timeEfficiency * 
    (calculateTravelTimeScore(gillerRoute, request, params.scoring.travelTime));
  
  // ...
}
```

---

어떻게 진행할까요? 

1. **Config 초기화 스크립트 작성** → Firebase에 config 데이터 자동 생성
2. **Config 서비스 구현** → Firestore에서 설정 읽기
3. **매칭 엔진 리팩토링** → Config 기반으로 동작하도록 수정

🛡️
