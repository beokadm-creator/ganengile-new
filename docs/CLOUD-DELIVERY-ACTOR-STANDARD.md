# Cloud Delivery Actor Standard

## 목적

이 문서는 `가는길에`의 클라우드 딜리버리 표준을 다시 정의한다.

회원 진입 절차 표준은 [USER-ENTRY-FLOW-STANDARD.md](/Users/aaron/Developer/personal/ganengile-new/docs/USER-ENTRY-FLOW-STANDARD.md)를 우선 기준으로 본다.

기존 코드에서는 `B2B`가 아래 두 의미로 혼용되어 왔다.

- 기업고객형 주문/정산 기능
- 길러가 못 잡는 구간을 넘기는 외부 배송업체 fallback

이 혼용은 제품 구조를 흐리게 만들었다. 앞으로는 `B2B`를 `외부 배송업체 / external_partner 네트워크` 의미로만 사용한다.

## 핵심 정의

### 1. 제품의 본질

`가는길에`는 단순한 길러 매칭 앱이 아니라 `클라우드 딜리버리 오케스트레이터`다.

플랫폼은 주문을 받으면 하나 이상의 실행 주체에게 미션을 배분한다.

실행 주체 후보:

- `giller`
- `external_partner`
- `locker`
- 경우에 따라 `requester`

즉, 핵심은 "누가 배송을 하느냐"가 아니라 "플랫폼이 어떤 실행 주체 조합으로 미션을 완수시키느냐"다.

### 2. B2B의 재정의

앞으로 `B2B`는 아래 의미로만 사용한다.

- `external_partner`
- 즉, 배달대행업체, 퀵서비스 업체, 라스트마일 전문업체, 지역 운송 네트워크 등 외부 배송 수행 주체

이 파트너는 특정 업종으로 고정되지 않는다.

가능한 예:

- 퀵서비스 업체
- 배달대행사
- 지역 화물/오토바이 네트워크
- 전문 라스트마일 업체
- 특정 지역 전용 운송사

따라서 표준 모델은 특정 업체 API에 종속되면 안 된다.

## 표준 도메인 모델

### 1. 주문과 실행 주체를 분리한다

주문 원본:

- 요청자가 생성한 배송 의도

실행 주체:

- 주문 또는 배송 레그를 실제 수행하는 actor

오케스트레이션:

- 플랫폼이 actor 후보를 평가하고 미션카드 또는 파트너 위임으로 실행을 확정하는 과정

### 2. actor 표준

표준 actor type:

- `giller`
- `external_partner`
- `locker`
- `requester`
- `system`

의미:

- `giller`: 플랫폼 내부 개인 수행자
- `external_partner`: 외부 업체 또는 외부 네트워크
- `locker`: 무인 거점
- `requester`: 요청자가 직접 참여하는 구간
- `system`: 내부 자동 처리

### 3. external_partner 표준

`external_partner`는 아래 두 레벨로 나뉜다.

#### partner network

- 파트너 업체 자체
- 예: A 퀵, B 배달대행, C 라스트마일 네트워크

#### partner capability

- 파트너가 수행 가능한 서비스 능력

예:

- 당일 퀵
- 심야 배송
- 라스트마일 주소 배송
- 대형 짐 운송
- 특정 권역 전용 배송

즉, 플랫폼은 "업체 이름"이 아니라 "가용 capability"를 기준으로 미션에 배정해야 한다.

## 궁극 구조

### 1. 미션 카드 오케스트레이션

모든 실행은 결국 미션 또는 미션 번들로 표현한다.

플랫폼은 각 미션에 대해 아래를 결정한다.

- 누가 가장 적합한가
- 길러에게 먼저 노출할지
- 외부 파트너로 바로 위임할지
- 사물함을 포함할지
- fallback 순서를 어떻게 둘지

### 2. 가능한 실행 시나리오

#### 시나리오 A. 길러 단독 수행

- 전 구간을 길러가 수행

#### 시나리오 B. 외부 파트너 단독 수행

- 전 구간을 외부 업체가 수행

#### 시나리오 C. 혼합 수행

- 일부 구간은 길러
- 일부 구간은 외부 파트너
- 일부 구간은 사물함

#### 시나리오 D. 요청자 참여형

- 요청자가 특정 구간에 참여
- 나머지 구간만 길러 또는 외부 파트너가 수행

### 3. 표준 전략 이름

