# 보증금 및 패널티 시스템

## 보증금 (Deposit)
### 주요 화면
- 보증금 결제: `src/screens/main/DepositPaymentScreen.tsx`

### 서비스
- 보증금 관리: `src/services/DepositService.ts`

### 보증금율
- 기본 보증금률 적용
- 등급별 차등 적용 가능

---

## 패널티 시스템 (Penalty)

### 서비스
- 패널티 관리: `src/services/penalty-service.ts`

### 패널티 유형
- no-show (미출근)
- 지연 배송
- 파손/분실
- 약관 위반

### 패널티 효과
- 활동 제한
- 등강 강등
- 보증금 차감
