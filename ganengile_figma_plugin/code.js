// Ganengile Mission Board Generator
// - UI에서 버튼 클릭 시, Mission Board 페이지와 4개 프레임(E2E/Customer/Giller/Ops)을 자동 생성
// - 스크린샷 영역은 플레이스홀더 박스로 남겨둠

figma.showUI(__html__, { width: 320, height: 220 });

const COLORS = {
  bg: { r: 248 / 255, g: 250 / 255, b: 252 / 255 },
  white: { r: 1, g: 1, b: 1 },
  border: { r: 208 / 255, g: 213 / 255, b: 221 / 255 },
  borderLight: { r: 234 / 255, g: 236 / 255, b: 240 / 255 },
  headerFill: { r: 242 / 255, g: 244 / 255, b: 247 / 255 },
  headerStroke: { r: 228 / 255, g: 231 / 255, b: 236 / 255 },
  text: { r: 16 / 255, g: 24 / 255, b: 40 / 255 },
  muted: { r: 102 / 255, g: 112 / 255, b: 133 / 255 },
  primary: { r: 53 / 255, g: 56 / 255, b: 205 / 255 },
  danger: { r: 180 / 255, g: 35 / 255, b: 24 / 255 },
  success: { r: 2 / 255, g: 122 / 255, b: 72 / 255 }
};

function solidPaint(rgb) {
  return [{ type: "SOLID", color: rgb }];
}

function strokePaint(rgb) {
  return [{ type: "SOLID", color: rgb }];
}

function setStrokes(node, rgb, weight = 1) {
  node.strokes = strokePaint(rgb);
  node.strokeWeight = weight;
}

function setFills(node, rgb) {
  node.fills = solidPaint(rgb);
}

async function ensureFonts() {
  // Inter는 대부분의 Figma 환경에 기본 포함
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });
}

function createText(text, { x, y, fontSize = 12, bold = false, color = COLORS.text, parent }) {
  const t = figma.createText();
  t.characters = text;
  t.fontName = { family: "Inter", style: bold ? "Bold" : "Regular" };
  t.fontSize = fontSize;
  t.fills = solidPaint(color);
  t.x = x;
  t.y = y;
  parent.appendChild(t);
  return t;
}

function createRect({ x, y, w, h, r = 12, fill = COLORS.white, stroke = COLORS.borderLight, strokeWeight = 1, parent }) {
  const rect = figma.createRectangle();
  rect.x = x;
  rect.y = y;
  rect.resize(w, h);
  rect.cornerRadius = r;
  setFills(rect, fill);
  setStrokes(rect, stroke, strokeWeight);
  parent.appendChild(rect);
  return rect;
}

function createDashedPlaceholder({ x, y, w, h, label, parent }) {
  const rect = figma.createRectangle();
  rect.x = x;
  rect.y = y;
  rect.resize(w, h);
  rect.cornerRadius = 12;
  rect.fills = solidPaint(COLORS.white);
  rect.strokes = strokePaint({ r: 152 / 255, g: 162 / 255, b: 179 / 255 });
  rect.strokeWeight = 2;
  rect.dashPattern = [8, 6];
  parent.appendChild(rect);
  createText(label, { x: x + 14, y: y + 12, fontSize: 12, bold: true, color: COLORS.muted, parent });
  return rect;
}

function getOrCreatePage(name) {
  const existing = figma.root.children.find((p) => p.type === "PAGE" && p.name === name);
  if (existing) return existing;
  const p = figma.createPage();
  p.name = name;
  return p;
}

function createFrame({ name, x, y, w = 1440, h = 1024, parent }) {
  const f = figma.createFrame();
  f.name = name;
  f.x = x;
  f.y = y;
  f.resize(w, h);
  f.fills = solidPaint(COLORS.white);
  f.strokes = strokePaint(COLORS.border);
  f.strokeWeight = 2;
  f.cornerRadius = 16;
  parent.appendChild(f);
  return f;
}

function addBoardTitle(frame, title, subtitle) {
  createText(title, { x: 32, y: 26, fontSize: 20, bold: true, parent: frame });
  if (subtitle) createText(subtitle, { x: 32, y: 54, fontSize: 12, bold: false, color: COLORS.muted, parent: frame });
}

