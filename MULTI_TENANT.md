# 가는길에 - 멀티테넌트 아키텍처 설계

## 확장성 고려사항

### 1. 다중 도시 지원
- 초기: 서울 (1~9호선)
- 확장: 부산, 대구, 광주 등
- 국제: 도쿄, 상하이 등 (나중에)

### 2. 도시별 설정 차이
- 기본 보증금 비율
- 최대 배송 거리
- 운영 시간
- 지원 지하철 노선

---

## 데이터 구조

### Firestore Collections

#### cities (도시 설정)
```typescript
{
  cityCode: string;      // "SEOUL", "BUSAN"
  name: string;
  nameEn: string;
  country: string;       // "KR", "JP"
  isActive: boolean;
  config: {
    baseDepositRate: number;    // 0.8 (80%)
    maxDistanceKm: number;      // 50
    currency: string;           // "KRW"
    timezone: string;           // "Asia/Seoul"
    supportedLines: string[];   // ["1호선", "2호선", ...]
  };
  launchedAt: admin.firestore.Timestamp;
}
```

#### stations (역 마스터)
```typescript
{
  stationId: string;     // "SEOUL-001"
  cityCode: string;      // "SEOUL"
  name: string;          // "서울역"
  nameEn?: string;       // "Seoul Station"
  line: string;          // "1호선"
  lineCode: string;      // "1001"
  location: {
    latitude: number;
    longitude: number;
  };
  aliases?: string[];    // ["서울", "Seoul Station"]
  isActive: boolean;
}
```

#### routes (사용자 동선)
```typescript
{
  routeId: string;
  userId: string;
  cityCode: string;      // ← 멀티테넌트
  startStationId: string;
  endStationId: string;
  departureTime: string; // "08:30"
  daysOfWeek: number[];  // [1,2,3,4,5]
  isActive: boolean;
  createdAt: admin.firestore.Timestamp;
}
```

#### requests (배송 요청)
```typescript
{
  requestId: string;
  cityCode: string;      // ← 멀티테넌트
  requesterId: string;
  courierId?: string;
  pickupStationId: string;
  deliveryStationId: string;
  // ...
}
```

---

## StationSearchScreen 설계

### UI 구조
```
┌─────────────────────────────┐
│   지하철역 검색              │
├─────────────────────────────┤
│ 🔍 검색어 입력               │
│    "서울"                   │
├─────────────────────────────┤
│ 📍 인기 역                  │
│   서울역, 강남역, ...       │
├─────────────────────────────┤
│ 🚇 1호선                    │
│   소양역 ← → ... ← → 서울역 │
├─────────────────────────────┤
│ 🚇 2호선                    │
│   ...                       │
└─────────────────────────────┘
```

### 검색 기능
1. **텍스트 검색:** 역명, 별명, 영문명
2. **노선별 필터:** 1호선, 2호선, ...
3. **최근 검색:** 사용자 기반
4. **자동완성:** 실시간 필터링

### Firestore Index
```typescript
// 복합 인덱스 필요
stations
  - cityCode (ASC)
  - name (ASC)
  - line (ASC)

// 쿼리 예시
db.collection('stations')
  .where('cityCode', '==', 'SEOUL')
  .where('name', '>=', searchQuery)
  .where('name', '<=', searchQuery + '\uf8ff')
  .limit(20)
```

---

## 데이터 전략 (Option C: 하이브리드)

### Phase 1: Firebase 마스터 데이터
```bash
# 초기화 스크립트
npm run import:stations -- --city=SEOUL

# 서울 1~9호선 역 데이터 bulk import
# 출처: 위키백과, 공공데이터포털
```

### Phase 2: 주기적 업데이트
```typescript
// Firebase Functions (Scheduled)
exports.syncStations = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async (context) => {
    // 공공 API에서 최신 데이터 가져오기
    // Firebase stations collection 업데이트
  });
```

### Phase 3: 실시간 기능
```typescript
// 열차 도착 정보 (클라이언트 직접 API 호출)
async function getTrainArrival(stationId: string) {
  const response = await fetch(
    `https://api.odcloud.go.kr/...?stationId=${stationId}`
  );
  return response.json();
}
```

---

## 초기화 스크립트 구조

### 서울 지하철역 데이터 예시
```typescript
// data/stations-seoul.ts
export const seoulStations = [
  {
    stationId: "SEOUL-001",
    cityCode: "SEOUL",
    name: "서울역",
    nameEn: "Seoul Station",
    line: "1호선",
    lineCode: "1001",
    location: { latitude: 37.5547, longitude: 126.9707 },
    aliases: ["서울", "Seoul Station"],
    isActive: true,
  },
  {
    stationId: "SEOUL-002",
    cityCode: "SEOUL",
    name: "시청",
    nameEn: "City Hall",
    line: "1호선",
    lineCode: "1002",
    location: { latitude: 37.5664, longitude: 126.9779 },
    isActive: true,
  },
  // ... 280개 역 (서울 1~9호선)
];

// Firestore import
await db.collection('stations').addMany(seoulStations);
```

---

## 구현 순서 (수정)

### Step 1.5: 데이터 초기화 (NEW)
- [ ] `data/stations-seoul.ts` 작성
- [ ] Firestore bulk import 스크립트
- [ ] `cities` collection 초기화 (서울)
- [ ] station 데이터 검증

### Step 2: StationSearchScreen
- [ ] UI 구현 (검색 바, 필터, 리스트)
- [ ] Firestore 쿼리 연동
- [ ] 자동완성 기능

### Step 3-5: 기존 계획 유지

---

## 다음 도시 확장 가이드

### 부산 확장 시
```typescript
// 1. cities collection 추가
await db.collection('cities').add({
  cityCode: "BUSAN",
  name: "부산",
  nameEn: "Busan",
  country: "KR",
  config: {
    baseDepositRate: 0.8,
    currency: "KRW",
    timezone: "Asia/Seoul",
    supportedLines: ["1호선", "2호선", "3호선", "4호선"],
  },
});

// 2. stations collection 추가
await db.collection('stations').addMany(busanStations);

// 3. 기존 코드 변경 없음 (cityCode만 다름)
```

---

_설계일: 2026년 2월 4일_
_설계자: OpenClaw + opencode 협업_
_멀티테넌트 지원: Seoul → Busan → Daegu → ..._
