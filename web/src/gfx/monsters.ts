// 오리지널 몬스터 직원 (32x32, 2등신 치비): 몸 / 눈 / 무늬 / 액세서리 레이어를 코드로 그린다.
// 종족 4가지 × 진화 3단계(인턴=알에서 갓 나옴, 사원·대리=기본, 과장+=강화). 특정 작품 캐릭터를 본뜨지 않은 오리지널 디자인.
//  - ember  (코딩): 볼에 불씨 아가미가 달린 도롱뇽형
//  - octo   (GitHub): 동그란 머리에 짧은 촉수, 진화하면 작은 지느러미 왕관
//  - owl    (기획): 큰 얼굴 테두리와 귀깃, 진화하면 깃털 망토
//  - sprout (연구): 머리에 새싹, 진화하면 꽃이 핌
import { outlineRegion } from "./outline";
import { hash, shade } from "./people";

export const MW = 32, MH = 32, MCOLS = 8;   // 열: 걷기 0~3, 4 앉기, 5 앉아서 작업(팔 동작), 6 서서 눈 깜빡, 7 앉아서 눈 깜빡
export type Species = "ember" | "octo" | "owl" | "sprout";
export type Stage = 0 | 1 | 2;              // 0 인턴, 1 기본, 2 진화
export interface MonsterLook {
  species: Species; stage: Stage; body: string; belly: string; accent: string;
  pattern: "none" | "spots" | "stripes"; acc: "none" | "glasses" | "tie" | "headset" | "beanie";
}

const PAL: Record<Species, [string, string, string][]> = {   // [몸, 배, 포인트]
  ember: [["#f29a7a", "#fde0c8", "#ffb347"], ["#8fd3b8", "#e6f7ea", "#ff8f5a"], ["#b9a6e8", "#efe6ff", "#ffb347"], ["#f2c46b", "#fff1cf", "#ff7a59"]],
  octo: [["#e88fb3", "#ffe0ec", "#7a5af0"], ["#7fb8e8", "#e2f1ff", "#ff9ac0"], ["#9ad08a", "#eaf8e0", "#f2a65a"], ["#c49ae8", "#f3e6ff", "#6fd6c3"]],
  owl: [["#c9a27a", "#f4e3c8", "#e86a5a"], ["#8f9fc9", "#e3e9f8", "#f2c46b"], ["#a8b88a", "#eef3dc", "#d97a9a"], ["#d9b8a0", "#fbeee2", "#5a8ac9"]],
  sprout: [["#9fd98a", "#e9f9dc", "#f28ab0"], ["#7fd1c7", "#e0faf5", "#ffd166"], ["#c2e07a", "#f5fbdc", "#e88aff"], ["#a8c6f0", "#ebf3ff", "#ff9a7a"]],
};
const PATTERNS: MonsterLook["pattern"][] = ["none", "none", "spots", "stripes"];
const ACCS: MonsterLook["acc"][] = ["none", "none", "glasses", "tie", "headset", "beanie"];

export function monsterLook(key: string, species: Species, stage: Stage): MonsterLook {
  const h = hash(key + "#mon"), pal = PAL[species][h % PAL[species].length];
  return { species, stage, body: pal[0], belly: pal[1], accent: pal[2],
    pattern: PATTERNS[(h >> 3) % PATTERNS.length], acc: stage === 0 ? "none" : ACCS[(h >> 6) % ACCS.length] };
}

type Px = (x: number, y: number, c: string) => void;
const INK = "#2a1d1c", WHITE = "#ffffff", BLUSH = "#ff9fb0";

/** 타원 채우기 + 2단계 명암(오른쪽 아래 그림자, 왼쪽 위 하이라이트) */
function blob(px: Px, cx: number, cy: number, rx: number, ry: number, col: string, shadeIt = true) {
  const dk = shade(col, 0.8), hi = shade(col, 1.12);
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, d = nx * nx + ny * ny;
    if (d > 1) continue;
    let c = col;
    if (shadeIt && nx * 0.6 + ny * 0.8 > 0.55) c = dk;
    else if (shadeIt && nx * 0.7 + ny * 0.7 < -0.55 && d > 0.3) c = hi;
    px(x, y, c);
  }
}
function rect(px: Px, x: number, y: number, w: number, h: number, c: string) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c); }

