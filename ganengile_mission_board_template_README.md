# Figma에 “바로 넣을” 미션 보드 템플릿 사용법

제가 지금 환경에서 Figma를 직접 조작해서 페이지/프레임을 생성하는 자동화가 안정적으로 동작하지 않아, **Figma에 드래그&드롭만 하면 바로 뼈대가 생기는 SVG 템플릿**으로 먼저 전달드립니다.  
스크린샷은 말씀하신 대로 **영역(플레이스홀더)만 남겨둔 상태**입니다.

## 1) 파일
- `ganengile_mission_board_template.svg`

## 2) Figma에서 적용 방법(가장 쉬운 방법)
1. Figma 파일(ontheway)을 엽니다.
2. (권장) 새 페이지를 만듭니다: `Mission Board`
3. SVG 파일을 **캔버스에 드래그 & 드롭**합니다. (또는 File → Place image)
4. 가져온 그룹을 선택하고, 필요하면 아래처럼 정리합니다.
   - 각 큰 박스(Overview/Customer/Giller/Ops)를 선택 → **Frame selection**(프레임으로 감싸기)
   - 이름을 다음으로 맞춥니다:
     - `01_Overview / E2E Swimlane`
     - `02_Boards / Customer Board`
     - `02_Boards / Giller Board`
     - `02_Boards / Ops Board (Orchestration)`

## 3) 다음 단계(원하시는 “작성” 반영)
SVG는 “배치/영역”만 잡아둔 상태입니다. 다음 중 원하시는 방식으로 마무리하면 됩니다.

### A) 빠르게(추천)
- 이 템플릿 위에 카드 컴포넌트(요청 카드/미션 카드/운영 카드)를 만들고,
- 컬럼 안에 예시 카드 2~3개씩만 배치해서 “보드가 작동하는 느낌”을 만들기

### B) 정확하게
- 실제 서비스 스크린샷이 나오면, 우측 플레이스홀더 박스에 그대로 교체해서
- 카드 필드/상태/알림 규칙을 1:1로 맞추기

## 4) 로직 설계서는 여기
- `ganengile_mission_board_spec.md` 에 전체 사용자 로직/상태/예외/알림 규칙이 정리되어 있습니다.

