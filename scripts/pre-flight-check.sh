#!/bin/bash

# 배포 전 체크리스트
# Deployment Pre-flight Checks

echo "🔍 배포 전 체크리스트 시작..."
echo ""

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 카운터
PASS=0
FAIL=0
WARN=0

# 체크 함수
check_pass() {
  echo -e "${GREEN}✅ $1${NC}"
  ((PASS++))
}

check_fail() {
  echo -e "${RED}❌ $1${NC}"
  ((FAIL++))
}

check_warn() {
  echo -e "${YELLOW}⚠️  $1${NC}"
  ((WARN++))
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. 코드 검토 (Code Review)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Lint 체크
if npm run lint > /dev/null 2>&1; then
  check_pass "ESLint 통과"
else
  check_fail "ESLint 실패 - 실행: npm run lint --fix"
fi

# TypeScript 체크
if npx tsc --noEmit > /dev/null 2>&1; then
  check_pass "TypeScript 에러 없음"
else
  check_fail "TypeScript 에러 발생 - 실행: npx tsc --noEmit"
fi

# 단위 테스트 체크
TEST_OUTPUT=$(npm test -- --passWithNoTests 2>&1)
if echo "$TEST_OUTPUT" | grep -q "Test Suites: 1 passed"; then
  check_pass "단위 테스트 통과"
else
  check_fail "단위 테스트 실패 - 실행: npm test"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. 환경 설정 (Environment Setup)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# .env 파일 존재 확인
if [ -f .env ]; then
  check_pass ".env 파일 존재"
  
  # 필수 변수 확인
  if grep -q "FIREBASE_PROJECT_ID=" .env; then
    check_pass "FIREBASE_PROJECT_ID 설정됨"
  else
    check_fail "FIREBASE_PROJECT_ID 미설정"
  fi
  
  if grep -q "FIREBASE_AUTH_DOMAIN=" .env; then
    check_pass "FIREBASE_AUTH_DOMAIN 설정됨"
  else
    check_fail "FIREBASE_AUTH_DOMAIN 미설정"
  fi
else
  check_fail ".env 파일 없음 - .env.example 복사 필요"
fi

# Firebase 프로젝트 확인
if firebase projects:list 2>/dev/null | grep -q "ganengile"; then
  check_pass "Firebase 프로젝트 연결됨"
else
  check_fail "Firebase 프로젝트 미연결 - 실행: firebase init"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. 리소스 준비 (Assets Ready)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 아이콘 존재 확인
if [ -d "assets/icons" ]; then
  check_pass "앱 아이콘 폴더 존재"
  
  # 필수 사이즈 확인
  REQUIRED_SIZES=("1024x1024" "512x512" "192x192" "180x180" "152x152" "128x128" "64x64" "48x48" "32x32")
  for size in "${REQUIRED_SIZES[@]}"; do
    if find assets/icons -name "*${size}*" | grep -q .; then
      check_pass "  아이콘 ${size} 존재"
    else
      check_warn "  아이콘 ${size} 누락"
    fi
  done
else
  check_fail "앱 아이콘 폴더 없음"
fi

# 스플래시 화면 존재 확인
if [ -f "assets/splash.png" ] || [ -f "assets/splash.jpg" ]; then
  check_pass "스플래시 화면 존재"
else
  check_warn "스플래시 화면 누락 (선택사항)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. 번들 사이즈 (Bundle Size)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 번들 사이즈 체크 (대략적 추정)
BUNDLE_SIZE=$(find public -type f -name "*.js" -exec du -b {} + 2>/dev/null | awk '{sum+=$1} END {print sum/1024/1024}')
if [ ! -z "$BUNDLE_SIZE" ]; then
  if (( $(echo "$BUNDLE_SIZE < 5" | bc -l) )); then
    check_pass "번들 사이즈: ${BUNDLE_SIZE}MB (좋음)"
  elif (( $(echo "$BUNDLE_SIZE < 10" | bc -l) )); then
    check_warn "번들 사이즈: ${BUNDLE_SIZE}MB (개선 권장)"
  else
    check_fail "번들 사이즈: ${BUNDLE_SIZE}MB (최적화 필요)"
  fi
else
  check_warn "번들 사이즈 측정 불가 (프로덕션 빌드 필요)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. 보안 (Security)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# .env 파일 .gitignore 체크
if grep -q ".env" .gitignore 2>/dev/null; then
  check_pass ".env 파일 .gitignore됨"
else
  check_fail ".env 파일 .gitignore 안됨 - 보안 위험!"
fi

# API 키 노출 체크
if git grep -i "api_key\|api_key\|secret\|password" --not ':^' -- '.env' '.env.example' 2>/dev/null; then
  check_fail "API 키 노출 위험 - 커밋 확인 필요"
else
  check_pass "API 키 노출 없음"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6. 문서화 (Documentation)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# README 업데이트 확인
if git log -1 --format=%s | grep -q "README"; then
  check_pass "README 최근 업데이트됨"
else
  check_warn "README 업데이트 권장"
fi

# CHANGELOG 존재 확인
if [ -f "CHANGELOG.md" ]; then
  check_pass "CHANGELOG 존재"
else
  check_warn "CHANGELOG 누락 (선택사항)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "7. 버전 정보 (Version Info)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# app.json 버전 확인
APP_VERSION=$(grep -o '"version": "[^"]*"' app.json | cut -d'"' -f2)
if [ ! -z "$APP_VERSION" ]; then
  check_pass "앱 버전: $APP_VERSION"
else
  check_warn "앱 버전 확인 불가"
fi

# package.json 버전 확인
PKG_VERSION=$(grep -o '"version": "[^"]*"' package.json | cut -d'"' -f2)
if [ ! -z "$PKG_VERSION" ]; then
  check_pass "패키지 버전: $PKG_VERSION"
else
  check_warn "패키지 버전 확인 불가"
fi

# 버전 일치 확인
if [ "$APP_VERSION" = "$PKG_VERSION" ]; then
  check_pass "앱/패키지 버전 일치"
else
  check_warn "앱/패키지 버전 불일치"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "8. Git 상태 (Git Status)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 커밋되지 않은 변경 체크
UNCOMMITTED=$(git status --porcelain | wc -l | tr -d ' ')
if [ "$UNCOMMITTED" -eq 0 ]; then
  check_pass "커밋되지 않은 변경 없음"
else
  check_warn "커밋되지 않은 변경: $UNCOMMITTED개"
fi

# 브랜치 확인
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ]; then
  check_pass "메인 브랜치: $CURRENT_BRANCH"
else
  check_warn "현재 브랜치: $CURRENT_BRANCH (main 권장)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 체크리스트 요약"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}통과:${NC} $PASS"
echo -e "${RED}실패:${NC} $FAIL"
echo -e "${YELLOW}경고:${NC} $WARN"
echo ""

# 결과 판정
TOTAL=$((PASS + FAIL + WARN))
echo "총 검사: $TOTAL"

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}✅ 배포 준비 완료!${NC}"
  echo ""
  echo "다음 단계:"
  echo "1. Environment 변수 설정"
  echo "2. Firebase 배포"
  echo "3. App Store / Play Store 배포 준비"
  exit 0
else
  echo -e "${RED}❌ 배포 준비 미완료${NC}"
  echo ""
  echo "실패 항목을 해결한 후 다시 실행하세요."
  exit 1
fi
