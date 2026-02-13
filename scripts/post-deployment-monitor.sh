#!/bin/bash

# 배포 후 모니터링 스크립트
# Post-Deployment Monitoring Script

echo "🔍 배포 후 모니터링 시작..."
echo ""

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. EAS Build 상태 확인"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# EAS Build 목록
echo "📱 EAS Build 목록 확인..."
eas build:list 2>/dev/null || echo -e "${YELLOW}⚠️  EAS CLI 로그인 필요${NC}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. Firebase 배포 상태"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Firebase 배포 확인
echo "🔥 Firebase Hosting 배포 확인..."
firebase deploy --only hosting --project ganengile --dry-run 2>/dev/null || echo -e "${YELLOW}⚠️  Firebase CLI 확인 필요${NC}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. 앱 버전 확인"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 버전 정보
APP_VERSION=$(grep '"version"' app.json | head -1 | cut -d'"' -f4)
PACKAGE_VERSION=$(grep '"version"' package.json | cut -d'"' -f4)

echo -e "앱 버전: ${BLUE}${APP_VERSION}${NC}"
echo -e "패키지 버전: ${BLUE}${PACKAGE_VERSION}${NC}"

if [ "$APP_VERSION" == "$PACKAGE_VERSION" ]; then
  echo -e "${GREEN}✅ 버전 일치${NC}"
else
  echo -e "${RED}❌ 버전 불일치${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. Git 상태 확인"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Git 상태
CURRENT_BRANCH=$(git branch --show-current)
LATEST_COMMIT=$(git log -1 --pretty=format:"%h - %s (%cr)")

echo -e "현재 브랜치: ${BLUE}${CURRENT_BRANCH}${NC}"
echo -e "최근 커밋: ${LATEST_COMMIT}"

# 커밋되지 않은 변경
UNCOMMITTED=$(git status --porcelain | wc -l | tr -d ' ')
if [ "$UNCOMMITTED" -eq 0 ]; then
  echo -e "${GREEN}✅ 커밋되지 않은 변경 없음${NC}"
else
  echo -e "${YELLOW}⚠️  커밋되지 않은 변경: ${UNCOMMITTED}개${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. 모니터링 대시보드"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "📊 Firebase Console:"
echo "https://console.firebase.google.com/project/ganengile/overview"
echo ""
echo "📱 EAS Dashboard:"
echo "https://expo.dev"
echo ""
echo "🍎 App Store Connect:"
echo "https://appstoreconnect.apple.com"
echo ""
echo "🤖 Google Play Console:"
echo "https://play.google.com/console"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6. 모니터링 체크리스트"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "매일 확인:"
echo "  [ ] 에러 로그 확인 (Firebase Crashlytics)"
echo "  [ ] 성능 메트릭 확인 (Firebase Performance)"
echo "  [ ] 사용자 피드백 확인 (App Store/Play Store 리뷰)"
echo "  [ ] 크래시 보고서 확인"
echo ""
echo "매주 확인:"
echo "  [ ] 번들 사이즈 모니터링"
echo "  [ ] API 응답 시간 추적"
echo "  [ ] 사용자 참여도 분석"
echo ""

echo -e "${GREEN}✅ 모니터링 설정 완료${NC}"
echo ""
echo "다음 작업:"
echo "1. EAS Build 완료 대기"
echo "2. App Store/Play Store 업로드"
echo "3. 앱 심사 제출"