function addCustomerBoard(frame) {
  addBoardTitle(frame, "Customer Board", "배송요청(Shipment) 기준 — 컬럼/예시 카드 포함");

  const boardX = 32;
  const boardY = 92;
  const boardW = 1376;
  const boardH = 900;
  createRect({ x: boardX, y: boardY, w: boardW, h: boardH, r: 12, fill: COLORS.white, stroke: COLORS.borderLight, strokeWeight: 2, parent: frame });

  const cols = ["작성중", "결제/확정", "배차 대기", "진행중", "완료", "문제 발생", "취소/반송"];
  const colW = 184;
  const gap = 10;
  const startX = boardX + 20;
  const headerY = boardY + 24;

  cols.forEach((c, i) => {
    const x = startX + i * (colW + gap);
    createRect({ x, y: headerY, w: colW, h: 40, r: 10, fill: COLORS.headerFill, stroke: COLORS.headerStroke, strokeWeight: 1, parent: frame });
    createText(c, { x: x + 12, y: headerY + 12, fontSize: 12, bold: true, color: { r: 52 / 255, g: 64 / 255, b: 84 / 255 }, parent: frame });
  });

  // Example cards (2~3개만)
  function card(x, y, lines, badge) {
    createRect({ x, y, w: colW - 16, h: 132, r: 12, fill: COLORS.white, stroke: COLORS.border, strokeWeight: 1, parent: frame });
    let ty = y + 12;
    lines.forEach((l, idx) => {
      createText(l, { x: x + 12, y: ty, fontSize: idx === 0 ? 12 : 11, bold: idx === 0, color: idx === 1 && badge ? badge : idx === 0 ? COLORS.text : { r: 71 / 255, g: 84 / 255, b: 103 / 255 }, parent: frame });
      ty += idx === 0 ? 20 : 18;
    });
  }

  const cardY1 = headerY + 52;
  const cardY2 = cardY1 + 146;
  card(startX + 0 * (colW + gap) + 8, cardY1, ["REQ-1042", "Hybrid", "픽업: 성수역 인근", "도착: 홍대입구역", "다음: 요청 생성"], COLORS.primary);
  card(startX + 1 * (colW + gap) + 8, cardY1, ["REQ-1038", "PaymentPending", "요금: 6,900원", "증빙: 사진", "다음: 결제하기"], COLORS.danger);
  card(startX + 2 * (colW + gap) + 8, cardY1, ["REQ-1021", "Paid", "SLA: 18:20 픽업", "SLA: 19:10 도착", "다음: 배차 대기"], COLORS.success);
  card(startX + 3 * (colW + gap) + 8, cardY1, ["REQ-1008", "InTransit", "현재 Leg: 역→역(2호선)", "ETA: 12분", "다음: 추적 보기"], COLORS.primary);
  card(startX + 4 * (colW + gap) + 8, cardY1, ["REQ-0988", "Delivered", "증빙: 사진 1장", "완료: 18:32", "다음: 평가/팁"], COLORS.success);
  card(startX + 5 * (colW + gap) + 8, cardY1, ["REQ-1015", "Incident: 부재", "옵션: 재시도/반송", "운영 응답 대기", "다음: 조치 확인"], COLORS.danger);
  card(startX + 6 * (colW + gap) + 8, cardY1, ["REQ-0971", "Cancelled", "사유: 요청자 취소", "환불: 정책 적용", "다음: 없음"], COLORS.danger);

  // Screenshot placeholders (right side within frame, simple stack)
  createDashedPlaceholder({ x: 1060, y: 150, w: 332, h: 200, label: "SCREENSHOT PLACEHOLDER — 고객 화면", parent: frame });
  createDashedPlaceholder({ x: 1060, y: 370, w: 332, h: 200, label: "… 요청 상세/추적/채팅", parent: frame });
  createDashedPlaceholder({ x: 1060, y: 590, w: 332, h: 200, label: "… 클레임/이슈", parent: frame });
}