- `single_actor`
- `multi_actor`
- `locker_assisted`
- `partner_fallback`
- 차후 추가 가능:
  - `partner_primary`
  - `hybrid_handover`

## 파트너 도메인 표준

### 1. 파트너 등록 엔티티

권장 컬렉션:

- `delivery_partners`

필수 필드:

- `partnerId`
- `partnerName`
- `partnerType`
- `status`
- `capabilities`
- `coverage`
- `integrationMode`
- `pricingPolicy`
- `sla`
- `contact`
- `createdAt`
- `updatedAt`

`partnerType` 예시:

- `quick_service`
- `delivery_agency`
- `last_mile_carrier`
- `regional_courier`
- `custom`

`status` 예시:

- `active`
- `inactive`
- `suspended`
- `testing`

`integrationMode` 예시:

- `manual_ops`
- `api`
- `csv_batch`
- `email_dispatch`

중요:

- 처음부터 API 연동 업체만 가정하지 않는다.
- 수동 운영형 파트너도 표준 파트너로 인정한다.

### 2. 파트너 capability 구조

예시 capability:

- `station_to_station`
- `address_pickup`
- `address_dropoff`
- `same_day`
- `urgent`
- `night_delivery`
- `heavy_item`
- `fragile_item`

### 3. 파트너 위임 엔티티

권장 컬렉션:

- `partner_dispatches`

역할:

- 특정 미션 또는 배송 레그가 어떤 파트너에게 어떤 방식으로 위임되었는지 추적

필수 필드:

- `dispatchId`
- `deliveryId`
- `missionId`
- `partnerId`
- `partnerCapability`
- `dispatchMethod`
- `status`
- `requestedAt`
- `acceptedAt`
- `completedAt`
- `rawResponse`
- `opsMemo`

`dispatchMethod` 예시:

- `api`
- `manual_dashboard`
- `phone`
- `email`

`status` 예시:

- `queued`
- `requested`
- `accepted`
- `rejected`
- `in_progress`
- `completed`
- `failed`
- `cancelled`

## 기존 B2B 정의의 정리 원칙

### 제거할 정의

다음은 앞으로 핵심 표준에서 제외한다.

- `B2B = 기업고객 전용 화면 묶음`이라는 과거 분류
- `B2B = 무조건 계약형 주문`
- `B2B = 길러가 실패했을 때만 쓰는 fallback`

### 유지할 정의

다음은 유지한다.

- 외부 배송 수행 주체라는 개념
- 외부 파트너 fallback 및 primary routing
- 미션 번들 단위 actor selection

### 이름 정리 원칙

- `B2B`는 외부 배송업체 네트워크를 의미한다.
- 기업 고객 계약/구독/정산 화면은 `enterprise legacy` 또는 `enterprise customer`로 분리한다.
- Admin의 운영 대상은 `delivery_partners`, `partner_dispatches`를 우선으로 두고, 기업 고객 계약 화면은 레거시 운영면으로 분리한다.

- `B2B`라는 단어는 `배송업체/외부 파트너` 의미로만 사용한다.
- 내부 표준 용어는 `external_partner`, `delivery_partner`, `partner_dispatch`를 사용한다.
- 기업고객/계약 기능이 따로 필요하다면 그건 `business_client` 또는 `enterprise_account` 도메인으로 분리한다.

## 이번 코드 정리의 기준

### 유지

- `external_partner` actor 개념
- beta1 오케스트레이션의 actor selection 구조
- partner fallback 전략

### 통합

- 외부 파트너 관련 데이터는 `delivery_partners`, `partner_dispatches` 중심으로 재정비
- 현재 B2B 배송 fallback은 장기적으로 `external_partner dispatch`로 흡수

### 제거

- 실제 사용되지 않는 지하철 실시간 서비스
- 테스트 전용으로 남아 있는 옛 `businessContracts`, `b2bRequests`, `taxInvoices` 기반 B2B 헬퍼
- 기업고객 도메인과 외부 파트너 도메인을 섞는 타입/주석/설명

## 실행 원칙

1. 표준 actor 모델을 먼저 고정한다.
2. 외부 파트너를 특정 업체 API가 아닌 capability 기반으로 모델링한다.
3. 현재 화면과 서비스는 actor orchestration 관점으로 이름과 책임을 다시 정리한다.
4. 레거시 B2B 흔적은 표준과 충돌하면 제거한다.
