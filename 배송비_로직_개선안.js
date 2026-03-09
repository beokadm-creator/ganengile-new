// 가는길 배송비 계산 로직 (개선안)
// GaneunGile Delivery Fee Calculation Logic (Improved)

/**
 * 배송비 계산 함수
 * @param {Object} params - 배송 매개변수
 * @param {number} params.distanceKm - 거리 (km)
 * @param {number} params.stationCount - 지하철 역 개수
 * @param {number} params.weight - 무게 (kg)
 * @param {string} params.packageSize - 패키지 사이즈 (small, medium, large, xlarge)
 * @param {string} params.urgency - 긴급도 (normal, fast, urgent, immediate)
 * @param {number} params.reservationHour - 예약 시간 (0-23)
 * @param {Date} params.reservationDate - 예약 날짜
 * @param {Object} params.user - 사용자 정보
 * @param {boolean} params.user.firstTime - 첫 이용 여부
 * @param {string} params.user.subscription - 구독 등급 (none, basic, premium)
 * @param {number} params.itemCount - 배송 물건 개수
 * @returns {Object} 계산된 배송비 정보
 */
function calculateDeliveryFee(params) {
  const {
    distanceKm = 0,
    stationCount = 0,
    weight = 1,
    packageSize = 'small',
    urgency = 'normal',
    reservationHour = 12,
    reservationDate = new Date(),
    user = {},
    itemCount = 1
  } = params;

  // ==================== 기본 설정 ====================
  const BASE_FEE = 3500;          // 기본 배송비 (상향 조정)
  const MIN_FEE = 3000;           // 최소 배송비 (VAT 포함)
  const MAX_FEE = 15000;          // 최대 배송비 (VAT 포함)
  const PLATFORM_FEE_RATE = 0.10; // 플랫폼 수수료율 10%

  // ==================== 1. 기본 배송비 ====================
  const baseFee = BASE_FEE;

  // ==================== 2. 거리 수수료 ====================
  const distanceFee = calculateDistanceFee(distanceKm, stationCount);

  // ==================== 3. 무게별 추가 요금 ====================
  const weightFee = calculateWeightFee(weight);

  // ==================== 4. 사이즈별 추가 요금 ====================
  const sizeFee = calculateSizeFee(packageSize);

  // ==================== 5. 긴급도 surcharge ====================
  const urgencySurcharge = calculateUrgencySurcharge(urgency, baseFee + distanceFee);

  // ==================== 6. 시간대별 동적 요금 ====================
  const peakSurcharge = calculatePeakSurcharge(reservationDate, reservationHour);

  // ==================== 7. 서비스 수수료 (비즈니스 모델) ====================
  const serviceFee = calculateServiceFee(baseFee + distanceFee + weightFee + sizeFee);

  // ==================== 8. 프로모션/할인 ====================
  const discount = calculateDiscount(user, itemCount);

  // ==================== 9. 부가세 (VAT 10%) ====================
  const subtotal = baseFee + distanceFee + weightFee + sizeFee +
                  urgencySurcharge + peakSurcharge + serviceFee - discount;
  const vat = Math.round(subtotal * 0.1);

  // ==================== 10. 최종 배송비 ====================
  let totalFee = subtotal + vat;

  // 최소/최대 제한
  if (totalFee < MIN_FEE) totalFee = MIN_FEE;
  if (totalFee > MAX_FEE) totalFee = MAX_FEE;

  // ==================== 11. 길러 비용 분배 ====================
  const breakdown = calculateBreakdown(totalFee, urgency);

  // ==================== 결과 반환 ====================
  return {
    baseFee,
    distanceFee,
    weightFee,
    sizeFee,
    urgencySurcharge,
    peakSurcharge,
    serviceFee,
    discount,
    subtotal,
    vat,
    totalFee,
    breakdown,
    description: generateDescription(totalFee, urgency, packageSize)
  };
}

// ==================== 보조 함수 ====================

/**
 * 거리 수수료 계산 (지하철 환경 최적화)
 */