function addGillerBoard(frame) {
  addBoardTitle(frame, "Giller Board", "전문길러(라이더/기사) 미션(Job) — 오퍼/수행/증빙/정산");

  const boardX = 32;
  const boardY = 92;
  const boardW = 1376;
  const boardH = 900;
  createRect({ x: boardX, y: boardY, w: boardW, h: boardH, r: 12, fill: COLORS.white, stroke: COLORS.borderLight, strokeWeight: 2, parent: frame });

  const cols = ["오퍼", "수락/예정", "픽업", "이동중", "인계/전달", "완료", "이슈", "정산"];
  const colW = 156;
  const gap = 10;
  const startX = boardX + 20;
  const headerY = boardY + 24;

  cols.forEach((c, i) => {
    const x = startX + i * (colW + gap);
    createRect({ x, y: headerY, w: colW, h: 40, r: 10, fill: COLORS.headerFill, stroke: COLORS.headerStroke, strokeWeight: 1, parent: frame });
    createText(c, { x: x + 12, y: headerY + 12, fontSize: 12, bold: true, color: { r: 52 / 255, g: 64 / 255, b: 84 / 255 }, parent: frame });
  });

  function card(x, y, lines, badge) {
    createRect({ x, y, w: colW - 16, h: 150, r: 12, fill: COLORS.white, stroke: COLORS.border, strokeWeight: 1, parent: frame });
    let ty = y + 12;
    lines.forEach((l, idx) => {
      createText(l, { x: x + 12, y: ty, fontSize: idx === 0 ? 12 : 11, bold: idx === 0, color: idx === 1 && badge ? badge : idx === 0 ? COLORS.text : { r: 71 / 255, g: 84 / 255, b: 103 / 255 }, parent: frame });
      ty += idx === 0 ? 20 : 18;
    });
  }

  const cardY1 = headerY + 52;
  card(startX + 0 * (colW + gap) + 8, cardY1, ["JOB-2201", "Leg: 문→역", "SLA: 18:20", "보상: 5,200", "다음: 수락/거절"], COLORS.primary);
  card(startX + 1 * (colW + gap) + 8, cardY1, ["JOB-2191", "Accepted", "픽업: 성수역", "증빙: 사진", "다음: 출발"], COLORS.success);
  card(startX + 2 * (colW + gap) + 8, cardY1, ["JOB-2184", "To Pickup", "체크인 필요", "SLA: 18:05", "다음: 픽업"], COLORS.primary);
  card(startX + 3 * (colW + gap) + 8, cardY1, ["JOB-2179", "InTransit", "Leg: 역→역(2호선)", "ETA: 9분", "다음: 인계 준비"], COLORS.primary);
  card(startX + 4 * (colW + gap) + 8, cardY1, ["JOB-2171", "Dropoff", "증빙: OTP", "연락 필요", "다음: 완료"], COLORS.primary);
  card(startX + 5 * (colW + gap) + 8, cardY1, ["JOB-2155", "Done", "증빙: 사진 1장", "완료: 18:32", "다음: 없음"], COLORS.success);
  card(startX + 6 * (colW + gap) + 8, cardY1, ["JOB-2168", "Incident", "사유: 인계 실패", "조치: 운영 호출", "다음: 재배차"], COLORS.danger);
  card(startX + 7 * (colW + gap) + 8, cardY1, ["주간 정산", "4/15~4/21", "완료: 21건", "예상: 128,400", "다음: 상세"], COLORS.primary);

  createDashedPlaceholder({ x: 1060, y: 150, w: 332, h: 200, label: "SCREENSHOT PLACEHOLDER — 길러 홈/미션", parent: frame });
  createDashedPlaceholder({ x: 1060, y: 370, w: 332, h: 200, label: "… 미션 수행/증빙", parent: frame });
  createDashedPlaceholder({ x: 1060, y: 590, w: 332, h: 200, label: "… 정산/수익", parent: frame });
}

