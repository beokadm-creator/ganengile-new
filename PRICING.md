# 가격 정책 (Pricing Policy)

## 개요 (Overview)

가네길(Ganengile)은 지하철역 간 배송 서비스를 제공하며, **1단계(Phase 1)** 배송비 체계를 운영하고 있습니다. 본 문서는 배송비 계산 로직, 정산 구조, 그리고 가격 정책의 상세 내용을 설명합니다.

---

## 1. 배송비 구조 (Delivery Fee Structure)

### 1.1 기본 원칙

- **기본료 상향**: 3,000원 → **3,500원**
- **거리료**: 역 개수 기반 동적 계산
- **서비스 수수료**: **15%**
- **최소 배송비**: 3,000원 (VAT 포함)
- **최대 배송비**: 8,000원 (VAT 포함)

### 1.2 배송비 계산公式

```
총 배송비 = 기본료 + 거리료 + 무게료 + 사이즈료 + 긴급 surcharge + 서비스 수수료 + 부가세
```

---

## 2. 상세 요금 구성 (Detailed Fee Components)

### 2.1 기본 배송비 (Base Fee)

| 항목 | 금액 |
|------|------|
| 기본료 | **3,500원** |

### 2.2 거리 수수료 (Distance Fee)

역 개수 기반으로 계산됩니다:

| 역 개수 | 거리료 |
|---------|--------|
| 1-5개역 | 600원 (기본) |
| 6개역 이상 | 600원 + (초과 역 개수 × 120원) |

**예시:**
- 5개역: 600원
- 10개역: 600원 + (5 × 120원) = 1,200원
- 15개역: 600원 + (10 × 120원) = 1,800원

### 2.3 무게별 추가 요금 (Weight Fee)

| 무게 | 요금 |
|------|------|
| 1kg 이하 | 100원 (최소) |
| 1kg 초과 | 무게 × 100원 |

**예시:**
- 1kg: 100원
- 2kg: 200원
- 5kg: 500원

### 2.4 사이즈별 추가 요금 (Size Fee)

| 사이즈 | 설명 | 요금 |
|--------|------|------|
| 소형 (Small) | 서류, 핸드폰 | 0원 |
| 중형 (Medium) | 책, 옷 | 400원 |
| 대형 (Large) | 가방, 전자기기 | 800원 |
| 특대 (Extra Large) | 대형 가전 | 1,500원 |

### 2.5 긴급도 Surcharge (Urgency Surcharge)

| 긴급도 | 배송 시간 | Surcharge |
|--------|-----------|-----------|
| 보통 (Normal) | 2-3시간 | 0% |
| 빠름 (Fast) | 1-2시간 | 10% |
| 긴급 (Urgent) | 30분-1시간 | 20% |

* 기본료 + 거리료 기준으로 계산

### 2.6 서비스 수수료 (Service Fee)

- **수수료율**: 15%
- **산정 기준**: 기본료 + 거리료 + 무게료 + 사이즈료

### 2.7 부가세 (VAT)

- **부가세율**: 10%
- **산정 기준**: 모든 수수료 합계 (부가세 제외)

---

## 3. 정산 구조 (Settlement Structure)

### 3.1 길러/플랫폼 비용 분배

총 배송비는 다음과 같이 분배됩니다:

| 대상 | 비중 | 설명 |
|------|------|------|
| 길러 (Giller) | **85%** | 실제 배송 수행자 |
| 플랫폼 | **15%** | 서비스 제공 및 운영 |

**예시 (총 배송비 5,000원 경우):**
- 길러 정산: 4,250원 (85%)
- 플랫폼 수수료: 750원 (15%)

### 3.2 정산 시점

- 배송 완료 즉시 정산
- 길러 포인트에 적립
- 출금 신청 가능 (별도 정책 참조)

---

## 4. 배송비 계산 예시 (Pricing Examples)

### 예시 1: 기본 배송 (소형, 1kg, 보통, 5개역)

```
기본료: 3,500원
거리료: 600원 (5개역)
무게료: 100원 (1kg)
사이즈료: 0원 (소형)
긴급 surcharge: 0원 (보통)
서비스 수수료: 630원 (15% of 4,200원)
소계: 4,830원
부가세: 483원 (10%)
-----------
총 배송비: 5,313원

정산:
- 길러: 4,516원 (85%)
- 플랫폼: 797원 (15%)
```

### 예시 2: 대형 긴급 배송 (대형, 5kg, 긴급, 10개역)

