# 기획 의도 / 제품 원칙 (문서 기반)

> 이 문서는 “지금 저장소에 존재하는 표준 문서”에서 읽히는 기획 의도/원칙을 정리한 것입니다.  
> (새 기획 문서를 추가하려면 `docs/` 쪽에 “표준 문서”로 먼저 정리하고, 위키에서 요약/링크를 유지하는 방식을 권장합니다.)

## 1) 가입을 가볍게, 첫 사용 직전에 필요한 정보만
**핵심:** 가입(계정 생성)과 서비스 이용 준비(온보딩)를 분리해서 초기 진입 장벽을 낮춘다.

- 표준 문서: [`../docs/USER-ENTRY-FLOW-STANDARD.md`](../docs/USER-ENTRY-FLOW-STANDARD.md)
- 요지:
  - 회원가입 단계에서 과도한 정보(휴대폰 인증/본인확인/계좌 등록 등)를 한 번에 요구하지 않는다.
  - “요청자 이용 시작”과 “길러 전환”은 서로 다른 절차로 본다.

## 2) 이중 역할 모델: 요청자 ↔ 길러
**핵심:** 한 계정이 기본적으로 요청자로 시작하되, 길러는 별도의 심사/전환 과정을 통해 역할을 확장한다.

- 앱 구현에서 확인되는 연결:
  - 요청자 온보딩: `BasicInfoOnboarding`
  - 길러 전환/신청: `GillerApplyScreen`
  - 운영 심사: 관리자 웹 `gillers/applications`

## 3) beta1 운영 모델: “하이브리드 배송” + 미션/구간 단위
**핵심:** 길러는 전체 배송이 아니라 “수행 가능한 구간/미션” 중심으로 참여하며, 운영자는 예외/분쟁/정산을 통제한다.

- 배경 문서(공유 컨텍스트): [`../docs/_shared/beta1-core-context.md`](../docs/_shared/beta1-core-context.md)
- 요지:
  - 요청 생성은 초안/분석/견적/확정 같은 단계형 흐름을 가정한다.
  - 배송은 `Delivery / DeliveryLeg / HandoverEvent` 같은 분해 모델로 확장 가능하다.

## 4) AI의 역할: “추천/보조” + “민감 확정은 운영/정책”
**핵심:** AI는 입력 보조/분류/추천/경고를 맡고, 가격/승인/민감한 확정 책임은 운영 정책이 맡는다.

- 배경 문서(공유 컨텍스트): [`../docs/_shared/beta1-core-context.md`](../docs/_shared/beta1-core-context.md)
- 운영적 시사점:
  - “저신뢰(LOW CONFIDENCE)” 케이스를 수동검토 큐로 보내는 운영 설계가 필요
  - 관리자 웹에 AI 리뷰/지표가 존재(`admin-web/app/(admin)/beta1/ai-review`)

## 5) 운영 우선: 배포/환경변수/연동을 하나의 체크리스트로 본다
**핵심:** 지도/결제/신원 같은 연동은 “앱 + Functions + 관리자”가 동시에 맞아야 정상 동작한다.

- 배포 전 점검 런북: [`../docs/deployment-preflight.md`](../docs/deployment-preflight.md)
- 환경변수 정리: [`../docs/ops/deployment-and-env.md`](../docs/ops/deployment-and-env.md)

## 6) 외부 파트너/B2B 표준: Actor/역할 기반의 계약화
**핵심:** 외부 배송 파트너를 운영 가능한 단위(Actor)로 보고, 책임/권한/흐름을 표준 문서로 관리한다.

- 표준 문서: [`../docs/CLOUD-DELIVERY-ACTOR-STANDARD.md`](../docs/CLOUD-DELIVERY-ACTOR-STANDARD.md)

## 7) 문서 운영 원칙(권장)
- “기획 의도”는 위키에 길게 쓰기보다 `docs/`에 표준 문서로 먼저 둔다(소스 오브 트루스).
- 위키는 “현재 구현 상태 + 빠른 탐색 + 요약”에 강하다.
- 관련 규칙: [`../docs/ops/documentation-rules.md`](../docs/ops/documentation-rules.md)