function addOpsBoard(frame) {
  addBoardTitle(frame, "Ops Board (Orchestration)", "주문(Shipment) + 미션(Job) 2단 보드, At Risk/재배차 포함");

  const boardX = 32;
  const boardY = 92;
  const boardW = 1376;
  const boardH = 900;
  createRect({ x: boardX, y: boardY, w: boardW, h: boardH, r: 12, fill: COLORS.white, stroke: COLORS.borderLight, strokeWeight: 2, parent: frame });

  // Shipment row
  createText("주문(Shipment) 보드", { x: boardX + 20, y: boardY + 18, fontSize: 12, bold: true, color: COLORS.text, parent: frame });
  const shipCols = ["신규", "검증 보류", "배차 설계", "모니터링", "예외 대응", "정산/리포트", "클로즈"];
  const shipColW = 180;
  const gap = 10;
  const startX = boardX + 20;
  const shipHeaderY = boardY + 40;

  shipCols.forEach((c, i) => {
    const x = startX + i * (shipColW + gap);
    createRect({ x, y: shipHeaderY, w: shipColW, h: 40, r: 10, fill: COLORS.headerFill, stroke: COLORS.headerStroke, strokeWeight: 1, parent: frame });
    createText(c, { x: x + 12, y: shipHeaderY + 12, fontSize: 12, bold: true, color: { r: 52 / 255, g: 64 / 255, b: 84 / 255 }, parent: frame });
  });

  function card(x, y, w, h, lines, badgeColor, bgColor) {
    createRect({ x, y, w, h, r: 12, fill: bgColor || COLORS.white, stroke: COLORS.border, strokeWeight: 1, parent: frame });
    let ty = y + 12;
    lines.forEach((l, idx) => {
      createText(l, { x: x + 12, y: ty, fontSize: idx === 0 ? 12 : 11, bold: idx === 0, color: idx === 1 && badgeColor ? badgeColor : idx === 0 ? COLORS.text : { r: 71 / 255, g: 84 / 255, b: 103 / 255 }, parent: frame });
      ty += idx === 0 ? 20 : 18;
    });
  }

  const shipCardY = shipHeaderY + 52;
  card(startX + 0 * (shipColW + gap) + 8, shipCardY, shipColW - 16, 118, ["REQ-1102", "Hybrid", "SLA: 18:20/19:10", "다음: 검증"], COLORS.primary);
  card(startX + 1 * (shipColW + gap) + 8, shipCardY, shipColW - 16, 118, ["REQ-1103", "Validation Hold", "사유: 주소/역", "다음: 확인"], COLORS.danger, { r: 1, g: 246 / 255, b: 237 / 255 });
  card(startX + 2 * (shipColW + gap) + 8, shipCardY, shipColW - 16, 118, ["REQ-1098", "Planning", "오퍼: 2회 거절", "다음: 재오퍼"], COLORS.primary);
  card(startX + 3 * (shipColW + gap) + 8, shipCardY, shipColW - 16, 118, ["REQ-1081", "Monitoring", "At Risk: +8분", "다음: 재배차"], { r: 2 / 255, g: 106 / 255, b: 162 / 255 }, { r: 240 / 255, g: 249 / 255, b: 255 / 255 });

  // Divider line
  const line = figma.createLine();
  line.x = boardX + 20;
  line.y = shipHeaderY + 180;
  line.resize(boardW - 40, 0);
  line.strokes = strokePaint(COLORS.borderLight);
  line.strokeWeight = 2;
  frame.appendChild(line);

  // Job row
  const jobTitleY = shipHeaderY + 200;
  createText("미션(Job) 보드", { x: boardX + 20, y: jobTitleY, fontSize: 12, bold: true, color: COLORS.text, parent: frame });

  const jobCols = ["미할당", "오퍼중", "수락됨", "픽업 위험", "배송 위험", "실패/반송"];
  const jobColW = 210;
  const jobStartX = boardX + 20;
  const jobHeaderY = jobTitleY + 22;

  jobCols.forEach((c, i) => {
    const x = jobStartX + i * (jobColW + gap);
    const w = i === jobCols.length - 1 ? 220 : jobColW;
    createRect({ x, y: jobHeaderY, w, h: 40, r: 10, fill: COLORS.headerFill, stroke: COLORS.headerStroke, strokeWeight: 1, parent: frame });
    createText(c, { x: x + 12, y: jobHeaderY + 12, fontSize: 12, bold: true, color: { r: 52 / 255, g: 64 / 255, b: 84 / 255 }, parent: frame });
  });

  const jobCardY = jobHeaderY + 52;
  card(jobStartX + 0 * (jobColW + gap) + 8, jobCardY, jobColW - 16, 118, ["JOB-2301", "Leg: 역→역", "후보: 5명", "다음: 오퍼 발행"], COLORS.primary);
  card(jobStartX + 1 * (jobColW + gap) + 8, jobCardY, jobColW - 16, 118, ["JOB-2302", "Offering", "거절 1/타임 1", "다음: 서지+1,000"], COLORS.primary);
  card(jobStartX + 2 * (jobColW + gap) + 8, jobCardY, jobColW - 16, 118, ["JOB-2291", "Accepted", "길러: G-221", "다음: 모니터링"], COLORS.success);
  card(jobStartX + 3 * (jobColW + gap) + 8, jobCardY, jobColW - 16, 118, ["JOB-2284", "Pickup At Risk", "SLA -6분", "다음: 콜/재배차"], { r: 2 / 255, g: 106 / 255, b: 162 / 255 }, { r: 240 / 255, g: 249 / 255, b: 255 / 255 });
  card(jobStartX + 4 * (jobColW + gap) + 8, jobCardY, jobColW - 16, 118, ["JOB-2279", "Delivery At Risk", "ETA drift +9", "다음: 고객 공지"], { r: 2 / 255, g: 106 / 255, b: 162 / 255 }, { r: 240 / 255, g: 249 / 255, b: 255 / 255 });
  card(jobStartX + 5 * (jobColW + gap) + 8, jobCardY, 220 - 16, 118, ["JOB-2268", "Fail/Return", "사유: 인계 실패", "다음: 반송/재배송"], COLORS.danger, { r: 1, g: 241 / 255, b: 243 / 255 });

  createDashedPlaceholder({ x: 1060, y: 150, w: 332, h: 200, label: "SCREENSHOT PLACEHOLDER — 운영 대시보드", parent: frame });
  createDashedPlaceholder({ x: 1060, y: 370, w: 332, h: 200, label: "… 관제/지도", parent: frame });
  createDashedPlaceholder({ x: 1060, y: 590, w: 332, h: 200, label: "… 이슈/정산", parent: frame });
}

