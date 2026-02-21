#!/bin/bash

# 웹 정적 빌드 생성 스크립트
set -e

echo "======================================"
echo "📦 웹 정적 빌드 생성"
echo "======================================"
echo ""

# 1. 이전 빌드 정리
echo "🧹 이전 빌드 정리..."
rm -rf dist
mkdir -p dist

# 2. Expo SDK 54 웹 빌드
echo "🔨 Expo 웹 빌드 시작..."
# Expo SDK 54에서는 expo export 사용
npx expo export --platform web --output-dir dist

echo ""
echo "✅ 빌드 완료!"
echo ""
echo "생성된 파일:"
ls -la dist/ | head -10

echo ""
echo "======================================"
echo "🚀 Firebase Hosting 배포"
echo "======================================"
echo ""

# 3. Firebase 배포
firebase deploy --only hosting --project ganengile

echo ""
echo "======================================"
echo "✅ 배포 완료!"
echo "======================================"
echo ""
echo "URL: https://ganengile.web.app"
echo ""
