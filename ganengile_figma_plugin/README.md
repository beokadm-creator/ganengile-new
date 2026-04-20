# Ganengile Mission Board Generator (Figma Dev Plugin)

“Figma에 자동으로 미션 보드(4프레임)를 생성”하는 개발용 플러그인입니다.

## 1) 설치(Development plugin)
1. 이 폴더를 로컬에 둔 상태로 Figma를 엽니다.
2. 메뉴: **Plugins → Development → Import plugin from manifest…**
3. 이 폴더의 `manifest.json`을 선택합니다.

## 2) 실행
1. Figma에서 해당 파일(ontheway)을 연 뒤,
2. 메뉴: **Plugins → Development → Ganengile Mission Board Generator**
3. 플러그인 창에서 **“보드 자동 생성”** 클릭

## 3) 생성 결과
`Mission Board` 페이지를 만들고(있으면 재사용),
아래 프레임 4개를 자동 생성합니다.
- `01_Overview / E2E Swimlane`
- `02_Boards / Customer Board`
- `02_Boards / Giller Board`
- `02_Boards / Ops Board`

각 프레임에는:
- 컬럼(상태) 헤더
- 예시 카드(요청/미션/운영)
- 스크린샷 플레이스홀더 박스  
까지 들어갑니다.

## 4) 되돌리기
생성 직후 **Undo(Cmd/Ctrl+Z)** 로 되돌릴 수 있습니다.