function addE2ESwimlane(frame) {
  addBoardTitle(frame, "E2E Swimlane", "고객 → 길러 → 운영, 혼합(문→역→역→문) 포함");

  const x = 32;
  const y = 92;
  const w = 1376;
  const h = 900;
  createRect({ x, y, w, h, r: 12, fill: COLORS.white, stroke: COLORS.borderLight, strokeWeight: 2, parent: frame });

  // 3 lanes
  const laneH = 290;
  const laneLabels = ["고객", "길러(전문길러=라이더/기사)", "운영(오케스트레이션)"];
  laneLabels.forEach((label, idx) => {
    const ty = y + 20 + idx * laneH;
    createText(label, { x: x + 20, y: ty, fontSize: 13, bold: true, color: COLORS.text, parent: frame });
    if (idx > 0) {
      const ln = figma.createLine();
      ln.x = x + 20;
      ln.y = y + idx * laneH;
      ln.resize(w - 40, 0);
      ln.strokes = strokePaint(COLORS.borderLight);
      ln.strokeWeight = 2;
      frame.appendChild(ln);
    }
  });

  // Simple step boxes per lane
  function stepBox(px, py, title, sub, fill, stroke, textColor) {
    createRect({ x: px, y: py, w: 220, h: 56, r: 14, fill, stroke, strokeWeight: 1, parent: frame });
    createText(title, { x: px + 14, y: py + 10, fontSize: 12, bold: true, color: textColor, parent: frame });
    createText(sub, { x: px + 14, y: py + 30, fontSize: 11, bold: false, color: textColor, parent: frame });
  }

  // customer lane
  stepBox(x + 160, y + 52, "1) 요청 생성", "Draft → Requested", { r: 238 / 255, g: 242 / 255, b: 255 / 255 }, { r: 199 / 255, g: 210 / 255, b: 254 / 255 }, COLORS.primary);
  stepBox(x + 400, y + 52, "2) 결제/확정", "PaymentPending → Paid", { r: 238 / 255, g: 242 / 255, b: 255 / 255 }, { r: 199 / 255, g: 210 / 255, b: 254 / 255 }, COLORS.primary);
  stepBox(x + 640, y + 52, "3) 진행 추적", "채팅/상태/ETA", { r: 238 / 255, g: 242 / 255, b: 255 / 255 }, { r: 199 / 255, g: 210 / 255, b: 254 / 255 }, COLORS.primary);
  stepBox(x + 880, y + 52, "4) 완료 확인", "Delivered → Closed", { r: 236 / 255, g: 253 / 255, b: 243 / 255 }, { r: 171 / 255, g: 239 / 255, b: 198 / 255 }, COLORS.success);

  // giller lane
  const gY = y + laneH + 52;
  stepBox(x + 160, gY, "5) 오퍼 수락", "Assigned → Accepted", { r: 240 / 255, g: 249 / 255, b: 255 / 255 }, { r: 185 / 255, g: 230 / 255, b: 254 / 255 }, { r: 2 / 255, g: 106 / 255, b: 162 / 255 });
  stepBox(x + 400, gY, "6) 픽업+증빙", "체크인/사진/QR", { r: 240 / 255, g: 249 / 255, b: 255 / 255 }, { r: 185 / 255, g: 230 / 255, b: 254 / 255 }, { r: 2 / 255, g: 106 / 255, b: 162 / 255 });
  stepBox(x + 640, gY, "7) 이동(혼합)", "문→역→역→문", { r: 240 / 255, g: 249 / 255, b: 255 / 255 }, { r: 185 / 255, g: 230 / 255, b: 254 / 255 }, { r: 2 / 255, g: 106 / 255, b: 162 / 255 });
  stepBox(x + 880, gY, "8) 전달+증빙", "사진/서명/OTP", { r: 240 / 255, g: 249 / 255, b: 255 / 255 }, { r: 185 / 255, g: 230 / 255, b: 254 / 255 }, { r: 2 / 255, g: 106 / 255, b: 162 / 255 });

  // ops lane
  const oY = y + laneH * 2 + 52;
  stepBox(x + 160, oY, "A) 주문 검증", "주소/역/시간창", { r: 255 / 255, g: 246 / 255, b: 237 / 255 }, { r: 254 / 255, g: 200 / 255, b: 75 / 255 }, { r: 181 / 255, g: 71 / 255, b: 8 / 255 });
  stepBox(x + 420, oY, "B) 배차/재배차", "서지/권역확장", { r: 255 / 255, g: 246 / 255, b: 237 / 255 }, { r: 254 / 255, g: 200 / 255, b: 75 / 255 }, { r: 181 / 255, g: 71 / 255, b: 8 / 255 });
  stepBox(x + 680, oY, "C) 관제(At Risk)", "체크인/ETA drift", { r: 255 / 255, g: 246 / 255, b: 237 / 255 }, { r: 254 / 255, g: 200 / 255, b: 75 / 255 }, { r: 181 / 255, g: 71 / 255, b: 8 / 255 });
  stepBox(x + 940, oY, "D) 예외/정산", "반송/클레임/보상", { r: 255 / 255, g: 246 / 255, b: 237 / 255 }, { r: 254 / 255, g: 200 / 255, b: 75 / 255 }, { r: 181 / 255, g: 71 / 255, b: 8 / 255 });

  // Incident callout
  createRect({ x: x + 160, y: y + 186, w: 460, h: 110, r: 14, fill: { r: 1, g: 241 / 255, b: 243 / 255 }, stroke: { r: 254 / 255, g: 205 / 255, b: 214 / 255 }, strokeWeight: 1, parent: frame });
  createText("예외(Incident) 공통 분기", { x: x + 176, y: y + 198, fontSize: 12, bold: true, color: COLORS.danger, parent: frame });
  createText("수취인 부재 / 인계 실패 / 주소 오류 / 파손·분실", { x: x + 176, y: y + 220, fontSize: 11, bold: false, color: COLORS.danger, parent: frame });
  createText("→ 운영 개입(콜/재배차/반송/보상) → 고객 공지", { x: x + 176, y: y + 240, fontSize: 11, bold: false, color: COLORS.danger, parent: frame });

  createDashedPlaceholder({ x: 1060, y: 150, w: 332, h: 200, label: "SCREENSHOT PLACEHOLDER — 고객 화면", parent: frame });
  createDashedPlaceholder({ x: 1060, y: 370, w: 332, h: 200, label: "… 길러 화면", parent: frame });
  createDashedPlaceholder({ x: 1060, y: 590, w: 332, h: 200, label: "… 운영 화면", parent: frame });
}

