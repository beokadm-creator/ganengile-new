# CLAUDE.md

`precedence`: 99  
`required-for`: code-change, repo-navigation  
`optional-for`: onboarding, docs-navigation  
`memory-type`: overview  
`token-estimate`: 700

@include docs/_shared/ai-doc-governance.md
@include docs/_shared/beta1-core-context.md
@include docs/_shared/ops-shared-context.md

## Essential (Post-Compact)
- 이 문서는 저장소 진입점이며, 먼저 읽고 작업별 문서로 이동한다.
- 문서 우선순위/충돌 규칙은 `docs/_shared/ai-doc-governance.md`를 따른다. 이 문서는 루트 오버뷰(99)다.
- 문서 계획보다 코드와 상태 계약이 최신일 수 있으므로 구현과 계약을 먼저 대조한다.
- `[STATIC]`은 캐시 가능한 규칙, `[DYNAMIC]`은 릴리즈 태그, 런타임 상태, 최근 판단처럼 다시 확인해야 하는 정보다.
- 상세 정책과 스타일 규칙은 여기서 반복하지 않고 shared include와 `docs/ops/documentation-rules.md`, 작업별 문서로 위임한다.

## [STATIC] Windows PowerShell 인코딩 규칙 (강제)

이 프로젝트는 Windows PowerShell 5.1 환경에서 실행된다. PowerShell은 기본적으로 한글 출력을 깨트린다. 아래 규칙을 **모든 셸 명령 실행 전**에 적용한다.

### 원인
- `$OutputEncoding` 기본값이 US-ASCII → 파이프/리다이렉트 시 한글 깨짐
- `LANG`, `LC_ALL` 미설정 → Git/Node가 인코딩을 추측
- `git i18n.*encoding` 미설정 → 한글 커밋 로그/파일명 깨짐
- `git core.quotepath` 미설정 → 한글 파일명이 escaped octal로 출력

### 강제 규칙 (MUST)

**1. 모든 Bash 툴 호출 시 아래 환경변수를 함께 설정한다:**
```powershell
$env:LANG = "ko_KR.UTF-8"
$env:LC_ALL = "ko_KR.UTF-8"
$env:PYTHONIOENCODING = "utf-8"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
```

**2. Git 설정 (최초 1회):**
```powershell
git config --global core.quotepath false
git config --global i18n.logoutputencoding utf-8
git config --global i18n.commitencoding utf-8
git config --global gui.encoding utf-8
```

**3. 금지 사항 (MUST NOT):**
- PowerShell `Set-Content` 사용 금지 (`-Encoding utf8` 지정해도 BOM 붙음)
- PowerShell `Out-File` 사용 금지 (동일)
- 한글이 포함된 문자열을 PowerShell 변수로 직접 파이프 금지
- `chcp` 명령어 의존 금지 (PowerShell 5.1에서 인식 불가)

**4. 파일 쓰기는 반드시 Write/Edit 툴 사용:**
- 한글이 들어간 파일은 PowerShell 리다이렉트(`>`, `>>`)로 쓰지 않는다.
- Write/Edit 툴은 UTF-8 without BOM으로 쓰므로 안전하다.

**5. CI 환경 (GitHub Actions):**
```yaml
env:
  LANG: ko_KR.UTF-8
  LC_ALL: ko_KR.UTF-8
```

### 참고
- 파일 인코딩 가이드: `docs/ENCODING_GUIDE.md`
- 인코딩 검증: `npm run check:encoding`
- 인코딩 수정: `npm run fix:encoding`

## [STATIC] Role
- 이 파일은 저장소 전체를 설명하는 상세 정책 문서가 아니라, 코덱스와 다른 에이전트가 빠르게 진입하기 위한 루트 오버뷰다.
- 공통 거버넌스, beta1 배경, 운영 기본값은 shared include에서 상속받고 여기에는 루트 판단 기준만 둔다.
- 코드 변경이나 저장소 탐색을 시작할 때는 이 파일을 먼저 읽고, 그다음 `docs/README.md`와 작업 관련 문서로 내려간다.

## [STATIC] Read Order
1. `CLAUDE.md`
2. `docs/README.md`
3. 작업별 핵심 문서

코드/도메인 변경이면 해당 영역의 “현재 표준 문서”를 먼저 본다(예: `docs/USER-ENTRY-FLOW-STANDARD.md`).  
운영/배포 작업이면 `docs/deployment-preflight.md`, `docs/ops/*`, `admin-web/README.md`를 함께 본다.  
표준 문서가 없으면 `docs/README.md`에 새 문서를 추가하고 링크를 먼저 연결한다.

## [STATIC] Source Of Truth
- 문서 인덱스: `docs/README.md`
- 회원 진입/온보딩 표준: `docs/USER-ENTRY-FLOW-STANDARD.md`
- 배송 파트너/B2B actor 표준: `docs/CLOUD-DELIVERY-ACTOR-STANDARD.md`
- 운영/배포: `docs/deployment-preflight.md`, `docs/ops/deployment-and-env.md`, `docs/ops/cicd-pipeline-guide.md`
- 관리자 운영: `admin-web/README.md`

## [STATIC] Loading Rules
- `required-for`에 해당하는 작업에서는 이 파일을 항상 로드한다.
- 루트 파일은 짧게 유지하고, 세부 정책이나 예외 규칙은 shared 문서나 작업 문서에 둔다.
- 현재 파일과 include가 충돌하면 현재 파일의 루트 안내를 우선하되, 실제 제품 판단은 source of truth 문서를 다시 확인한다.

## [DYNAMIC] Current Notes
- `.sisyphus/`, `memory/`, `data/`는 실행 보조 또는 참고 자료로만 사용한다.
- 릴리즈 태그, 런타임 상태, 최근 실험 결과, 임시 메모는 항상 재확인 대상으로 본다.
- 문서와 구현이 어긋나 보이면 먼저 코드와 상태 계약을 확인한 뒤 필요한 문서를 갱신한다.

## Changelog
- 2026-04-03: 코덱스 진입용 루트 오버뷰로 재작성. `precedence 99`, `memory-type overview`, `required-for code-change/repo-navigation` 반영.
- 2026-04-03: `[STATIC]`와 `[DYNAMIC]`를 분리하고 shared include 3개를 참조하도록 정리.
- 2026-04-13: 실제 저장소에 존재하는 문서 기준으로 Read Order/Source Of Truth 링크를 갱신.
- 2026-04-03: 압축 후에도 유지할 핵심 5개 규칙을 `Essential (Post-Compact)`에 고정.