/** 큰 반짝이는 눈 */
function eye(px: Px, x: number, y: number, w: number, h: number, blink: boolean, look = 0) {
  if (blink) { rect(px, x, y + h - 2, w, 1, INK); return; }
  rect(px, x, y, w, h, INK);
  rect(px, x + 1, y + 1, w - 2, h - 2, "#3a2f5a");
  rect(px, x + 1 + look, y + 1, 1, 1, WHITE);                 // 하이라이트 1px
  if (w > 3) px(x + w - 2 + Math.min(0, look), y + h - 2, "#8a7ad0");
}

/** 한 프레임 그리기 (view: front/back/side, f: 걷기 프레임, sit, work=팔 동작) */
function drawFrame(px: Px, L: MonsterLook, view: "front" | "back" | "side", f: number, sit: boolean, work: boolean, blink: boolean) {
  const s = L.stage, big = s === 2 ? 2 : 0;
  const bob = !sit && (f === 1 || f === 3) ? -1 : 0;
  const base = sit ? 2 : 0;                                    // 앉으면 2px 내려앉음
  const Y = (y: number) => y + bob + base;
  // 그림자
  for (let x = 8; x < 24; x++) px(x, 30, "rgba(40,20,10,0.25)");

  // 인턴: 알 껍데기 속 작은 몸
  if (s === 0) {
    const cy = Y(19);
    blob(px, 16, cy, 8, 7, L.body);
    if (view !== "back") {
      const ex = view === "side" ? [19] : [12, 18];
      ex.forEach(x => eye(px, x, cy - 3, 3, 4, blink));
      if (view === "front") { px(11, cy + 2, BLUSH); px(21, cy + 2, BLUSH); }
    }
    speciesTop(px, L, view, 16, cy - 7, 0);
    // 껍데기 (지그재그 윗선)
    for (let x = 8; x <= 24; x++) { const top = Y(23) + ((x % 3) === 0 ? 0 : 1); for (let y = top; y <= Y(29); y++) { const nx = (x - 16) / 8.5, ny = (y - Y(25)) / 5; if (nx * nx + ny * ny <= 1) px(x, y, ny > 0.3 ? "#e6dccb" : "#fbf6ec"); } }
    px(11, Y(26), "#d4c8b0"); px(19, Y(27), "#d4c8b0");
    return;
  }

  const hr = 9 + big / 2, hry = 8 + big / 2;                    // 머리 반지름 (진화하면 커짐)
  const hy = Y(12 + big / 2);                                   // 머리 중심
  const by = Y(22 + big / 4);                                   // 몸 중심
  const sideShift = view === "side" ? 1 : 0;

  // 뒤쪽 부속 (꼬리·망토) — 몸보다 먼저
  if (L.species === "ember") {   // 짧은 꼬리 (옆·뒤에서 보임)
    const tx = view === "side" ? 7 : 22, ty = by + 3;
    if (view !== "front") { blob(px, tx, ty, 4 + big, 2, L.body); px(view === "side" ? tx - 4 - big : tx + 4 + big, ty - 1, L.accent); }
  }
  if (L.species === "owl" && s === 2) blob(px, 16, by + 1, 9, 7, shade(L.accent, 0.9));   // 깃털 망토

  // 다리
  if (!sit) {
    const step = f === 1 ? 1 : f === 3 ? -1 : 0;
    if (L.species === "octo") {
      // 촉수 4개 (진화하면 길고 끝이 말림)
      // 굵은 촉수 4개, 바깥 두 개는 끝이 바깥으로 말림 (진화하면 길어짐)
      const xs = view === "side" ? [12, 18] : [9, 14, 18, 23], len = 4 + big;
      xs.forEach((x, i) => {
        const wig = (i % 2 ? step : -step), c = shade(L.body, 0.9), h = len + wig, out = i === 0 ? -1 : i === xs.length - 1 ? 1 : 0;
        rect(px, x - 1, by + 3, 3, h, c);
        if (out) { px(x + out * 2, by + 2 + h, c); px(x + out * 2, by + 1 + h, c); }
        else rect(px, x, by + 3 + h, 1, 1, c);
        px(x, by + 4, L.belly);   // 빨판
      });
    } else {
      rect(px, 12 - step, by + 4, 3, 4 - Math.max(0, step), shade(L.body, 0.8));
      rect(px, 17 + step, by + 4, 3, 4 - Math.max(0, -step), shade(L.body, 0.8));
    }
  }
  // 몸
  if (L.species === "owl") blob(px, 16 + sideShift, by - 1, 8 + big, 7 + big, L.body);
  else if (L.species !== "octo") blob(px, 16 + sideShift, by, 6 + big, 5 + big, L.body);
  // 배
  if (view === "front" && L.species !== "octo") {
    blob(px, 16, by + 1, 3 + big / 2, 3 + big / 2, L.belly, false);
    if (L.species === "owl") for (const [x, y] of [[15, 0], [17, 0], [14, 2], [18, 2], [16, 2]]) px(x, by + y, shade(L.belly, 0.85));
  }
  // 팔 (작업 중이면 앞으로/위로)
  const armY = by - 1 + (work ? -2 : 0);
  if (L.species === "owl") { blob(px, 7 + (work ? 1 : 0), armY + 1, 2, 4, shade(L.body, 0.85)); if (view !== "side") blob(px, 25 - (work ? 1 : 0), armY + 1, 2, 4, shade(L.body, 0.85)); }
  else if (L.species !== "octo") { blob(px, 9 + (work ? 1 : 0), armY, 2, 2, L.body); if (view !== "side") blob(px, 23 - (work ? 1 : 0), armY, 2, 2, L.body); else blob(px, 21 + (work ? 2 : 0), armY, 2, 2, L.body); }

  // 머리
  if (L.species === "octo") blob(px, 16 + sideShift, hy + 2, hr + 1, hry + 2, L.body);
  else if (L.species === "owl") blob(px, 16 + sideShift, hy + 1, hr + 1, hry, L.body);
  else blob(px, 16 + sideShift, hy, hr, hry, L.body);

  // 무늬
  if (L.pattern === "spots") for (const [x, y] of [[10, 8], [22, 9], [19, 5], [12, 16]]) { const xx = view === "back" ? 32 - x : x; px(xx + sideShift, y + bob + base, shade(L.body, 0.82)); px(xx + 1 + sideShift, y + bob + base, shade(L.body, 0.82)); }
  if (L.pattern === "stripes") for (const y of [5, 7]) for (let x = 12; x <= 20; x++) px(x + sideShift, Y(y), shade(L.body, 0.86));

  // 종족 특징
  speciesFace(px, L, view, hy, big, sideShift);
  speciesTop(px, L, view, 16 + sideShift, hy - hry, big);

  // 얼굴
  if (view !== "back") {
    const ew = L.species === "owl" ? 5 : 4, eh = L.species === "owl" ? 6 : 5;
    if (L.species === "owl") {   // 얼굴 테두리
      blob(px, 12 + (view === "side" ? 8 : 0), hy + 1, 4, 4, L.belly, false); if (view === "front") blob(px, 20, hy + 1, 4, 4, L.belly, false);
    }
    if (view === "front") { eye(px, 10, hy - 2, ew, eh, blink); eye(px, 18 + (L.species === "owl" ? 0 : 0), hy - 2, ew, eh, blink); }
    else eye(px, 20, hy - 2, ew - 1, eh, blink, 0);
    // 볼터치
    if (view === "front") { px(9, hy + 4, BLUSH); px(10, hy + 4, BLUSH); px(22, hy + 4, BLUSH); px(23, hy + 4, BLUSH); }
    else { px(22, hy + 4, BLUSH); px(23, hy + 4, BLUSH); }
    // 입 / 부리
    if (L.species === "owl") { const bx = view === "side" ? 25 : 15; px(bx, hy + 3, "#f2a65a"); px(bx + 1, hy + 3, "#f2a65a"); px(bx, hy + 4, "#d9843a"); }
    else { const mx = view === "side" ? 23 : 15; px(mx, hy + 4, INK); px(mx + 1, hy + 5, INK); px(mx + 2, hy + 4, INK); }
  }
  // 액세서리
  if (L.acc === "glasses" && view !== "back") {
    if (view === "front") { for (const x of [9, 17]) { rect(px, x, hy - 3, 6, 1, INK); rect(px, x, hy + 3, 6, 1, INK); rect(px, x, hy - 3, 1, 7, INK); rect(px, x + 5, hy - 3, 1, 7, INK); } rect(px, 15, hy - 1, 2, 1, INK); }
    else { rect(px, 19, hy - 3, 6, 1, INK); rect(px, 19, hy + 3, 6, 1, INK); rect(px, 24, hy - 3, 1, 7, INK); }
  }
  if (L.acc === "tie" && view === "front" && L.species !== "octo") { rect(px, 15, by - 4, 2, 1, "#c0504d"); rect(px, 15, by - 3, 2, 4, "#c0504d"); px(15, by + 1, "#a03a38"); }
  if (L.acc === "headset") { const x0 = view === "side" ? 9 : 6, x1 = 25; rect(px, x0, hy - 1, 2, 4, INK); if (view !== "side") rect(px, x1, hy - 1, 2, 4, INK); for (let x = 8; x <= 24; x++) { const t = (x - 16) / 8.5; px(x, Math.round(hy - hry - 1 + t * t * 6), INK); } }
  if (L.acc === "beanie") { blob(px, 16 + sideShift, hy - hry + 1, hr - 1, 3, "#5a8ac9", false); rect(px, 8 + sideShift, hy - hry + 3, 17, 2, "#3d6fb0"); px(16 + sideShift, hy - hry - 3, "#f2f2f2"); px(15 + sideShift, hy - hry - 3, "#f2f2f2"); }
}

