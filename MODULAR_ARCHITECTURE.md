# 가는길에 - 모듈형 아키텍처 설계

## 개요

각 기능을 **독립된 모듈**로 분리하고, 모듈 간 **이벤트 기반 통신**으로 연결성을 유지합니다.
새로운 기능이 추가되어도 기존 코드에 영향을 주지 않고 **확장 가능**한 구조입니다.

---

## 🏗️ 아키텍처 원칙

### **SOLID 원칙 적용**

1. **Single Responsibility:** 각 모듈은 하나의 책임만 가짐
2. **Open/Closed:** 확장에는 열려 있고, 수정에는 닫혀 있음
3. **Liskov Substitution:** 모듈은 인터페이스로 교체 가능
4. **Interface Segregation:** 클라이언트는 사용하지 않는 인터페이스에 의존하지 않음
5. **Dependency Inversion:** 상위 모듈은 하위 모듈에 의존하지 않음

### **모듈 특성**

- **독립성:** 각 모듈은 독립적으로 배포 가능
- **상호 운용성:** 모듈 간 표준화된 인터페이스로 통신
- **확장성:** 새로운 모듈을 쉽게 추가 가능
- **테스트 가능성:** 각 모듈을 독립적으로 테스트 가능

---

## 📦 모듈 구조

### Core Modules (핵심)
```
core/
├── auth/              # 인증 모듈
├── user/              # 사용자 모듈
├── location/          # 위치/지하철역 모듈
├── notification/      # 알림 모듈
└── payment/           # 결제 모듈
```

### Business Modules (비즈니스)
```
business/
├── matching/          # 매칭 모듈
├── delivery/          # 배송 모듈
├── giller/            # 길러 모듈
├── gler/              # 글러 모듈
├── pro-giller/        # 전문 길러 모듈 (확장)
├── logistics/         # 운송사업자 모듈 (확장)
├── cargo/             # 화물 모듈 (확장)
└── location-partner/  # 위상사업자 모듈 (확장)
```

### Infrastructure Modules (인프라)
```
infrastructure/
├── realtime/          # 실시간 추적 모듈
├── analytics/         # 분석 모듈
├── audit/             # 감사 로그 모듈
└── cache/             # 캐싱 모듈
```

---

## 🔌 모듈 인터페이스

### **BaseModule Interface**

```typescript
// modules/core/types/Module.ts
export interface Module {
  readonly name: string;
  readonly version: string;
  
  // 라이프사이클
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  
  // 이벤트
  on(event: string, handler: Function): void;
  emit(event: string, data: any): void;
  
  // 상태
  getStatus(): ModuleStatus;
}

export enum ModuleStatus {
  IDLE = 'idle',
  INITIALIZING = 'initializing',
  RUNNING = 'running',
  STOPPING = 'stopping',
  ERROR = 'error'
}
```

---

## 📋 모듈별 상세 설계

### 1. Auth Module (인증)

**책임:** 사용자 인증, 권한 관리

```typescript
// modules/auth/AuthModule.ts
export class AuthModule implements Module {
  readonly name = 'auth';
  readonly version = '1.0.0';

  async initialize() {
    // Firebase Auth 초기화
  }

  // 메서드
  async signUp(email: string, password: string): Promise<User>;
  async signIn(email: string, password: string): Promise<User>;
  async signOut(): Promise<void>;
  async resetPassword(email: string): Promise<void>;
  
  // 토큰 관리
  async getCustomClaims(uid: string): Promise<CustomClaims>;
  async setCustomClaims(uid: string, claims: object): Promise<void>;
  
  // 이벤트
  onUserSignedIn: Event<User>;
  onUserSignedOut: Event<void>;
}
```

**확장 포인트:**
- 소셜 로그인 (Google, Apple)
- 생체 인증 (FaceID, TouchID)
- 2FA (이중 인증)

---

### 2. User Module (사용자)

**책임:** 사용자 정보 CRUD, 프로필 관리

```typescript
// modules/user/UserModule.ts
export class UserModule implements Module {
  readonly name = 'user';
  readonly version = '1.0.0';

  async initialize() {
    // Firestore users collection 초기화
  }

  // 메서드
  async createUser(data: CreateUserData): Promise<User>;
  async getUser(uid: string): Promise<User>;
  async updateUser(uid: string, data: UpdateUserData): Promise<User>;
  async deleteUser(uid: string): Promise<void>;
  
  // 사용자 타입별 메서드
  async upgradeToProGiller(uid: string, data: ProGillerData): Promise<void>;
  async registerLogisticsPartner(data: LogisticsData): Promise<void>;
  
  // 이벤트
  onUserCreated: Event<User>;
  onUserUpdated: Event<User>;
  onUserDeleted: Event<void>;
}
```

