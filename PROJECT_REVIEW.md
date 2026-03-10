# 가는길 프로젝트 현재 상태 검토 보고서

## 📋 프로젝트 개요

- **이름:** 가는길 (GaneunGile)
- **버전:** 1.0.0
- **개발 시작일:** 2026년 2월 4일
- **마지막 수정:** 2026년 2월 4일

---

## 🛠️ 기술 스택

### Frontend
- React Native + Expo SDK 54
- TypeScript
- React Navigation

### Backend
- Firebase (Firestore, Auth, Hosting, Functions)

---

## ✅ 구현 완료된 기능

### 1단계: 핵심 인프라 ✅
- Firebase 프로젝트 설정 (ganengile)
- Firestore 데이터베이스 구조
- Firebase Auth (Email/Password)
- Config 컬렉션 초기화 (역, 경로, 요금)

### 2단계: 기본 기능 ✅
- 사용자 역할 시스템 (Giller/Gller/BOTH)
- 동선 등록 (CRUD, 유효성 검사)
- 역할 전환 (슬라이더 UI)

### 3단계: 매칭 시스템 ✅
- **요금 계산 함수** (calculateDeliveryPricing)
- **매칭 함수** (matchRequests)
- **수락 함수** (acceptMatch)
- **거절 함수** (rejectMatch)
- **완료 함수** (completeMatch)

---

## 💰 현재 배송비 로직

### calculateDeliveryPricing 함수 분석

```typescript
// 현재 구현된 요금 계산
baseFee: 3,000원
distanceFee: travelTime 기반 (10분당 500원)
sizeFees: small(0), medium(500), large(1000), xl(1500)
weightFee: 1kg 초과 시 1kg당 300원
serviceFee: 0원
vat: 10%
```

### 실제 계산 예시

```
기본료: 3,000원
거리료: 1,500원 (30분 이동)
사이즈료: 500원 (medium)
무게료: 300원 (2kg)
서비스 요금: 0원
소계: 5,300원
VAT: 530원
총비: 5,830원
```

---

## 🔍 주요 파일 분석

### 1. 배송비 로직 관련 파일

**`src/services/request-service.ts`**
- **calculateDeliveryFee 함수** (라인 568-651)
- 현재: 고정 기본료 3,000원
- 거리료: Travel Time 기반 (10분당 500원)
- 서비스 수수료: 0원
- VAT: 10%

**`src/screens/main/CreateRequestScreen.tsx`**
- 배송 요청 생성 화면
- 5단계 스텝 프로세스
- Urgency 옵션: normal(0%), fast(20%), urgent(50%)

---

### 2. 매칭 알고리즘 관련 파일

**`MATCHING_ALGORITHM.md`**
- 매칭 점수 알고리즘 상세 기획
- 경로 일치 (40점), 시간 일치 (30점), 평점 (20점), 응답 시간 (10점)
- 상위 N명 선정 알림

---

### 3. 비즈니스 모델 관련 파일

**`BUSINESS_MODEL.md`**
- 4가지 사용자 타입 정의
- 글러 (Gller): 일반 개인
- 길러 (Giller): 지하철 이용자
- **사업자 (Business Giller): 온라인/오프라인 상점 (NEW)
- **위상사업자 (Location Partner): 편의점/카페/역매점 (NEW)

---

## 🔴 **현재 문제점 & 수정 필요 사항**

### 1. 배송비 로직 수정 필요

### 현재 로직
```typescript
baseFee: 3,000원
distanceFee: 고정 (또는 Travel Time 기반)
serviceFee: 0원
```

### 수정 필요 (오늘讨论한 내용)
```typescript
baseFee: 3,500원  // 3,000원 → 3,500원
distanceFee: 역 개수 기반  // 600~2,400원
serviceFee: 15%      // 0원 → 15%
gillerFee: 85%       // 길러 정산 추가
```

---

### 2. 경매 시스템 추가 필요

### 새로운 기능
```typescript
// 실시간 경매 시스템
createAuction()
placeBid()
closeAuction()
notifyGillers()
notifyGler()
```

### 경매 모드
- **급한 배송:** 가격 상향 경매 (6,500원)
- **여유 있는 배송:** 가격 하향 경매 (3,800원)
- **역경매:** 길러 주도 수요 창출

---

### 3. 1단계 런칭 전략 반영 필요

### 수정 필요
- **목표:** 지하철 to 지하철 (3개월)
- **배송:** 역 A → 역 B (길러 1명)
- **범위:** 역세권
- **매칭:** 1명 (단순)
- **가격:** 5,300원 (소형, 1kg, 5개역)

---

## 💡 **다음 단계 제안**

### 1. 배송비 로직 수정 (긴급)

**대상 파일:**
- `src/services/request-service.ts` (calculateDeliveryFee 함수)

**수정 내용:**
- baseFee: 3,000원 → 3,500원
- distanceFee: 역 개수 기반 동적 계산 추가
- serviceFee: 0원 → 15%
- 길러 정산: 85% 추가

---

### 2. 경매 시스템 추가 (신규)

**새로운 파일:**
- `src/services/auction-service.ts` (생성 필요)
- `src/types/auction.ts` (타입 정의)

**구현 내용:**
- 실시간 경매 생성
- 입찰 시스템
- 낙찰 및 매칭

---

### 3. 정부 지원사업 제안서 적용

**문서 작업 완료:**
- 정부 지원사업 제안서 v3 (경매 시스템 포함)
- 기술 구현 가이드

**적용 내용:**
- "오늘 받아볼 수 있는" 포지셔닝
- 실시간 경매 시스템 (카카오대리운전 방식)
- 경제학 기반 알고리즘

---

## 📊 프로젝트 완성도 평가

### ✅ 완료된 부분 (85%)
- Firebase 인프라 구조 완료
- 기본 CRUD 완료
- 매칭 시스템 완료
- UI 화면 완료
- 테스트 코드 완료

### 🔴 미완성 부분 (15%)
- 배송비 로직: 오늘 수정된 로직 미적용
- 경매 시스템: 신규 기능
- B2B 기능: 사업자/위상사업자 기능

---

## 🎯 **다음 단계 추천**

### 옵션 1: 배송비 로직 수정
1. `calculateDeliveryFee` 함수 수정
2. 길러 정산 로직 추가
3. 테스트 코드 업데이트
4. UI 화면 수정

### 옵션 2: 경매 시스템 구현
1. 경매 서비스 생성
2. 실시간 입찰 시스템
3. 길러 앱 경매 화면
4. 낙찰 매칭 로직

### 옵션 3: 정부 지원사업 준비
1. 정부 지원사업 제안서 최종본 확정
2. R&D 과제 정의
3. 제안서 작성

---

## 💬 **질문: 어떤 작업을 먼저 하시겠습니까?**

1. **배송비 로직 수정** (기존 코드 수정)
2. **경매 시스템 추가** (신규 기능 개발)
3. **정부 지원사업 제안서 최종 확인**
4. **전체 종합 검토** (모든 파일 검토)

어떤 것부터 먼저 진행하시겠습니까? 🚀