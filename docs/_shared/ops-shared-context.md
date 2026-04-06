# Ops Shared Context

`precedence`: 86  
`required-for`: deploy, env, ops-check  
`optional-for`: admin-web, incident-review  
`memory-type`: runbook  
`token-estimate`: 180

@include docs/_shared/ai-doc-governance.md

## Essential (Post-Compact)
- 운영 문서는 실제 배포 전 확인 항목만 남긴다.
- 환경 변수 이름, 배포 지역, 검증 명령은 `[STATIC]`에 둔다.
- 최신 배포 상태나 이슈는 `[DYNAMIC]`에 둔다.

## [STATIC] Defaults
- 기본 확인 범위: 앱, 관리자 웹, Functions, Firestore rules/indexes.
- 지도 계열 변경은 프론트 env와 Functions secret을 함께 확인한다.
- 운영 문서는 재현 가능한 명령과 실패 시 확인 포인트를 짝으로 기록한다.

## [STATIC] Korean Encoding Rules (한글 인코딩)
Windows PowerShell에서 한글이 깨지는 것을 방지하기 위해 아래 설정을 프로젝트 레벨로 강제한다.

### 원인
- Windows PowerShell의 `$OutputEncoding` 기본값이 US-ASCII
- `LANG`, `LC_ALL` 환경변수 미설정 → Git/Node가 인코딩을 추측
- Git `i18n.*encoding` 미설정 → 한글 커밋 메시지/로그 깨짐
- `core.quotepath` 미설정 → 한글 파일명이 escaped octal로 출력

### 해결: 모든 작업 환경에서 아래 설정 필수

**1. Git 글로벌 설정**
```bash
git config --global core.quotepath false
git config --global i18n.logoutputencoding utf-8
git config --global i18n.commitencoding utf-8
git config --global gui.encoding utf-8
```

**2. 환경변수 (PowerShell profile 또는 세션 시작 시)**
```powershell
$env:LANG = "ko_KR.UTF-8"
$env:LC_ALL = "ko_KR.UTF-8"
$env:PYTHONIOENCODING = "utf-8"
$env:NODE_OPTIONS = "--input-type=module"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
```

**3. CI 환경 (GitHub Actions)**
```yaml
env:
  LANG: ko_KR.UTF-8
  LC_ALL: ko_KR.UTF-8
```

### 프로젝트 파일
- `.editorconfig`: `charset = utf-8` (이미 설정됨)
- `.gitattributes`: `* text=auto eol=lf` (강제 LF + UTF-8)
- `scripts/check-encoding.mjs`: 인코딩 검증 스크립트 있음

## [DYNAMIC] Current Focus
- beta1 관련 관리자 설정과 지도 프록시가 현재 운영 체크의 핵심이다.

## Changelog
- 2026-04-02: 운영 문서 공통 규칙 분리.
