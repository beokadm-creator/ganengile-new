# 가는길에 - 실시간 배송 추격 시스템

## 공공데이터 포털 API

### 핵심 API
1. **서울특별시_지하철 실시간 도착정보**
   - 열차 도착 예정 시간 제공
   - API: https://api.odcloud.go.kr/...

2. **서울특별시_지하철 실시간 열차 위치정보**
   - 실시간 열차 위치 제공
   - API: https://api.odcloud.go.kr/...

---

## 배송 플로우 (실시간)

### 1. 매칭 완료
```
[글러] 배송 요청 생성
  ↓
[시스템] 길러 매칭
  ↓
[길러] 수락
```

### 2. 배송 시작 (길러가 역 출발)
```
[길러] "출발 버튼" 탭
  ↓
[Firebase Functions] 공공 API 호출 → 도착정보 조회
  ↓
[시스템] 도착 예상 시간 계산
  예: 현재 14:00, 서울역→강남역, 예상 도착 14:23
  ↓
[시스템] 글러에게 푸시 알림
  "길러가 출발했습니다. 예상 도착: 14:23"
  ↓
[수령자] 미리 준비 (역으로 이동)
```

### 3. 도착 알림
```
[길러] 도착역 근처 (1km 이내)
  ↓
[시스템] 글러에게 푸시
  "도착 임박! 5분 내에 도착합니다"
  ↓
[길러] 목적역 도착
  ↓
[시스템] 글러에게 푸시
  "길러가 도착했습니다. 수령場所: 3번 출구"
```

### 4. 수령 확인
```
[수령자] 길러를 만나서 물건 수령
  ↓
[수령자] "수령 확인" 버튼 탭 (또는 길러가 "전달 완료" 탭)
  - PIN 번호 4자리 입력 (보안)
  - 사진 증빙 (옵션)
  ↓
[시스템] 글러에게 알림
  "수령이 확인되었습니다. 완료!"
  ↓
[시스템] 보증금 환불 + 길러 수수료 지급
```

---

## Firebase Collections (수정)

### requests (수정)
```typescript
{
  requestId: string;
  cityCode: string;
  requesterId: string;
  courierId?: string;

  // 기존 필드
  pickupStationId: string;
  deliveryStationId: string;
  depositAmount: number;

  // 새 필드: 수령자 정보
  recipient: {
    name: string;           // 수령자 이름
    phone: string;          // 연락처
    pickupLocation: string; // 수령 장소 (예: "3번 출구 앞")
    notes?: string;         // 전달할 메모
  };

  // 새 필드: 예상 시간
  estimatedArrival?: Timestamp; // 도착 예상 시간
  estimatedDuration?: number;    // 예상 소요 시간 (분)
  actualArrival?: Timestamp;     // 실제 도착 시간

  // 새 필드: 알림 상태
  notifications: {
    departureSent: boolean;      // 출발 알림 전송 여부
    arrivalSent: boolean;        // 도착 알림 전송 여부
    completedAt?: Timestamp;     // 완료 시간
  };

  status: 'pending' | 'matched' | 'in_transit' | 'arrived' | 'completed' | 'cancelled';
}
```

### matches (수정)
```typescript
{
  matchId: string;
  requestId: string;
  courierId: string;

  // 새 필드: 실시간 추적
  tracking: {
    courierDepartedAt?: Timestamp;  // 길러 출발 시간
    estimatedArrivalAt?: Timestamp; // 예상 도착 시간
    actualArrivalAt?: Timestamp;    // 실제 도착 시간
    currentStationId?: string;      // 현재 위치 역 (실시간)
  };

  // 새 필드: 알림
  notifications: {
    departureSent: boolean;
    nearDestinationSent: boolean;
    arrivalSent: boolean;
  };

  // 새 필드: 수령 확인
  pickupVerification: {
    method: 'pin' | 'photo' | 'manual'; // 인증 방식
    pin?: string;                       // 4자리 PIN
    photoUrl?: string;                  // 사진 증빙
    verifiedAt?: Timestamp;             // 인증 시간
    verifiedBy: 'requester' | 'courier'; // 누가 확인했는지
  };

  status: 'accepted' | 'in_transit' | 'arrived' | 'completed' | 'cancelled';
}
```

---

## Firebase Functions (필요)

### 1. 출발 알림
```typescript
exports.onCourierDeparture = functions.firestore
  .document('matches/{matchId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // 길러가 출발 버튼을 누르면
    if (before.tracking.courierDepartedAt !== after.tracking.courierDepartedAt) {
      // 공공 API 호출 → 도착 예상 시간 계산
      const arrivalTime = await getArrivalTime(
        after.route.startStation,
        after.route.endStation
      );

      // 글러에게 푸시
      await sendPushNotification(after.requesterId, {
        title: '길러가 출발했습니다',
        body: `예상 도착: ${arrivalTime}`,
      });

      // Firestore 업데이트
      return change.after.ref.update({
        'tracking.estimatedArrivalAt': arrivalTime,
        'notifications.departureSent': true,
      });
    }
  });
```

