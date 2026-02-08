#!/bin/bash

# 서울열린데이터광장 역사마스터 정보 다운로드 스크립트
# API: http://openapi.seoul.go.kr:8088

set -e

# 설정
API_KEY="69544c51526d657438386e71595275"
API_BASE="http://openapi.seoul.go.kr:8088"
SERVICE="subwayStationMaster"
OUTPUT_DIR="${HOME}/Downloads"
OUTPUT_JSON="${OUTPUT_DIR}/subway-stations-seoul.json"
OUTPUT_XML="${OUTPUT_DIR}/subway-stations-seoul.xml"

# 총 데이터 수 (783개 역)
TOTAL_COUNT=783
START_INDEX=1
END_INDEX=${TOTAL_COUNT}

echo "======================================"
echo "서울열린데이터광장 역사마스터 정보 다운로드"
echo "======================================"
echo "API: ${API_BASE}"
echo "서비스: ${SERVICE}"
echo "데이터 수: ${TOTAL_COUNT}개 역"
echo "출력 파일: ${OUTPUT_JSON}"
echo ""

# JSON 다운로드
echo "JSON 데이터 다운로드 중..."
curl -s "${API_BASE}/${API_KEY}/json/${SERVICE}/${START_INDEX}/${END_INDEX}/" \
  -o "${OUTPUT_JSON}"

if [ $? -eq 0 ]; then
  echo "✅ JSON 다운로드 완료: ${OUTPUT_JSON}"
  
  # 파일 크기 확인
  FILE_SIZE=$(wc -c < "${OUTPUT_JSON}")
  echo "   파일 크기: ${FILE_SIZE} bytes"
else
  echo "❌ JSON 다운로드 실패"
  exit 1
fi

echo ""

# XML 다운로드 (선택)
echo "XML 데이터 다운로드 중..."
curl -s "${API_BASE}/${API_KEY}/xml/${SERVICE}/${START_INDEX}/${END_INDEX}/" \
  -o "${OUTPUT_XML}"

if [ $? -eq 0 ]; then
  echo "✅ XML 다운로드 완료: ${OUTPUT_XML}"
  
  # 파일 크기 확인
  FILE_SIZE=$(wc -c < "${OUTPUT_XML}")
  echo "   파일 크기: ${FILE_SIZE} bytes"
else
  echo "❌ XML 다운로드 실패"
fi

echo ""
echo "======================================"
echo "다운로드 완료!"
echo "======================================"
echo ""
echo "다음 단계:"
echo "1. 데이터 확인: cat ${OUTPUT_JSON} | head -20"
echo "2. 변환 스크립트 실행: npm run convert-stations"
echo ""
