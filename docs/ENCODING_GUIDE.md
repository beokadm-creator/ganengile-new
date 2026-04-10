# 한글 인코딩 가이드

이 저장소의 텍스트 파일은 기본적으로 `UTF-8 without BOM` + `LF`를 기준으로 관리합니다.

## 기준

- 소스코드(`.ts`, `.tsx`, `.js`, `.jsx`)는 `UTF-8 without BOM`으로 저장합니다.
- 문서(`.md`, `.json`, `.yml`)도 `UTF-8 without BOM`으로 저장합니다.
- Windows PowerShell에서 파일을 다시 저장할 때는 `UTF-8 BOM`이 붙지 않도록 확인합니다.
- 가능하면 에디터 자동 저장 시 인코딩 변환 기능을 끕니다.

## 저장소 설정

- [.editorconfig](/C:/Users/whhol/Documents/trae_projects/ganengile/.editorconfig)
  - 기본 charset을 `utf-8`
  - 기본 줄바꿈을 `lf`
- [.gitattributes](/C:/Users/whhol/Documents/trae_projects/ganengile/.gitattributes)
  - 텍스트 파일을 Git 기준으로 일관되게 정규화
  - 이미지/PDF는 binary로 고정

## 작업 원칙

- PowerShell `Set-Content`를 사용할 때는 반드시 `-Encoding utf8`을 명시합니다.
- 가능하면 `npm run fix:encoding`으로 저장소 기준(`UTF-8 without BOM` + `LF`)을 다시 맞춥니다.
- 한글이 들어가는 파일을 터미널에서 대량 치환할 때는 먼저 파일 인코딩을 확인합니다.
- 깨진 문자열이 보이면 “문자열만 고친다”로 끝내지 말고, 저장한 도구와 인코딩 경로를 함께 확인합니다.
- 새 파일을 만들 때는 복붙 원문이 이미 깨져 있지 않은지 먼저 확인합니다.

## 권장 점검 순서

1. 에디터 인코딩이 `UTF-8`인지 확인
2. 저장 후 `git diff`에서 한글이 깨지지 않았는지 확인
3. `npm run check:encoding` 으로 깨진 문자열 패턴과 BOM 여부를 검사
4. BOM 또는 줄바꿈이 섞였으면 `npm run fix:encoding` 으로 정규화
5. 터미널 출력이 깨질 경우 파일 자체가 아니라 콘솔 코드페이지 문제인지 분리 확인
6. 화면 문자열이면 실제 앱에서 렌더링까지 확인

## 현재 확인된 주의 파일

- [src/services/realtime-delivery-tracking.ts](/C:/Users/whhol/Documents/trae_projects/ganengile/src/services/realtime-delivery-tracking.ts)
- [src/services/transfer-service.ts](/C:/Users/whhol/Documents/trae_projects/ganengile/src/services/transfer-service.ts)
위 파일들은 깨진 한글 주석/문자열 흔적이 있어, 기능 수정 시 인코딩을 가장 먼저 확인해야 합니다. `RealtimeSubwayService.ts`는 제거되었습니다.