```
기본료: 3,500원
거리료: 1,200원 (10개역)
무게료: 500원 (5kg)
사이즈료: 800원 (대형)
긴급 surcharge: 470원 (20% of 2,350원)
서비스 수수료: 948원 (15% of 6,320원)
소계: 7,418원
부가세: 742원 (10%)
-----------
총 배송비: 8,160원 → 최대 요금 8,000원 적용

정산:
- 길러: 6,800원 (85%)
- 플랫폼: 1,200원 (15%)
```

### 예시 3: 소형 가까운 거리 (소형, 1kg, 보통, 3개역)

```
기본료: 3,500원
거리료: 600원 (3개역)
무게료: 100원 (1kg)
사이즈료: 0원 (소형)
긴급 surcharge: 0원 (보통)
서비스 수수료: 630원 (15% of 4,200원)
소계: 4,830원
부가세: 483원 (10%)
-----------
총 배송비: 5,313원

정산:
- 길러: 4,516원 (85%)
- 플랫폼: 797원 (15%)
```

---

## 5. 요약표 (Summary Table)

| 구분 | 최소 | 최대 |
|------|------|------|
| 총 배송비 (VAT 포함) | 3,000원 | 8,000원 |
| 기본료 | 3,500원 | 3,500원 |
| 거리료 | 600원 | 3,000원 (30개역) |
| 무게료 | 100원 | 2,000원 (20kg) |
| 사이즈료 | 0원 | 1,500원 (특대) |
| 긴급 surcharge | 0원 | 820원 (긴급) |
| 서비스 수수료 | 630원 | 1,200원 |
| 부가세 | 300원 | 800원 |

---

## 6. 기술적 구현 (Technical Implementation)

### 6.1 핵심 함수

```typescript
// 1단계 배송비 계산
calculatePhase1DeliveryFee(params: Phase1PricingParams): DeliveryFeeBreakdown

// 거리 수수료 계산
calculateDistanceFee(stationCount: number): number

// 무게별 추가 요금 계산
calculateWeightFee(weight: number): number

// 사이즈별 추가 요금 계산
calculateSizeFee(packageSize: PackageSizeType): number

// 긴급도 surcharge 계산
calculateUrgencySurcharge(urgency: string, baseAndDistanceFee: number): number

// 서비스 수수료 계산
calculateServiceFee(feeBeforeService: number, rate: number): number

// 길러 비용 분배 계산
calculateBreakdown(totalFee: number): { gillerFee: number; platformFee: number }
```

### 6.2 타입 정의

```typescript
interface Phase1PricingParams {
  stationCount: number;      // 지하철 역 개수
  weight?: number;           // 무게 (kg)
  packageSize?: PackageSizeType;  // 패키지 사이즈
  urgency?: 'normal' | 'fast' | 'urgent';  // 긴급도
}

interface DeliveryFeeBreakdown {
  baseFee: number;           // 기본 배송비
  distanceFee: number;       // 거리 수수료
  weightFee: number;         // 무게 추가 요금
  sizeFee: number;           // 사이즈 추가 요금
  urgencySurcharge: number;  // 긴급 surcharge
  serviceFee: number;        // 서비스 수수료 (15%)
  subtotal: number;          // 부가세 제외 합계
  vat: number;               // 부가세 (10%)
  totalFee: number;          // 총 배송비
  breakdown: {
    gillerFee: number;       // 길러 정산 (85%)
    platformFee: number;     // 플랫폼 수수료 (15%)
  };
  description: string;       // 설명 텍스트
}
```

---

## 7. 향후 로드맵 (Future Roadmap)

### 7.2단계 (Phase 2) 예정

- **다중 길러 배송**: 2명 이상의 길러가 협력
- **복잡한 라우팅**: 환승, 다중 경로
- **동적 가격 책정**: 수요/공급 기반 가격 변동

### 향후 고려사항

- **프리미엄 서비스**: 특정 시간대, 특별 취급
- **벌크 배송**: 여러 물건 한 번에 배송
- **정기 배송**: 구독 모델

---

## 8. 참고 문서 (References)

- **Pricing Service Code**: `src/services/pricing-service.ts`
- **Pricing Tests**: `tests/pricing-service.test.ts`
- **Delivery Types**: `src/types/delivery.ts`

---

## 9. 변경 이력 (Changelog)

| 버전 | 날짜 | 변경사항 |
|------|------|----------|
| 1.0 | 2026-03-10 | 1단계 배송비 체계 초기 문서화 |
| | | 기본료 3,000원 → 3,500원 상향 |
| | | 서비스 수수료 0% → 15% 추가 |
| | | 길러/플랫폼 정산 로직 추가 |

---

*본 문서는 가네길(Ganengile) 서비스의 가격 정책을 설명하며, 기술 구현 팀과 비즈니스 팀 간의 원활한 소통을 위해 작성되었습니다.*
