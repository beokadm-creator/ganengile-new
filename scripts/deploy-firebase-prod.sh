#!/bin/bash

# Firebase 배포 스크립트
# Date: $(date +%Y-%m-%d)

set -e  # 에러 발생시 중지

echo "======================================"
echo "🔥 Firebase 배포 시작"
echo "======================================"
echo ""

# 1. Firestore Rules 배포
echo "📜 1. Firestore Rules 배포..."
firebase deploy --only firestore:rules --project ganengile

echo ""
echo "✅ Firestore Rules 배포 완료"
echo ""

# 2. Hosting 배포
echo "🌐 2. Hosting 배포..."
firebase deploy --only hosting --project ganengile

echo ""
echo "✅ Hosting 배포 완료"
echo ""

# 3. Functions 배포 (선택)
echo "⚡ 3. Functions 배포 (선택사항)..."
read -p "Functions를 배포하시겠습니까? (y/n): " deploy_functions

if [ "$deploy_functions" = "y" ]; then
    firebase deploy --only functions --project ganengile
    echo ""
    echo "✅ Functions 배포 완료"
else
    echo "⏭️  Functions 배포 스킵"
fi

echo ""
echo "======================================"
echo "🎉 Firebase 배포 완료!"
echo "======================================"
echo ""
echo "배포 정보:"
echo "- Project: ganengile"
echo "- Region: asia-northeast3"
echo "- Date: $(date)"
echo ""
echo "다음 단계:"
echo "1. 웹 앱 확인: https://ganengile.web.app"
echo "2. EAS Build 진행"
echo ""
