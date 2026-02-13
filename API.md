# API Documentation

## 📚 Table of Contents

- [Authentication API](#authentication-api)
- [User API](#user-api)
- [Route API](#route-api)
- [Delivery Request API](#delivery-request-api)
- [Matching API](#matching-api)
- [Delivery API](#delivery-api)
- [Rating API](#rating-api)

---

## Authentication API

### Register

```typescript
POST /api/auth/register
```

**Request Body:**
```typescript
{
  email: string;        // Required
  password: string;     // Required (min 6 chars)
  name: string;         // Required
  phone: string;        // Optional
  role: 'gller' | 'giller' | 'both';  // Default: 'both'
}
```

**Response (201 Created):**
```typescript
{
  success: true;
  data: {
    user: {
      uid: string;
      email: string;
      name: string;
      role: string;
      createdAt: string;
    };
    token: string;  // Firebase Auth token
  };
}
```

**Error (400 Bad Request):**
```typescript
{
  success: false;
  error: {
    code: 'auth/email-already-in-use';
    message: '이미 사용 중인 이메일입니다.';
  };
}
```

---

### Login

```typescript
POST /api/auth/login
```

**Request Body:**
```typescript
{
  email: string;    // Required
  password: string; // Required
}
```

**Response (200 OK):**
```typescript
{
  success: true;
  data: {
    user: {
      uid: string;
      email: string;
      name: string;
      role: string;
      currentRole: 'gller' | 'giller';
    };
    token: string;
  };
}
```

**Error (401 Unauthorized):**
```typescript
{
  success: false;
  error: {
    code: 'auth/wrong-password';
    message: '비밀번호가 올바르지 않습니다.';
  };
}
```

---

### Logout

```typescript
POST /api/auth/logout
```

**Headers:**
```typescript
Authorization: Bearer {token}
```

**Response (200 OK):**
```typescript
{
  success: true;
  message: '로그아웃되었습니다.';
}
```

---

## User API

### Get User Profile

```typescript
GET /api/users/:userId
```

**Headers:**
```typescript
Authorization: Bearer {token}
```

**Response (200 OK):**
```typescript
{
  success: true;
  data: {
    uid: string;
    email: string;
    name: string;
    phone: string;
    role: 'gller' | 'giller' | 'both';
    currentRole: 'gller' | 'giller';
    rating: number;           // 0.0 - 5.0
    totalRatings: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    gillerInfo?: {
      totalDeliveries: number;
      totalEarnings: number;
      equipment: {
        hasInsulatedBag: boolean;
        hasHeatedBag: boolean;
        vehicleType: 'walk' | 'bicycle' | 'scooter' | 'motorcycle';
      };
    };
    gllerInfo?: {
      totalRequests: number;
      successfulDeliveries: number;
    };
  };
}
```

---

### Update User Profile

```typescript
PATCH /api/users/:userId
```

**Headers:**
```typescript
Authorization: Bearer {token}
```

**Request Body:**
```typescript
{
  name?: string;
  phone?: string;
  currentRole?: 'gller' | 'giller';
  gillerInfo?: {
    equipment: {
      hasInsulatedBag: boolean;
      hasHeatedBag: boolean;
      vehicleType: 'walk' | 'bicycle' | 'scooter' | 'motorcycle';
    };
  };
}
```

**Response (200 OK):**
```typescript
{
  success: true;
  data: {
    uid: string;
    ...updatedUserData
  };
}
```

---

### Get User Stats

```typescript
GET /api/users/:userId/stats
```

**Response (200 OK):**
```typescript
{
  success: true;
  data: {
    totalRequests: number;     // For Gller
    totalDeliveries: number;   // For Giller
    totalEarnings: number;     // For Giller
    averageRating: number;    // 0.0 - 5.0
    completionRate: number;   // 0.0 - 1.0
    totalWarnings: number;
  };
}
```

---

## Route API

### Create Route

```typescript
POST /api/routes
```

**Headers:**
```typescript
Authorization: Bearer {token}
```

**Request Body:**
```typescript
{
  startStation: {
    name: string;      // Required: e.g., "서울역"
    line: string;       // Required: e.g., "1호선"
    lat: number;        // Required
    lng: number;        // Required
  };
  endStation: {
    name: string;      // Required
    line: string;       // Required
    lat: number;        // Required
    lng: number;        // Required
  };
  departureTime: string;  // Required: HH:mm format (24h)
  daysOfWeek: number[];   // Required: [1,2,3,4,5] for weekdays
}
```

**Validation Rules:**
- `departureTime`: Must be in HH:mm format (24h)
- `daysOfWeek`: Must be [1-5] for weekdays, [1-7] for all days
- Same start/end station: Not allowed
- Valid station names: Must exist in config_stations

**Response (201 Created):**
```typescript
{
  success: true;
  data: {
    routeId: string;
    userId: string;
    startStation: { name, line, lat, lng };
    endStation: { name, line, lat, lng };
    departureTime: string;
    daysOfWeek: number[];
    isActive: boolean;
    createdAt: string;
  };
}
```

**Error (400 Bad Request):**
```typescript
{
  success: false;
  error: {
    code: 'INVALID_ROUTE';
    message: '출발역과 도착역이 같을 수 없습니다.';
  };
}
```

---

### Get User Routes

```typescript
GET /api/routes?userId={userId}
```

**Response (200 OK):**
```typescript
{
  success: true;
  data: Route[];
}
```

---

### Update Route

```typescript
PATCH /api/routes/:routeId
```

**Request Body:** Same as Create Route

---

### Delete Route

```typescript
DELETE /api/routes/:routeId
```

**Response (200 OK):**
```typescript
{
  success: true;
  message: '동선이 삭제되었습니다.';
}
```

---

## Delivery Request API

### Create Request

```typescript
POST /api/requests
```

**Headers:**
```typescript
Authorization: Bearer {token}
```

**Request Body:**
```typescript
{
  pickupStation: {
    name: string;      // Required: e.g., "서울역"
    line: string;       // Required: e.g., "1호선"
  };
  deliveryStation: {
    name: string;      // Required: e.g., "강남역"
    line: string;       // Required: e.g., "2호선"
  };
  packageInfo: {
    size: 'small' | 'medium' | 'large';  // Required
    weight: 'light' | 'medium' | 'heavy'; // Required
    description?: string;                 // Optional
  };
  deadline?: string;      // Optional: ISO 8601 format
}
```

**Pricing (자동 계산):**
- Base fee: 3,000원
- Size surcharge: Small(0원), Medium(+500원), Large(+1,000원)
- Weight surcharge: Light(0원), Medium(+500원), Heavy(+1,000원)
- Urgency surcharge: +20%, +50% (based on deadline)

**Response (201 Created):**
```typescript
{
  success: true;
  data: {
    requestId: string;
    requesterId: string;
    pickupStation: { name, line };
    deliveryStation: { name, line };
    packageInfo: { size, weight, description };
    fee: {
      base: number;      // 3000
      sizeSurcharge: number;
      weightSurcharge: number;
      urgencySurcharge: number;
      total: number;     // Final fee
    };
    status: 'pending';
    createdAt: string;
  };
}
```

---

### Get Request

```typescript
GET /api/requests/:requestId
```

**Response (200 OK):**
```typescript
{
  success: true;
  data: {
    requestId: string;
    requesterId: string;
    pickupStation: { name, line };
    deliveryStation: { name, line };
    packageInfo: { size, weight, description };
    fee: { ... };
    status: 'pending' | 'matched' | 'in_progress' | 'completed' | 'cancelled';
    matchedGiller?: {
      gillerId: string;
      name: string;
      rating: number;
      totalDeliveries: number;
    };
    createdAt: string;
    completedAt?: string;
  };
}
```

---

## Matching API

### Find Matches

```typescript
GET /api/matches/:requestId
```

**Response (200 OK):**
```typescript
{
  success: true;
  data: {
    matches: [
      {
        rank: number;          // 1, 2, 3, ...
        gillerId: string;
        name: string;
        rating: number;        // 0.0 - 5.0
        totalDeliveries: number;
        routeMatchScore: number; // 0.0 - 1.0
        timeMatchScore: number;  // 0.0 - 1.0
        ratingScore: number;   // 0.0 - 1.0
        totalScore: number;    // 0.0 - 1.0
        estimatedTime: number;  // minutes
        fee: number;          // giller earnings
      }
    ];
  };
}
```

**Matching Algorithm (v1.0):**
1. Route match: 출발/도착역 일치 여부 (40%)
2. Time match: 출발 시간 일치 여부 (20%)
3. Rating: 기일러 평점 (30%)
4. Completion rate: 완료율 (10%)

---

### Accept Match

```typescript
POST /api/matches/:matchId/accept
```

**Request Body:**
```typescript
{
  requestId: string;  // Required
  gillerId: string;  // Required
}
```

**Response (200 OK):**
```typescript
{
  success: true;
  data: {
    matchId: string;
    status: 'accepted';
    createdAt: string;
  };
}
```

---

### Reject Match

```typescript
POST /api/matches/:matchId/reject
```

**Request Body:** Same as Accept Match

**Response (200 OK):**
```typescript
{
  success: true;
  message: '매칭이 거절되었습니다.';
  nextMatch?: { ... };  // 다음 후보 매칭
}
```

---

## Delivery API

### Start Delivery (Pickup Verified)

```typescript
POST /api/deliveries/:deliveryId/start
```

**Request Body:**
```typescript
{
  pickupCode: string;  // 6-digit code from requester
}
```

**Response (200 OK):**
```typescript
{
  success: true;
  data: {
    deliveryId: string;
    status: 'in_transit';
    pickupVerifiedAt: string;
    estimatedArrival: string;
  };
}
```

**Error (400 Bad Request):**
```typescript
{
  success: false;
  error: {
    code: 'INVALID_PICKUP_CODE';
    message: '올바른 픽업 코드가 아닙니다.';
  };
}
```

---

### Update Location (Giller)

```typescript
PATCH /api/deliveries/:deliveryId/location
```

**Request Body:**
```typescript
{
  latitude: number;
  longitude: number;
  station: string;      // Current station
  status: 'moving' | 'waiting' | 'arrived';
}
```

**Response (200 OK):**
```typescript
{
  success: true;
  data: {
    deliveryId: string;
    currentLocation: {
      latitude: number;
      longitude: number;
      station: string;
      updatedAt: string;
    };
    progress: number;  // 0-100
  };
}
```

---

### Complete Delivery

```typescript
POST /api/deliveries/:deliveryId/complete
```

**Request Body:**
```typescript
{
  completionCode: string;  // 6-digit code from requester
}
```

**Response (200 OK):**
```typescript
{
  success: true;
  data: {
    deliveryId: string;
    status: 'completed';
    completedAt: string;
    gillerEarnings: {
      base: number;
      fee: number;
      platformFee: number;
      total: number;
    };
  };
}
```

---

## Rating API

### Submit Rating

```typescript
POST /api/ratings
```

**Request Body:**
```typescript
{
  matchId: string;      // Required
  fromUser: string;     // Required
  toUser: string;       // Required
  rating: number;        // Required: 1-5
  comment?: string;      // Optional (max 200 chars)
}
```

**Validation Rules:**
- Cannot rate yourself
- Cannot rate same match twice
- Rating must be 1-5
- Comment max 200 characters

**Response (201 Created):**
```typescript
{
  success: true;
  data: {
    ratingId: string;
    matchId: string;
    fromUser: string;
    toUser: string;
    rating: number;
    comment: string;
    createdAt: string;
  };
}
```

---

### Get User Ratings

```typescript
GET /api/ratings?userId={userId}
```

**Query Parameters:**
- `userId`: User ID to get ratings for
- `limit`: Number of ratings to return (default: 20)

**Response (200 OK):**
```typescript
{
  success: true;
  data: {
    ratings: [
      {
        ratingId: string;
        fromUser: { name: string };
        rating: number;
        comment: string;
        createdAt: string;
      }
    ];
    average: number;   // Average rating
    total: number;      // Total ratings
  };
}
```

---

## Error Codes

| Code | Message | Description |
|------|----------|-------------|
| `auth/user-not-found` | 존재하지 않는 계정입니다. | User not found |
| `auth/wrong-password` | 비밀번호가 올바르지 않습니다. | Invalid password |
| `auth/email-already-in-use` | 이미 사용 중인 이메일입니다. | Email already exists |
| `auth/weak-password` | 비밀번호는 6자 이상이어야 합니다. | Weak password |
| `INVALID_ROUTE` | 출발역과 도착역이 같을 수 없습니다. | Same stations |
| `STATION_NOT_FOUND` | 존재하지 않는 역입니다. | Invalid station |
| `INVALID_PICKUP_CODE` | 올바른 픽업 코드가 아닙니다. | Wrong pickup code |
| `MATCH_EXPIRED` | 매칭 시간이 만료되었습니다. | Match timeout |
| `ALREADY_RATED` | 이미 평가한 매칭입니다. | Duplicate rating |

---

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|---------|
| POST /api/auth/login | 5 | 15 minutes |
| POST /api/requests | 10 | 1 hour |
| GET /api/matches | 20 | 1 hour |
| PATCH /api/deliveries/*/location | 60 | 1 minute |

**Response (429 Too Many Requests):**
```typescript
{
  success: false;
  error: {
    code: 'TOO_MANY_REQUESTS';
    message: '너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요.',
    retryAfter: number;  // seconds
  };
}
```

---

## Versioning

- **Current Version:** v1.0.0
- **Base URL:** `https://api.ganengile.com/v1`
- **Deprecated:** v0.x (unsupported since 2026-01-01)