**확장 포인트:**
- 사용자 타입 추가 (예: franchisee - 가맹주)
- 사용자 등급 시스템 (Bronze, Silver, Gold)

---

### 3. Location Module (위치/지하철역)

**책임:** 지하철역 데이터, 위치 기반 서비스

```typescript
// modules/location/LocationModule.ts
export class LocationModule implements Module {
  readonly name = 'location';
  readonly version = '1.0.0';

  async initialize() {
    // stations collection 초기화
    // 공공 API 연동
  }

  // 메서드
  async searchStations(query: string): Promise<Station[]>;
  async getStation(stationId: string): Promise<Station>;
  async getNearbyStations(lat: number, lng: number): Promise<Station[]>;
  async calculateDistance(from: Station, to: Station): Promise<number>;
  
  // 공공 API
  async getRealtimeArrival(stationId: string): Promise<ArrivalInfo>;
  async getTrainLocation(trainId: string): Promise<LocationInfo>;
  
  // 이벤트
  onStationDataUpdated: Event<Station[]>;
  onTrainArrival: Event<ArrivalInfo>;
}
```

**확장 포인트:**
- 버스 정류장 데이터
- 도시별 확장 (부산, 대구)
- 자전거 대여소 연동

---

### 4. Matching Module (매칭)

**책임:** 글러와 길러 매칭

```typescript
// modules/matching/MatchingModule.ts
export class MatchingModule implements Module {
  readonly name = 'matching';
  readonly version = '1.0.0';

  async initialize() {
    // 매칭 알고리즘 초기화
  }

  // 메서드
  async createMatch(requestId: string, preferences: MatchPreferences): Promise<Match>;
  async acceptMatch(matchId: string, courierId: string): Promise<void>;
  async rejectMatch(matchId: string, courierId: string): Promise<void>;
  async cancelMatch(matchId: string): Promise<void>;
  
  // 매칭 전략 (전략 패턴)
  private matchingStrategies: MatchingStrategy[] = [
    new ProGillerMatchingStrategy(),      // 1순위
    new StandardGillerMatchingStrategy(), // 2순위
    new LogisticsPartnerMatchingStrategy(), // 3순위
    new CargoMatchingStrategy(),          // 카고
  ];
  
  // 이벤트
  onMatchCreated: Event<Match>;
  onMatchAccepted: Event<Match>;
  onMatchCompleted: Event<Match>;
}
```

**매칭 전략 인터페이스:**

```typescript
// modules/matching/strategies/MatchingStrategy.ts
export interface MatchingStrategy {
  name: string;
  priority: number;
  
  canHandle(request: DeliveryRequest): boolean;
  findCouriers(request: DeliveryRequest): Promise<Courier[]>;
  calculateScore(courier: Courier, request: DeliveryRequest): Promise<number>;
}

// 예시: 전문 길러 매칭 전략
export class ProGillerMatchingStrategy implements MatchingStrategy {
  name = 'pro-giller';
  priority = 1;
  
  canHandle(request: DeliveryRequest): boolean {
    return request.preferredCourierType === 'full_time' 
        || request.deliveryType === 'express';
  }
  
  async findCouriers(request: DeliveryRequest): Promise<Courier[]> {
    // 반경 3km, 평점 4.5+, 장비 보유
  }
  
  async calculateScore(courier: Courier, request: DeliveryRequest): Promise<number> {
    // 거리, 평점, 응답 시간 기반 점수 계산
  }
}
```

**확장 포인트:**
- 새로운 매칭 전략 추가 (예: EcoGillerMatchingStrategy - 전기차만)
- A/B 테스트 지원

---

### 5. Delivery Module (배송)

**책임:** 배송 플로우 관리