### 2. 도착 근접 알림
```typescript
// 1km 이내 접근 시 알림
exports.onCourierNearDestination = functions.firestore
  .document('matches/{matchId}')
  .onUpdate(async (change, context) => {
    const after = change.after.data();
    const { currentStationId, endStationId } = after.tracking;

    // 현재 위치와 목적지 거리 계산
    const distance = getDistance(currentStationId, endStationId);

    if (distance < 1 && !after.notifications.nearDestinationSent) {
      await sendPushNotification(after.requesterId, {
        title: '도착 임박!',
        body: '5분 내에 도착합니다',
      });

      return change.after.ref.update({
        'notifications.nearDestinationSent': true,
      });
    }
  });
```

### 3. 수령 확인
```typescript
exports.verifyPickup = functions.https.onCall(async (data, context) => {
  const { matchId, pin, photoUrl } = data;

  // PIN 검증
  const match = await admin.firestore().collection('matches').doc(matchId).get();
  if (match.data().pickupVerification.pin !== pin) {
    throw new functions.https.HttpsError('permission-denied', 'PIN이 올바르지 않습니다');
  }

  // 인증 완료 처리
  await match.ref.update({
    'pickupVerification.verifiedAt': admin.firestore.Timestamp.now(),
    'pickupVerification.verifiedBy': context.auth.uid,
    status: 'completed',
  });

  // 길러에게 알림
  await sendPushNotification(match.data().courierId, {
    title: '수령 확인 완료',
    body: '배송이 완료되었습니다',
  });

  return { success: true };
});
```

---

## UI 화면 (추가)

### 1. CourierDepartureScreen (길러 전용)
```
┌─────────────────────────────┐
│ 배송 시작                    │
├─────────────────────────────┤
│ 출발역: 서울역               │
│ 목적지: 강남역               │
│                              │
│ [현재 위치 지도]             │
│                              │
│ [출발 버튼]                  │
│ "출발하시겠습니까?"          │
└─────────────────────────────┘
```

### 2. TrackingScreen (글러 전용)
```
┌─────────────────────────────┐
│ 배송 추적                    │
├─────────────────────────────┤
│ 길러: 김길러                 │
│                              │
│ 예상 도착: 14:23            │
│ 남은 시간: 23분             │
│                              │
│ [실시간 지도]                │
│ ● 출발역 ● 현재위치 ● 목적지 │
│                              │
│ 수령자: 홍길동               │
│ 연락처: 010-1234-5678        │
│ 수령 장소: 3번 출구 앞        │
└─────────────────────────────┘
```

### 3. PickupVerificationScreen (수령 확인)
```
┌─────────────────────────────┐
│ 수령 확인                    │
├─────────────────────────────┤
│ PIN 번호를 입력하세요         │
│                              │
│ [ _ _ _ _ ]                 │
│                              │
│ 또는                         │
│                              │
│ [사진 촬영]                  │
│                              │
│ [확인]                       │
└─────────────────────────────┘
```

---

## 보안 규칙 (PIN)

### PIN 생성 (배송 매칭 시)
```typescript
// 4자리 무작위 PIN 생성
const pin = Math.floor(1000 + Math.random() * 9000).toString();

// 글러와 길러 모두에게 전달
// 글러: 앱 화면에 표시
// 길러: 푸시 알림으로 전송
```

### PIN 인증
- 글러 또는 길러가 수령 시 입력
- 3회 실패 시 관리자 연락
- 성공 시 배송 완료 처리

---

## 구현 순서 (수정)

### Phase 1: 기본 구조
- [ ] 네비게이션
- [ ] Auth
- [ ] 기본 화면

### Phase 2: 핵심 기능
- [ ] 배송 요청 (수령자 정보 포함)
- [ ] 동선 등록
- [ ] 경로 매칭

### Phase 3: 실시간 추적 (NEW)
- [ ] 공공 API 연동
- [ ] 출발 알림
- [ ] 도착 예상 시간 계산
- [ ] 실시간 추적 화면

### Phase 4: 수령 확인 (NEW)
- [ ] PIN 생성/인증
- [ ] 수령 확인 화면
- [ ] 사진 증빙 (옵션)

### Phase 5: 결제
- [ ] Toss Payments
- [ ] 보증금
- [ ] 환불

---

_기획일: 2026년 2월 4일_
_발견: 공공데이터 포털 실시간 도착 정보 API_
_영향: 수령자 정보, 도착 예상 시간, PIN 인증 추가_
