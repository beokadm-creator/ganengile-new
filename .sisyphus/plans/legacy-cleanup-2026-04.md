# 가넹길 레거시 정리 + 안정성 강화 계획

> 생성: 2026-04-10
> 원칙: 기존 시스템 동작 보장, 점진적 개선

## TODOs

### Phase 1: 보안 즉시 수정 (P0)

- [ ] T1: requestPhoneOtp/confirmPhoneOtp에 requireCallableAuth 추가
- [ ] T2: Firestore 규칙 — b2b_deliveries, b2b_tax_invoices, transfer_matches 커렉션 규칙 추가
- [ ] T3: Firestore 규칙 — chats/{chatId} 이중 경로 정리 (사용 여부 확인 후 미사용 경로 제거)
- [ ] T4: Firestore 규칙 — auctions/bids "임시" 본인확인 추가

### Phase 2: 레거시 정리 (죽은 코드 제거)

- [ ] T5: 5개 데드 타입 파일 정리 (qrcode.ts, partner.ts, location.ts, module.ts, delivery-method.ts)
- [ ] T6: imported-by=0인 beta1 신규 모듈 확인 — 사용하지 않으면 제거, 사용하면 연결
- [ ] T7: 미사용 서비스 최종 확인 및 정리 (~10개 후보)

### Phase 3: 구조 개선

- [ ] T8: beta1-orchestration 파사드 생성 (beta1/index.ts)
- [ ] T9: onRequest 엔드포인트 rate limiting 추가
- [ ] T10: 남은 핵심 서비스 테스트 작성 (chat, verification, locker, Settlement, TossPayment, Deposit)

### Phase 4: 최종 검증

- [ ] F1: 빌드 통과 (npm run build 또는 tsc --noEmit)
- [ ] F2: 전체 테스트 통과 (npm test)
- [ ] F3: 보안 규칙 시뮬레이션 (Firestore/Storage 규칙 문법 검증)
- [ ] F4: 코드 리뷰 — 변경된 파일 모두 검증

## 병렬 실행 그룹

- **Group A (병렬)**: T1, T5, T6, T7 — 독립적, 서로 다른 파일
- **Group B (병렬)**: T2, T3, T4 — 같은 파일(firestore.rules)이므로 순차
- **Group C (T2-T4 완료 후)**: T8, T9, T10
- **Final**: F1-F4