```typescript
// modules/delivery/DeliveryModule.ts
export class DeliveryModule implements Module {
  readonly name = 'delivery';
  readonly version = '1.0.0';

  async initialize() {
    // 배송 상태 머신 초기화
  }

  // 메서드
  async createDelivery(request: DeliveryRequest): Promise<Delivery>;
  async startDelivery(deliveryId: string): Promise<void>;
  async updateDeliveryStatus(deliveryId: string, status: DeliveryStatus): Promise<void>;
  async completeDelivery(deliveryId: string): Promise<void>;
  
  // 상태 머신
  private stateMachine: StateMachine<DeliveryStatus>;
  
  // 이벤트
  onDeliveryCreated: Event<Delivery>;
  onDeliveryStarted: Event<Delivery>;
  onDeliveryCompleted: Event<Delivery>;
}
```

**배송 상태:**

```typescript
export enum DeliveryStatus {
  // 표준
  PENDING = 'pending',
  MATCHED = 'matched',
  IN_TRANSIT = 'in_transit',
  ARRIVED = 'arrived',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  
  // 카고
  QUOTE_REQUESTED = 'quote_requested',
  QUOTE_RECEIVED = 'quote_received',
  SCHEDULED = 'scheduled',
}
```

**확장 포인트:**
- 배송 상태 추가
- 배송 템플릿 (자주 사용하는 경로)

---

### 6. Giller Module (길러)

**책임:** 길러 관리, 동선 관리

```typescript
// modules/giller/GillerModule.ts
export class GillerModule implements Module {
  readonly name = 'giller';
  readonly version = '1.0.0';

  async initialize() {
    // 길러 관련 초기화
  }

  // 메서드
  async registerRoute(userId: string, route: RouteData): Promise<Route>;
  async getRoutes(userId: string): Promise<Route[]>;
  async updateRoute(routeId: string, data: UpdateRouteData): Promise<Route>;
  async deleteRoute(routeId: string): Promise<void>;
  
  // 활동 상태
  async setActivityStatus(userId: string, isActive: boolean): Promise<void>;
  async getActiveGillers(location: GeoPoint): Promise<Giller[]>;
  
  // 이벤트
  onRouteRegistered: Event<Route>;
  onGillerAvailable: Event<Giller>;
}
```

**확장 포인트:**
- 길러 등급 시스템
- 길러 추천 시스템

---

### 7. Pro Giller Module (전문 길러) ★ 확장

**책임:** 전문 길러 관리, 장비 관리

```typescript
// modules/pro-giller/ProGillerModule.ts
export class ProGillerModule extends GillerModule {
  readonly name = 'pro-giller';
  readonly version = '1.0.0';

  async initialize() {
    await super.initialize();
    // 전문 길러 초기화
  }

  // 추가 메서드
  async applyForProGiller(userId: string, data: ProGillerApplication): Promise<void>;
  async verifyEquipment(userId: string, equipment: Equipment): Promise<void>;
  async updateEarnings(userId: string, earnings: EarningsData): Promise<void>;
  
  // 프리미엄 기능
  async enableMultiDrop(userId: string): Promise<void>;
  async enableInstantPay(userId: string): Promise<void>;
  
  // 이벤트
  onProGillerApproved: Event<ProGiller>;
  onEquipmentVerified: Event<Equipment>;
}
```

**확장 포인트:**
- 장비 렌탈 시스템
- 교육 프로그램 연동

---

### 8. Logistics Partner Module (운송사업자) ★ 확장

**책임:** 운송사업자 관리, 라이더 관리

```typescript
// modules/logistics/LogisticsModule.ts
export class LogisticsModule implements Module {
  readonly name = 'logistics';
  readonly version = '1.0.0';

  async initialize() {
    // 운송사업자 초기화
  }

  // 메서드
  async registerPartner(data: PartnerApplication): Promise<LogisticsPartner>;
  async getPartner(partnerId: string): Promise<LogisticsPartner>;
  async updateSLA(partnerId: string, sla: SLAData): Promise<void>;
  
  // 라이더 관리
  async addRider(partnerId: string, riderId: string): Promise<void>;
  async removeRider(partnerId: string, riderId: string): Promise<void>;
  async getActiveRiders(partnerId: string): Promise<Rider[]>;
  
  // API
  async dispatchToPartner(partnerId: string, request: DeliveryRequest): Promise<DispatchResult>;
  
  // 이벤트
  onPartnerRegistered: Event<LogisticsPartner>;
  onSLAViolation: Event<SLAViolation>;
}
```

**확장 포인트:**
- 자사 라이더 매칭 API
- SLA 자동 모니터링

---

### 9. Cargo Module (화물) ★ 확장

