# 길러 앱 흐름

## 주요 화면 경로

- 길러 신청: `/Users/aaron/ganengile-new/src/screens/main/GillerApplyScreen.tsx`
- 인증: `/Users/aaron/ganengile-new/src/screens/main/IdentityVerificationScreen.tsx`
- 배송 매칭: `/Users/aaron/ganengile-new/src/screens/main/GillerRequestsScreen.tsx`
- 채팅: `/Users/aaron/ganengile-new/src/screens/main/ChatScreen.tsx`
- 동선 관리: `/Users/aaron/ganengile-new/src/screens/main/RouteManagementScreen.tsx`
- 수익/정산: `/Users/aaron/ganengile-new/src/screens/main/EarningsScreen.tsx`

## 정상 흐름

1. 길러 신청
2. 본인인증 및 계좌 입력
3. 관리자 승인
4. 길러 모드 진입
5. 동선 등록
6. 배송 매칭 목록 확인
7. 채팅에서 협의 후 수락
8. 픽업, 직접전달 또는 사물함 전달
9. 완료 후 정산 확인

## 매칭 정책

- 목록 화면은 후보 탐색용입니다.
- 실제 수락/취소는 채팅 화면에서 이뤄집니다.
- 동선이 없으면 동선 매칭은 빈 결과가 정상입니다.

## 재발 방지 규칙

- 길러 승인 전에는 길러 기능 진입 시 신청 유도 모달이 필요합니다.
- 승인 완료 사용자는 다시 길러 신청 CTA를 보지 않도록 유지합니다.
- 수락 후에는 채팅으로 자연스럽게 이어져야 하며, 취소 경로도 남겨둡니다.
