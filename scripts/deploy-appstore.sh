#!/bin/bash

# App Store Connect 배포 스크립트

set -e

echo "🍎 App Store Connect 배포 시작..."
echo ""

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. EAS Build 실행"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "📦 iOS 빌드 중..."
eas build --platform ios --profile production

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ iOS 빌드 성공${NC}"
else
  echo -e "${RED}❌ iOS 빌드 실패${NC}"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. App Store Connect 업로드"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "📋 다음 단계:"
echo "1. Transport Desktop 실행"
echo "   open -a Transport"
echo ""
echo "2. App Store Connect 로그인"
echo "   https://appstoreconnect.apple.com"
echo ""
echo "3. '내 앱' → '가는길에' 선택"
echo ""
echo "4. '+' 버튼 클릭 → '새 버전' 선택"
echo ""
echo "5. 빌드된 .ipa 파일 드래그 앤 드롭"
echo "   (Transport Desktop의 왼쪽에서 빌드 선택)"
echo ""
echo "6. 버전 정보 입력"
echo "   - 버전: 1.0.0"
echo "   - 빌드 번호: 1"
echo "   - 알림: 사용자에게 새로운 기능 안내"
echo ""
echo "7. 스크린샷 업로드"
echo "   - iPhone 6.7\" (5.5\" 다기) 모든 스크린샷 필수"
echo "   - 6.7\" 5.5\" 6.5\" 6.1\" (Plus) 최소 1개"
echo "   - 5.5\" 모든 스크린샷 필수"
echo ""
echo "8. 심사 대기 (보통 1-2일)"
echo ""
echo -e "${YELLOW}⏸  현재: 한국에서 심사는 1-2일 소요${NC}"
echo ""
echo "9. 심사 완료 후 버전 배포"
echo "   - '가격 및 가용성' 탭에서 배포"
echo "   - '상태'를 '대기 중' → '준비 완료'로 변경"
echo "   - 저장 후 1-2시간 내 배포 완료"
echo ""
echo "10. 버전 릴리스 노트 작성"
echo "   - 배포 완료 후 '릴리스 노트' 작성"
echo "   - 주요 변경 사항 기록"
echo ""
echo -e "${GREEN}✅ App Store 배포 가이드 완료${NC}"