**책임:** 대형 물품 배송, 견적 시스템

```typescript
// modules/cargo/CargoModule.ts
export class CargoModule implements Module {
  readonly name = 'cargo';
  readonly version = '1.0.0';

  async initialize() {
    // 화물 모듈 초기화
  }

  // 메서드
  async requestQuote(request: CargoRequest): Promise<Quote[]>;
  async acceptQuote(quoteId: string): Promise<CargoDelivery>;
  async scheduleDelivery(deliveryId: string, schedule: Schedule): Promise<void>;
  
  // 화물 특화
  async calculateVolume(dimensions: Dimensions): Promise<number>;
  async estimateWeight(item: CargoItem): Promise<number>;
  async checkVehicleAvailability(vehicleType: string): Promise<boolean>;
  
  // 이벤트
  onQuoteReceived: Event<Quote>;
  onCargoScheduled: Event<CargoDelivery>;
}
```

**확장 포인트:**
- 특수 화물 (예: 예술품, 위험물질)
- 국제 배송

---

### 10. Location Partner Module (위상사업자) ★ 확장

**책임:** 수령 장소 관리

```typescript
// modules/location-partner/LocationPartnerModule.ts
export class LocationPartnerModule implements Module {
  readonly name = 'location-partner';
  readonly version = '1.0.0';

  async initialize() {
    // 위상사업자 초기화
  }

  // 메서드
  async registerPartner(data: LocationPartnerApplication): Promise<LocationPartner>;
  async getNearbyPartners(stationId: string): Promise<LocationPartner[]>;
  async checkCapacity(partnerId: string): Promise<number>;
  
  // 수령 관리
  async processPickup(partnerId: string, pickup: Pickup): Promise<void>;
  async verifyPickupCode(partnerId: string, code: string): Promise<boolean>;
  
  // 이벤트
  onPartnerRegistered: Event<LocationPartner>;
  onPickupCompleted: Event<Pickup>;
}
```

**확장 포인트:**
- 보관 시간 연장
- 보관함 IoT 연동

---

### 11. Realtime Module (실시간 추적)

**책임:** 실시간 위치 추적, 공공 API 연동

```typescript
// modules/realtime/RealtimeModule.ts
export class RealtimeModule implements Module {
  readonly name = 'realtime';
  readonly version = '1.0.0';

  async initialize() {
    // 공공 API 연동
    // WebSocket 연결
  }

  // 메서드
  async startTracking(deliveryId: string): Promise<void>;
  async stopTracking(deliveryId: string): Promise<void>;
  async getCurrentLocation(deliveryId: string): Promise<Location>;
  
  // 공공 API
  async getArrivalTime(stationId: string): Promise<ArrivalTime>;
  async getTrainLocation(trainId: string): Promise<TrainLocation>;
  
  // 폴링/캐싱
  private pollingInterval: number = 30000; // 30초
  private cache: Map<string, ArrivalTime>;
  
  // 이벤트
  onLocationUpdated: Event<Location>;
  onArrivalTimeUpdated: Event<ArrivalTime>;
}
```

**확장 포인트:**
- 실시간 지도 표시
- 도착 알림 푸시

---

### 12. Notification Module (알림)

**책임:** 푸시 알림, 이메일, SMS

```typescript
// modules/notification/NotificationModule.ts
export class NotificationModule implements Module {
  readonly name = 'notification';
  readonly version = '1.0.0';

  async initialize() {
    // Firebase Cloud Messaging 초기화
  }

  // 메서드
  async sendPush(userId: string, notification: PushNotification): Promise<void>;
  async sendEmail(to: string, email: Email): Promise<void>;
  async sendSMS(to: string, message: string): Promise<void>;
  
  // 템플릿
  async sendMatchNotification(userId: string, match: Match): Promise<void>;
  async sendDepartureNotification(userId: string, delivery: Delivery): Promise<void>;
  async sendArrivalNotification(userId: string, delivery: Delivery): Promise<void>;
  
  // 이벤트
  onNotificationSent: Event<Notification>;
}
```

**확장 포인트:**
- 알림 템플릿 추가
- 알림 예약 (스케줄링)

---

### 13. Payment Module (결제)

**책임:** 결제, 정산, 환불

