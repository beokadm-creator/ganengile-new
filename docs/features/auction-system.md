# 경매 시스템 (Auction)

## 개요
긴급 배송을 위한 역경매 시스템입니다. 길러들이 입찰하여 가격을 상향시키고, 요청자는 가장 적합한 길러를 선택합니다.

## 주요 화면
- 경매 생성: `src/screens/main/CreateAuctionScreen.tsx`

## 서비스
- 경매 관리: `src/services/auction-service.ts`
- 경매 타입: `src/types/auction.ts`

## 경매 유형
- REVERSE_AUCTION: 기본요금으로 시작, 길러들이 높은 가격으로 입찰

## 경매 상태
- PENDING: 대기 중
- ACTIVE: 진행 중
- CLOSED: 마감됨 (낙찰)
- CANCELLED: 취소됨
- EXPIRED: 만료됨 (입찰 없음)

## Flow
1. 요청자가 경매 생성 (CreateAuctionScreen)
2. 길러들이 입찰 (실시간 경쟁)
3. 마감 시 가장 높은 입찰자 선정
4. 배송 진행

## ⚠️ 미완성 부분
- AuctionListScreen: 생성 후 이동할 목록 화면 필요
- 현재는 생성 후 goBack()으로 임시 처리
