# 가는길에 (ganengile) 위키

> 이 위키는 “지금 코드에 존재하는 기능”을 기준으로 현재 상태를 정리하고, 기획 의도/운영 관점까지 같이 정렬하기 위한 문서입니다.  
> 최신 개발 문서 인덱스는 `docs/README.md`입니다.

## Quick Links
- 서비스(웹앱): https://ganengile.web.app/
- 개발 문서 인덱스: [`../docs/README.md`](../docs/README.md)
- 루트 README(로컬 실행): [`../README.md`](../README.md)
- 작업 규칙/거버넌스: [`../CLAUDE.md`](../CLAUDE.md)

## Wiki Pages
1. 제품/서비스 개요: [`01-product-overview.md`](01-product-overview.md)
2. 시스템 아키텍처(개발): [`02-system-architecture.md`](02-system-architecture.md)
3. 기능 분석(현재 구현 기준): [`03-feature-analysis.md`](03-feature-analysis.md)
4. 기획 의도/원칙(문서 기반): [`04-planning-intent.md`](04-planning-intent.md)
5. 운영/관리자/배포: [`05-ops-and-admin.md`](05-ops-and-admin.md)
6. 로드맵/오픈 이슈: [`06-roadmap-and-open-questions.md`](06-roadmap-and-open-questions.md)

## Stack (현재 코드 기준)
- **App**: React Native + Expo (Web 포함)
- **Admin Web**: Next.js (App Router) + TypeScript
- **Backend**: Firebase Cloud Functions
- **DB/Auth**: Firestore + Firebase Auth
- **Maps**: 네이버 지도(프록시/정적 지도 포함)

## 문서 기준(참고)
- 회원 진입/온보딩 표준: [`../docs/USER-ENTRY-FLOW-STANDARD.md`](../docs/USER-ENTRY-FLOW-STANDARD.md)
- 운영/배포 사전점검: [`../docs/deployment-preflight.md`](../docs/deployment-preflight.md)
- CI/CD: [`../docs/ops/cicd-pipeline-guide.md`](../docs/ops/cicd-pipeline-guide.md)
