#!/bin/bash

# Firebase 배포 스크립트

set -e  # 에러 발생 시 중단

echo "🔥 Firebase 배포 시작..."
echo ""

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 현재 브랜치 확인
CURRENT_BRANCH=$(git branch --show-current)
echo "현재 브랜치: $CURRENT_BRANCH"

if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
  echo -e "${YELLOW}⚠️  메인 브랜치가 아닙니다. 계속하시겠습니까? (y/N)${NC}"
  read -r response
  if [[ ! $response =~ ^[Yy]$ ]]; then
    echo "배포 취소"
    exit 1
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. 프로덕션 빌드"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 프로덕션 빌드
echo "📦 프로덕션 빌드 중..."
npm run build

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ 빌드 성공${NC}"
else
  echo -e "${RED}❌ 빌드 실패${NC}"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. Firestore Security Rules 배포"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Firestore Rules 배포
echo "🔐 Firestore Security Rules 배포 중..."
firebase deploy --only firestore:rules

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Firestore Rules 배포 성공${NC}"
else
  echo -e "${RED}❌ Firestore Rules 배포 실패${NC}"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. Storage Security Rules 배포"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Storage Rules 배포
echo "💾 Storage Security Rules 배포 중..."
firebase deploy --only storage:rules

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Storage Rules 배포 성공${NC}"
else
  echo -e "${YELLOW}⚠️  Storage Rules 배포 실패 (선택사항)${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. Hosting 배포"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Hosting 배포
echo "🌐 Firebase Hosting 배포 중..."
firebase deploy --only hosting

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Hosting 배포 성공${NC}"
else
  echo -e "${RED}❌ Hosting 배포 실패${NC}"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. Functions 배포 (선택사항)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo -n "Functions 배포를 진행하시겠습니까? (y/N): "
read -r response

if [[ $response =~ ^[Yy]$ ]]; then
  echo "⚡ Cloud Functions 배포 중..."
  firebase deploy --only functions

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Functions 배포 성공${NC}"
  else
    echo -e "${RED}❌ Functions 배포 실패${NC}"
    exit 1
  fi
else
  echo -e "${YELLOW}⏭  Functions 배포 건너뜀${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 배포 요약"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Firebase Hosting URL:"
echo "https://ganengile.web.app"
echo ""
echo "Firebase Console:"
echo "https://console.firebase.google.com/project/ganengile/overview"
echo ""
echo -e "${GREEN}✅ 배포 완료!${NC}"
echo ""
echo "다음 단계:"
echo "1. App Store / Play Store 배포 준비"
echo "2. 배포 후 모니터링 시작"