```typescript
// modules/payment/PaymentModule.ts
export class PaymentModule implements Module {
  readonly name = 'payment';
  readonly version = '1.0.0';

  async initialize() {
    // Toss Payments 연동
  }

  // 메서드
  async createPayment(payment: PaymentRequest): Promise<Payment>;
  async capturePayment(paymentId: string): Promise<void>;
  async refundPayment(paymentId: string, amount?: number): Promise<Refund>;
  
  // 정산
  async settleToGiller(deliveryId: string): Promise<Settlement>;
  async settleToLogistics(partnerId: string): Promise<Settlement>;
  
  // 보증금
  async holdDeposit(userId: string, amount: number): Promise<void>;
  async releaseDeposit(depositId: string): Promise<void>;
  
  // 이벤트
  onPaymentCompleted: Event<Payment>;
  onSettlementCompleted: Event<Settlement>;
}
```

**확장 포인트:**
- 결제 수단 추가 (간편결제, 카카오페이)
- 정산 주기 변경

---

## 🔄 모듈 간 통신

### **이벤트 버스 (Event Bus)**

```typescript
// core/EventBus.ts
export class EventBus {
  private listeners: Map<string, Function[]> = new Map();

  subscribe(event: string, handler: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }

  publish(event: string, data: any): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }
}

// 전역 이벤트 버스
export const eventBus = new EventBus();
```

### **이벤트 정의**

```typescript
// core/events/ModuleEvents.ts
export enum ModuleEvent {
  // Auth
  USER_SIGNED_IN = 'auth:user.signed_in',
  USER_SIGNED_OUT = 'auth:user.signed_out',
  
  // User
  USER_CREATED = 'user:user.created',
  USER_UPDATED = 'user:user.updated',
  
  // Delivery
  DELIVERY_CREATED = 'delivery:delivery.created',
  DELIVERY_STARTED = 'delivery:delivery.started',
  DELIVERY_COMPLETED = 'delivery:delivery.completed',
  
  // Matching
  MATCH_CREATED = 'matching:match.created',
  MATCH_ACCEPTED = 'matching:match.accepted',
  
  // Realtime
  LOCATION_UPDATED = 'realtime:location.updated',
  ARRIVAL_TIME_UPDATED = 'realtime:arrival.updated',
  
  // Notification
  NOTIFICATION_SENT = 'notification:notification.sent',
}
```

### **통신 예시**

```typescript
// 예시: 배송 생성 시 알림 발송

// 1. DeliveryModule이 배송 생성 이벤트 발행
class DeliveryModule {
  async createDelivery(request: DeliveryRequest): Promise<Delivery> {
    const delivery = await this.saveDelivery(request);
    
    // 이벤트 발행
    eventBus.publish(ModuleEvent.DELIVERY_CREATED, delivery);
    
    return delivery;
  }
}

// 2. NotificationModule이 이벤트 수신
class NotificationModule {
  async initialize() {
    // 이벤트 구독
    eventBus.subscribe(ModuleEvent.DELIVERY_CREATED, async (delivery) => {
      await this.sendPush(delivery.glerId, {
        title: '새 배송 요청',
        body: `${delivery.pickupStation} → ${delivery.deliveryStation}`,
      });
    });
  }
}
```

---

## 🔌 새로운 모듈 추가 방법

### **예시: 프랜차이즈 모듈 추가**

#### 1. 모듈 정의

```typescript
// modules/franchise/FranchiseModule.ts
export class FranchiseModule implements Module {
  readonly name = 'franchise';
  readonly version = '1.0.0';

  async initialize() {
    console.log('Franchise module initialized');
  }

  // 메서드
  async registerFranchise(data: FranchiseApplication): Promise<Franchise>;
  async getFranchise(franchiseId: string): Promise<Franchise>;
  async updateFranchise(franchiseId: string, data: UpdateFranchiseData): Promise<Franchise>;
  
  // 이벤트
  onFranchiseRegistered: Event<Franchise>;
}
```

#### 2. 이벤트 정의

```typescript
// core/events/ModuleEvents.ts에 추가
export enum ModuleEvent {
  // ... 기존 이벤트
  
  // Franchise
  FRANCHISE_REGISTERED = 'franchise:franchise.registered',
  FRANCHISE_UPDATED = 'franchise:franchise.updated',
}
```

#### 3. 모듈 등록

```typescript
// AppModule.ts
export class AppModule {
  private modules: Module[] = [
    new AuthModule(),
    new UserModule(),
    new DeliveryModule(),
    // ...
    new FranchiseModule(), // 새 모듈 추가
  ];

  async initialize() {
    for (const module of this.modules) {
      await module.initialize();
    }
  }
}
```

