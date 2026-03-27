# 배포와 환경변수

## 앱 웹 배포

앱 웹은 Expo 웹 빌드 후 Firebase Hosting으로 배포합니다.

주요 명령:

```bash
npm run web:export
npm run web:deploy
```

관련 설정:

- `firebase.json`
- `app.json`
- `scripts/postexport-web-assets.mjs`

## 관리자 웹 배포

관리자 웹은 Firebase App Hosting을 사용합니다.

관련 경로:

- `admin-web/`
- `firebase.json`

## 핵심 환경변수

- `EXPO_PUBLIC_SEOUL_FARE_API_URL`
- `EXPO_PUBLIC_SEOUL_FARE_SERVICE_KEY`
- `EXPO_PUBLIC_SEOUL_FARE_CACHE_ONLY`
- `EXPO_PUBLIC_KRIC_LOCKER_API_URL`
- `EXPO_PUBLIC_KRIC_SERVICE_KEY`
- `EXPO_PUBLIC_KRIC_RAIL_OPR_ISTT_CD`

## 배포 전 확인

- 앱 웹 빌드 성공
- 관리자 빌드 성공
- Firestore rules/indexes 반영
- `config_fares`와 역 매핑 최신 상태 확인
- 스모크 테스트 체크리스트 확인

## 재발 방지 규칙

- 환경변수 문서는 여기 한 곳에서만 관리합니다.
- 운임/사물함 API 키가 바뀌면 바로 이 문서를 갱신합니다.
- App Hosting 실패 원인은 `admin-web` 빌드 로그 기준으로 문서에 남깁니다.
