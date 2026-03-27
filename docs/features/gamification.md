# 게이미피케이션 시스템

## 배지 시스템 (Badges)
### 주요 화면
- 배지 컬렉션: `src/screens/main/BadgeCollectionScreen.tsx`

### 서비스
- 배지 관리: `src/services/BadgeService.ts`
- 배지 데이터: `src/data/badges.ts`

### 배지 카테고리
- 활동 (activity)
- 품질 (quality)
- 전문성 (expertise)
- 커뮤니티 (community)

### 배지 혜택
- 프로필 프레임
- 우선 매칭
- 추가 수수료 보너스

---

## 포인트 시스템 (Points)
### 주요 화면
- 포인트 내역: `src/screens/main/PointHistoryScreen.tsx`
- 포인트 출금: `src/screens/main/PointWithdrawScreen.tsx`

### 서비스
- 포인트 관리: `src/services/PointService.ts`

### 포인트 획득
- 배송 완료
- 평가 받기
- 연속 활동
- 배지 획득

### 포인트 사용
- 출금 (계좌 이체)
- 보증금 전환
- 기타 혜택

---

## 전문 길러 시스템 (Professional Giller)
### 주요 화면
- 길러 승급: `src/screens/main/GillerLevelUpgradeScreen.tsx`
- 등급 혜택: `src/screens/main/LevelBenefitsScreen.tsx`

### 서비스
- 전문 길러: `src/services/ProfessionalGillerService.ts`

### 길러 등급
- REGULAR (일반): 제한 없음
- PROFESSIONAL (전문가): 15% 보너스, 우선 매칭
- MASTER (마스터): 25% 보너스, 최우선 매칭

### 승급 조건
- 완료 배송 수
- 평점
- 활동 일수
- 최근 30일 배송 수