#### 4. Firebase Collections (선택)

```typescript
// franchises collection
{
  franchiseId: string;
  userId: string;
  businessInfo: { ... };
  territories: string[];  // 담당 구역
  commissionRate: number;
  createdAt: Timestamp;
}
```

---

## 📁 폴더 구조

```
ganengile-new/
├── src/
│   ├── modules/              # 모듈 폴더
│   │   ├── core/            # 핵심 모듈
│   │   │   ├── auth/
│   │   │   │   ├── AuthModule.ts
│   │   │   │   ├── types.ts
│   │   │   │   └── events.ts
│   │   │   ├── user/
│   │   │   ├── location/
│   │   │   ├── notification/
│   │   │   └── payment/
│   │   │
│   │   ├── business/        # 비즈니스 모듈
│   │   │   ├── matching/
│   │   │   ├── delivery/
│   │   │   ├── giller/
│   │   │   ├── gler/
│   │   │   ├── pro-giller/     # 확장
│   │   │   ├── logistics/       # 확장
│   │   │   ├── cargo/           # 확장
│   │   │   └── location-partner/ # 확장
│   │   │
│   │   └── infrastructure/ # 인프라 모듈
│   │       ├── realtime/
│   │       ├── analytics/
│   │       ├── audit/
│   │       └── cache/
│   │
│   ├── core/               # 공통
│   │   ├── EventBus.ts
│   │   ├── Module.ts
│   │   └── events/
│   │       └── ModuleEvents.ts
│   │
│   ├── screens/            # UI (모듈 독립적)
│   ├── components/
│   ├── services/           # 모듈 서비스
│   └── types/
│
├── App.tsx
├── package.json
└── README.md
```

---

## 🎯 구현 순서 (모듈별)

### Phase 1: 코어 모듈
- [ ] AuthModule
- [ ] UserModule
- [ ] LocationModule
- [ ] EventBus

### Phase 2: 기본 비즈니스
- [ ] GillerModule
- [ ] GlerModule
- [ ] MatchingModule
- [ ] DeliveryModule

### Phase 3: 확장 모듈
- [ ] ProGillerModule
- [ ] LogisticsModule
- [ ] LocationPartnerModule

### Phase 4: 고급 기능
- [ ] CargoModule
- [ ] RealtimeModule
- [ ] PaymentModule

### Phase 5: 인프라
- [ ] NotificationModule
- [ ] AnalyticsModule
- [ ] AuditModule

---

## 📊 모듈 간 의존성

```
                    ┌─────────────┐
                    │  EventBus  │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐      ┌─────▼─────┐     ┌─────▼─────┐
   │   Auth   │      │   User    │     │  Location │
   └──────────┘      └───────────┘     └───────────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                    ┌──────▼──────┐
                    │  Matching   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  Delivery   │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼─────┐     ┌─────▼─────┐     ┌─────▼─────┐
   │ ProGiller │     │ Logistics │     │   Cargo   │
   └──────────┘     └───────────┘     └───────────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                    ┌──────▼──────┐
                    │ Realtime    │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │Notification │
                    └─────────────┘
```

---

## ✅ 모듈화의 이점

### **1. 독립적 개발**
- 각 모듈을 독립적으로 개발, 테스트, 배포 가능
- 팀별 병렬 작업 가능

### **2. 쉬운 확장**
- 새로운 모듈 추가가 기존 코드에 영향 없음
- 플러그인 방식으로 기능 추가

### **3. 유지보수성**
- 버그가 발생한 모듈만 수정
- 영향 범위 최소화

### **4. 재사용성**
- 모듈을 다른 프로젝트에 재사용 가능
- 표준화된 인터페이스

---

## 🚀 다음 단계

1. **기획서 기반으로 모듈 구현 시작**
   - Phase 1 (코어 모듈)부터
   - 각 모듈 독립적으로 개발

2. **모듈 간 통신 테스트**
   - EventBus 테스트
   - 이벤트 발행/구독 테스트

3. **UI/UX 설계 (제미나이)**
   - 모듈별 화면 설계
   - 화면 간 연결성 유지

---

_기획일: 2026년 2월 5일_
_설계: 모듈형 아키텍처_
_확장성: 독립적 모듈 추가 가능_
_연결성: 이벤트 버스 기반 통신_