async function generate() {
  await ensureFonts();

  const page = getOrCreatePage("Mission Board");
  figma.currentPage = page;

  // Place frames vertically with spacing
  const startX = 0;
  const startY = 0;
  const gapY = 120;

  const e2e = createFrame({ name: "01_Overview / E2E Swimlane", x: startX, y: startY, parent: page });
  addE2ESwimlane(e2e);

  const customer = createFrame({ name: "02_Boards / Customer Board", x: startX, y: startY + 1024 + gapY, parent: page });
  addCustomerBoard(customer);

  const giller = createFrame({ name: "02_Boards / Giller Board", x: startX, y: startY + (1024 + gapY) * 2, parent: page });
  addGillerBoard(giller);

  const ops = createFrame({ name: "02_Boards / Ops Board", x: startX, y: startY + (1024 + gapY) * 3, parent: page });
  addOpsBoard(ops);

  figma.viewport.scrollAndZoomIntoView([e2e, customer, giller, ops]);
}

figma.ui.onmessage = async (msg) => {
  if (!msg || !msg.type) return;
  if (msg.type === "generate") {
    try {
      await generate();
      figma.notify("Mission Board 생성 완료");
    } catch (e) {
      figma.notify("생성 실패: " + (e?.message || String(e)));
    }
  }
};