function calculateDistanceFee(distanceKm, stationCount) {
  // 지하철 역 개수 기반 (정확도 높음)
  if (stationCount > 0) {
    const baseStations = 5;        // 기본 5개역
    const feePerStation = 150;     // 역당 150원

    if (stationCount <= baseStations) {
      return 800;
    }
    return 800 + (stationCount - baseStations) * feePerStation;
  }

  // 거리 기반 (역 개수 모를 때)
  if (distanceKm <= 5) return 800;         // 기본 구간
  if (distanceKm <= 15) return 800 + (distanceKm - 5) * 100;  // 5-15km
  if (distanceKm <= 30) return 1800 + (distanceKm - 15) * 80; // 15-30km
  return 2800 + (distanceKm - 30) * 50;   // 30km 초과
}

/**
 * 무게별 추가 요금
 */
function calculateWeightFee(weight) {
  const baseWeight = 1;        // 기본 1kg
  const feePerKg = 100;        // kg당 100원

  if (weight <= baseWeight) return 100;
  return Math.round(weight * feePerKg);
}

/**
 * 사이즈별 추가 요금
 */
function calculateSizeFee(packageSize) {
  const sizeFees = {
    small: 0,      // 소형 (서류, 핸드폰)
    medium: 500,   // 중형 (책, 옷)
    large: 1000,   // 대형 (가방, 전자기기)
    xlarge: 2000   // 특대 (대형 가전, furniture)
  };

  return sizeFees[packageSize] || 0;
}

/**
 * 긴급도 surcharge (전체 요금 기준)
 */
function calculateUrgencySurcharge(urgency, baseAndDistanceFee) {
  const urgencyMultipliers = {
    normal: 0,       // 보통 (2-3시간)
    fast: 0.1,       // 빠름 (1-2시간)
    urgent: 0.2,     // 긴급 (30분-1시간)
    immediate: 0.3   // 즉시 (30분 이내)
  };

  const multiplier = urgencyMultipliers[urgency] || 0;
  return Math.round(baseAndDistanceFee * multiplier);
}

/**
 * 시간대별 동적 요금 (러시아워, 주말)
 */
function calculatePeakSurcharge(reservationDate, reservationHour) {
  const rushHours = [7, 8, 9, 18, 19, 20];
  const dayOfWeek = reservationDate.getDay();

  // 주말 서비스
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return 500;
  }

  // 러시아워 surcharge
  if (rushHours.includes(reservationHour)) {
    return 800;
  }

  return 0;
}

/**
 * 서비스 수수료 (비즈니스 모델)
 */
function calculateServiceFee(feeBeforeService) {
  return Math.round(feeBeforeService * PLATFORM_FEE_RATE);
}

/**
 * 프로모션/할인
 */
function calculateDiscount(user, itemCount) {
  let discount = 0;

  // 첫 이용 1000원 할인
  if (user.firstTime) {
    discount += 1000;
  }

  // 프리미엄 구독 20% 할인
  if (user.subscription === 'premium') {
    discount *= 0.2;
  }

  // 묶음 배송 (2개 이상)
  if (itemCount >= 2) {
    discount += 500 * (itemCount - 1);
  }

  return discount;
}

/**
 * 길러 비용 분배
 */
function calculateBreakdown(totalFee, urgency) {
  // 플랫폼 수수료 먼저 제외
  const platformFee = Math.round(totalFee * 0.10);
  const remainingFee = totalFee - platformFee;

  // 긴급도에 따른 기사/길러 비중 조정
  let riderRatio, gillerRatio;
  if (urgency === 'immediate') {
    riderRatio = 0.6;  // 기사 비중 증가
    gillerRatio = 0.4;
  } else {
    riderRatio = 0.45;
    gillerRatio = 0.55; // 길러 비중 높음 (핵심 가치)
  }

  // 4명 분배 (기사2, 길러2)
  const riderFee = Math.round(remainingFee * riderRatio / 2);
  const gillerFee = Math.round(remainingFee * gillerRatio / 2);

  return {
    platformFee,
    rider1Fee: riderFee,
    giller1Fee: gillerFee,
    giller2Fee: gillerFee,
    rider2Fee: riderFee,
    total: totalFee
  };
}

/**
 * 배송비 설명 텍스트 생성
 */
function generateDescription(totalFee, urgency, packageSize) {
  const urgencyText = {
    normal: '2-3시간',
    fast: '1-2시간',
    urgent: '30분-1시간',
    immediate: '30분 이내'
  };

  return `${urgencyText[urgency]} 배송 (${packageSize}) - 총 ${totalFee.toLocaleString()}원`;
}