/** 종족별 얼굴 옆 특징 */
function speciesFace(px: Px, L: MonsterLook, view: string, hy: number, big: number, sx: number) {
  if (L.species === "ember") {   // 볼 옆 불씨 아가미 (진화하면 크고 빛남)
    const n = 3, col = L.accent, glow = shade(L.accent, 1.15);
    for (let i = 0; i < n; i++) {
      const y = hy - 3 + i * 3, len = 3 + big / 2 + (i === 1 ? 1 : 0);
      if (view !== "side" || true) { rect(px, 7 - len + 1 + sx * 0, y, len, 2, col); if (big) px(7 - len + sx * 0, y, glow); }
      if (view !== "side") { rect(px, 25, y, len, 2, col); if (big) px(25 + len, y, glow); }
    }
  }
  if (L.species === "octo" && view !== "back") {   // 머리 점박이 (진화하면 더 많이)
    const pts = big ? [[10, -5], [22, -5], [16, -7], [8, 1], [24, 1]] : [[10, -5], [22, -5]];
    for (const [dx, dy] of pts) { px(dx + sx, hy + dy, L.accent); px(dx + 1 + sx, hy + dy, L.accent); }
  }
}
/** 머리 위 특징 */
function speciesTop(px: Px, L: MonsterLook, view: string, cx: number, top: number, big: number) {
  if (L.species === "sprout") {
    rect(px, cx, top - 3, 1, 4, "#4f8a3a");
    if (L.stage === 2) {   // 꽃
      // 꽃잎 5장 + 노란 꽃술 + 잎 두 장
      const fy = Math.max(4, top - 3), pet = shade(L.accent, 1.05);
      for (const [dx, dy] of [[0, -3], [-3, -1], [3, -1], [-2, 2], [2, 2]]) { rect(px, cx + dx - 1, fy + dy - 1, 2, 2, pet); px(cx + dx, fy + dy, shade(L.accent, 0.85)); }
      rect(px, cx - 1, fy - 1, 3, 3, "#ffd166"); px(cx, fy, "#f2a65a");
      blob(px, cx - 4, top, 2.2, 1.2, "#6fbf4a"); blob(px, cx + 4, top - 1, 2.2, 1.2, "#86d05a");
    } else { blob(px, cx - 2, top - 3, 2.5, 1.5, "#6fbf4a"); blob(px, cx + 3, top - 4, 2.5, 1.5, "#86d05a"); }
  }
  if (L.species === "owl") {   // 귀깃: 바깥쪽으로 뾰족한 깃털 (진화하면 길어짐)
    const h = 3 + big, c = shade(L.body, 0.78);
    for (let i = 0; i <= h; i++) {
      const w = Math.max(1, Math.round((i / h) * 3)), y = top - h + 2 + i;
      for (let k = 0; k < w; k++) { px(cx - 9 + i + k - (h - 3), y, c); px(cx + 9 - i - k + (h - 3), y, c); }
    }
  }
  if (L.species === "octo" && L.stage === 2) {   // 작은 지느러미 왕관
    for (const dx of [-4, 0, 4]) { rect(px, cx + dx, top - 1, 2, 2, L.accent); px(cx + dx, top - 2, L.accent); }
  }
  if (L.species === "ember" && view !== "front") { px(cx - 1, top + 1, L.accent); px(cx + 1, top + 2, L.accent); }
}