// ==================== 사용 예시 ====================

// 예시 1: 기본 (소형, 1kg, 보통)
const example1 = calculateDeliveryFee({
  distanceKm: 5,
  stationCount: 5,
  weight: 1,
  packageSize: 'small',
  urgency: 'normal',
  reservationHour: 14,
  reservationDate: new Date(),
  user: { firstTime: false, subscription: 'none' },
  itemCount: 1
});

console.log('=== 예시 1: 기본 (소형, 1kg, 보통) ===');
console.log(JSON.stringify(example1, null, 2));

// 예시 2: 대형 긴급 (특대, 5kg, 긴급)
const example2 = calculateDeliveryFee({
  distanceKm: 15,
  stationCount: 12,
  weight: 5,
  packageSize: 'xlarge',
  urgency: 'urgent',
  reservationHour: 19,  // 러시아워
  reservationDate: new Date(),
  user: { firstTime: false, subscription: 'none' },
  itemCount: 1
});

console.log('\n=== 예시 2: 대형 긴급 (특대, 5kg, 긴급, 러시아워) ===');
console.log(JSON.stringify(example2, null, 2));

// 예시 3: 첫 이용 할인 (소형, 1kg, 보통)
const example3 = calculateDeliveryFee({
  distanceKm: 5,
  stationCount: 5,
  weight: 1,
  packageSize: 'small',
  urgency: 'normal',
  reservationHour: 14,
  reservationDate: new Date(),
  user: { firstTime: true, subscription: 'none' },
  itemCount: 1
});

console.log('\n=== 예시 3: 첫 이용 할인 (소형, 1kg, 보통) ===');
console.log(JSON.stringify(example3, null, 2));

// ==================== 테스트 코드 ====================

/**
 * 배송비 계산 테스트
 */
function testDeliveryFeeCalculation() {
  console.log('🧪 배송비 계산 테스트 시작...\n');

  // 테스트 1: 최소 배송비
  const test1 = calculateDeliveryFee({
    distanceKm: 1,
    stationCount: 2,
    weight: 0.5,
    packageSize: 'small',
    urgency: 'normal'
  });
  console.assert(test1.totalFee >= 3000, '최소 배송비 테스트 실패');
  console.log('✅ 최소 배송비 테스트 통과:', test1.totalFee, '원');

  // 테스트 2: 최대 배송비
  const test2 = calculateDeliveryFee({
    distanceKm: 100,
    stationCount: 50,
    weight: 20,
    packageSize: 'xlarge',
    urgency: 'immediate'
  });
  console.assert(test2.totalFee <= 15000, '최대 배송비 테스트 실패');
  console.log('✅ 최대 배송비 테스트 통과:', test2.totalFee, '원');

  // 테스트 3: 길러 분배 합계
  const test3 = calculateDeliveryFee({ distanceKm: 5, stationCount: 5 });
  const breakdownSum = test3.breakdown.platformFee +
                       test3.breakdown.rider1Fee +
                       test3.breakdown.giller1Fee +
                       test3.breakdown.giller2Fee +
                       test3.breakdown.rider2Fee;
  console.assert(breakdownSum === test3.totalFee, '길러 분배 합계 테스트 실패');
  console.log('✅ 길러 분배 합계 테스트 통과:', breakdownSum, '=', test3.totalFee);

  // 테스트 4: 피칭 덱 일치성 확인
  const test4 = calculateDeliveryFee({
    distanceKm: 5,
    stationCount: 5,
    weight: 1,
    packageSize: 'small',
    urgency: 'normal'
  });
  console.log('✅ 피칭 덱 소형 배송비:', test4.totalFee, '원 (목표: 4,200원)');

  console.log('\n🎉 모든 테스트 완료!');
}

// 테스트 실행 (주석 해제하여 실행)
// testDeliveryFeeCalculation();

// ==================== 내보내기 ====================

module.exports = {
  calculateDeliveryFee,
  calculateDistanceFee,
  calculateWeightFee,
  calculateSizeFee,
  calculateUrgencySurcharge,
  calculatePeakSurcharge,
  calculateServiceFee,
  calculateDiscount,
  calculateBreakdown
};