/** 한 직원의 스프라이트 시트 (MCOLS x 3 프레임, 행 = 아래/위/오른쪽 보기) */
export function makeMonsterSheet(L: MonsterLook): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = MW * MCOLS; c.height = MH * 3;
  const ctx = c.getContext("2d")!;
  for (let row = 0; row < 3; row++) for (let col = 0; col < MCOLS; col++) {
    const ox = col * MW, oy = row * MH;
    const px: Px = (x, y, color) => { if (x < 0 || y < 0 || x >= MW || y >= MH) return; ctx.fillStyle = color; ctx.fillRect(ox + x, oy + y, 1, 1); };
    const view = row === 0 ? "front" : row === 1 ? "back" : "side";
    drawFrame(px, L, view, col <= 3 ? col : 0, col === 4 || col === 5 || col === 7, col === 5, col >= 6);
    outlineRegion(ctx, ox, oy, MW, MH);
  }
  return c;
}

/** 확인용 미리보기 시트: 종족 4 × 진화 3 (정면/옆/뒤) + 같은 종족 개성 4가지 */
export function makePreviewSheet(): HTMLCanvasElement {
  const SC = 3, cell = MW * SC, pad = 10;
  const species: Species[] = ["ember", "octo", "owl", "sprout"], names = ["코딩 · 불씨 도롱뇽", "GitHub · 꼬마 문어", "기획 · 귀깃 부엉이", "연구 · 새싹 정령"];
  const W = pad + (3 * 3 + 4) * (cell / 2 + 4) + 140, H = 40 + species.length * (cell + 34);
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d")!; ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#f6ead2"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#2a1d1c"; ctx.font = "bold 16px Galmuri11, sans-serif";
  ctx.fillText("Claude Office 몬스터 직원 미리보기 — 진화 3단계 (인턴 / 사원·대리 / 과장 이상) · 오른쪽: 같은 종족 개성", pad, 24);
  species.forEach((sp, r) => {
    const y = 40 + r * (cell + 34);
    ctx.fillStyle = "#6e5440"; ctx.font = "bold 13px Galmuri11, sans-serif"; ctx.fillText(names[r], pad, y + 12);
    let x = pad;
    ([0, 1, 2] as Stage[]).forEach(stage => {
      const sheet = makeMonsterSheet({ ...monsterLook("preview-" + sp, sp, stage), acc: "none", pattern: "none" });
      for (const row of [0, 2, 1]) {   // 정면, 옆, 뒤
        ctx.fillStyle = stage === 2 ? "#efe2c6" : "#ede3cf"; ctx.fillRect(x, y + 18, cell / 2 * 1.0 + 0, cell);
        ctx.drawImage(sheet, 0, row * MH, MW, MH, x - cell / 4, y + 18, cell, cell);
        x += cell / 2 + 4;
      }
      ctx.fillStyle = "#8a7a6e"; ctx.font = "11px Galmuri11, sans-serif"; ctx.fillText(["인턴", "사원·대리", "과장+"][stage], x - (cell / 2 + 4) * 2 - 10, y + 18 + cell + 12);
      x += 6;
    });
    // 개성 4가지 (기본 형태 정면)
    for (let k = 0; k < 4; k++) {
      const sheet = makeMonsterSheet(monsterLook(`var-${sp}-${k * 7 + 3}`, sp, 1));
      ctx.drawImage(sheet, 0, 0, MW, MH, x + k * (cell / 2 + 6) - cell / 4, y + 18, cell, cell);
    }
  });
  return c;
}
