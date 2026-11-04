import { outlineRegion } from "./outline";
// 직원 캐릭터: body / outfit / hair / accessory 레이어를 합쳐 4방향 스프라이트 시트를 만든다.
// 프레임 16x24. 행 = 방향(down, up, right) — left 는 right 를 flipX. 열 = 걷기 0..3, 4 = 앉기
export const FW = 16, FH = 24, COLS = 5;
export type Dir = "down" | "up" | "right" | "left";
export const DIR_ROW: Record<Exclude<Dir, "left">, number> = { down: 0, up: 1, right: 2 };

const SKIN = ["#f6d3b3", "#eebb94", "#d9a07a", "#b97c56", "#8d5a3b", "#f3c9a0"];
const HAIR_C = ["#2b1d16", "#4a2f1f", "#7a4a26", "#c58a3e", "#e7c56a", "#a33b2b", "#d9d4cf", "#3b3f6b", "#e07aa0"];
const HAIR_S = ["short", "long", "bob", "spiky", "bun", "ponytail", "curly", "buzz"] as const;
const ACC = [null, null, "glasses", "glasses", "earring", "freckles", "beard", "flower", "cap"] as const;
const HOODIE = ["#4f81bd", "#6c5ba8", "#3f8f6b", "#c0504d", "#4a4a5a", "#d08a3a"];
const SHIRT = ["#e6e0d0", "#c9d6e6", "#e6d0c9", "#d6e6c9"];
export type Team = "dev" | "gh" | "hq" | "lab";
const TEAM: Record<Team, { lanyard: string; pants: string }> = {
  dev: { lanyard: "#e8875a", pants: "#2f3a5a" },   // 개발팀(Claude Code): 후드티 + 헤드셋
  gh: { lanyard: "#6fd6c3", pants: "#3a3a48" },    // GitHub팀: 작업복 + 공구 벨트
  hq: { lanyard: "#ffd166", pants: "#2a2d40" },    // 본부장: 정장
  lab: { lanyard: "#7fd1c7", pants: "#3a4152" },   // 연구실: 흰 가운 + 안경
};
export interface Look {
  team: Team; skin: string; hair: string; style: typeof HAIR_S[number]; acc: typeof ACC[number];
  shirt: string; main: string; sleeve: string; lanyard: string; pants: string;
}

export function hash(s: string) { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); }
export function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16), m = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return "#" + ((m(n >> 16) << 16) | (m((n >> 8) & 255) << 8) | m(n & 255)).toString(16).padStart(6, "0");
}

/** 같은 key(프로젝트 경로, 저장소 이름)는 언제나 같은 외형 */
export function lookFor(key: string, team: Team, color?: string | null): Look {
  const h1 = hash(key), h2 = hash(key + "#hair"), h3 = hash(key + "#acc"), h4 = hash(key + "#wear");
  const shirt = SHIRT[h4 % SHIRT.length];
  const main = team === "dev" ? HOODIE[(h4 >> 3) % HOODIE.length] : team === "gh" ? (color || "#7a7488") : team === "lab" ? "#eef1f5" : "#2f3550";
  const acc = team === "lab" ? "glasses" : ACC[h3 % ACC.length];
  return { team, ...TEAM[team], skin: SKIN[h1 % SKIN.length], hair: HAIR_C[h2 % HAIR_C.length], style: HAIR_S[(h2 >> 4) % HAIR_S.length],
    acc, shirt, main, sleeve: team === "gh" ? shirt : main };
}

type P = (x: number, y: number, w: number, h: number, c: string) => void;
const EYE = "#2b1a12", WHITE = "#f3ecdf", SHOE = "#2a2230", DARK = "#2b2540";

// ── 레이어 ①: 다리 ──
function legs(p: P, L: Look, view: "front" | "side", f: number, sit: boolean) {
  if (sit) { p(5, 17, 6, 3, L.pants); return; }
  if (view === "front") {
    const a = f === 1 ? -1 : 0, b = f === 3 ? -1 : 0;
    p(5, 17, 2, 5 + a, L.pants); p(9, 17, 2, 5 + b, L.pants); p(5, 22 + a, 2, 1, SHOE); p(9, 22 + b, 2, 1, SHOE);
  } else {
    const s = f === 1 ? 2 : f === 3 ? -2 : 0;
    p(7 - s / 2, 17, 2, 5, L.pants); p(7 + s / 2, 17, 2, 5, shade(L.pants, 0.85));
    p(7 - s / 2, 22, 3, 1, SHOE); p(7 + s / 2, 22, 3, 1, SHOE);
  }
}
// ── 레이어 ②: 옷(부서 유니폼) + 팔 + 사원증 ──
function outfit(p: P, L: Look, view: "front" | "back" | "side", f: number) {
  const dk = shade(L.main, 0.72), swing = f === 1 ? 1 : f === 3 ? -1 : 0;
  if (view === "side") {
    if (L.team === "gh") { p(5, 10, 6, 7, L.shirt); p(6, 12, 5, 5, L.main); p(5, 16, 6, 1, "#6a4528"); p(10, 16, 1, 2, "#9aa0aa"); }
    else if (L.team === "hq") { p(5, 10, 6, 7, L.main); p(9, 10, 2, 3, WHITE); }
    else if (L.team === "lab") { p(5, 10, 6, 8, L.main); p(9, 10, 2, 4, "#5a7fb0"); p(5, 17, 6, 1, "#c9ced8"); }
    else { p(5, 10, 6, 7, L.main); p(4, 9, 3, 3, dk); }
    p(7 + swing, 11, 2, 5, L.sleeve); p(7 + swing, 16, 2, 1, L.skin);
    if (L.team !== "hq") p(9, 11, 1, 2, L.lanyard);
    return;
  }
  // 앞/뒤 공통 몸통
  if (L.team === "gh") {
    p(4, 10, 8, 7, L.shirt);
    if (view === "front") { p(5, 12, 6, 5, L.main); p(5, 10, 1, 2, L.main); p(10, 10, 1, 2, L.main); }
    else { p(4, 13, 8, 4, L.main); p(5, 10, 1, 3, L.main); p(10, 10, 1, 3, L.main); }
    p(4, 16, 8, 1, "#6a4528"); p(11, 16, 1, 2, "#9aa0aa"); p(5, 16, 1, 2, "#c9a24a");
  } else if (L.team === "lab") {
    p(4, 10, 8, 8, L.main); p(4, 17, 8, 1, "#c9ced8");
    if (view === "front") { p(7, 10, 2, 7, "#5a7fb0"); p(7, 10, 2, 1, WHITE); p(10, 13, 1, 2, "#3d6fb0"); p(9, 13, 2, 1, "#c9ced8"); }
  } else if (L.team === "hq") {
    p(4, 10, 8, 7, L.main);
    if (view === "front") { p(7, 10, 2, 3, WHITE); p(7, 11, 2, 4, "#c0504d"); p(7, 10, 2, 1, WHITE); }
  } else {
    p(4, 10, 8, 7, L.main);
    if (view === "front") { p(5, 14, 6, 1, dk); p(7, 10, 1, 2, WHITE); p(8, 10, 1, 2, WHITE); }
    else p(5, 9, 6, 3, dk);   // 뒤에서 보이는 후드
  }
  p(3, 11 + swing, 1, 5, L.sleeve); p(3, 16 + swing, 1, 1, L.skin);
  p(12, 11 - swing, 1, 5, L.sleeve); p(12, 16 - swing, 1, 1, L.skin);
  // 사원증 목걸이 (부서 색)
  if (view === "front" && L.team !== "hq") { p(5, 10, 1, 1, L.lanyard); p(6, 11, 1, 1, L.lanyard); p(10, 10, 1, 1, L.lanyard); p(9, 11, 1, 1, L.lanyard); p(7, 12, 2, 2, WHITE); p(7, 12, 2, 1, L.lanyard); }
  if (view === "front" && L.team === "hq") p(10, 12, 1, 1, L.lanyard);
  if (view === "back" && L.team !== "hq") { p(5, 10, 1, 1, L.lanyard); p(10, 10, 1, 1, L.lanyard); }
}
// ── 레이어 ③: 얼굴 + 머리카락 ──
function head(p: P, L: Look, view: "front" | "back" | "side", blink = false) {
  const c = L.hair;
  if (view === "front") {
    p(4, 2, 8, 8, L.skin); p(3, 5, 1, 2, L.skin); p(12, 5, 1, 2, L.skin);
    if (L.acc === "cap") { p(4, 1, 8, 3, "#c0504d"); p(3, 4, 10, 1, "#a03a38"); }
    else switch (L.style) {
      case "short": p(4, 1, 8, 3, c); p(3, 2, 1, 3, c); p(12, 2, 1, 3, c); break;
      case "long": p(4, 1, 8, 3, c); p(3, 2, 1, 9, c); p(12, 2, 1, 9, c); break;
      case "bob": p(3, 1, 10, 3, c); p(3, 4, 2, 4, c); p(11, 4, 2, 4, c); break;
      case "spiky": p(4, 1, 8, 3, c); p(4, 0, 1, 1, c); p(7, 0, 1, 1, c); p(10, 0, 1, 1, c); break;
      case "bun": p(4, 1, 8, 3, c); p(6, 0, 4, 1, c); break;
      case "ponytail": p(4, 1, 8, 3, c); p(3, 2, 1, 3, c); p(12, 3, 1, 5, c); break;
      case "curly": p(3, 1, 10, 3, c); p(3, 4, 1, 3, c); p(12, 4, 1, 3, c); p(5, 4, 1, 1, c); break;
      case "buzz": p(4, 2, 8, 1, c); break;
    }
    if (blink) { p(6, 7, 1, 1, EYE); p(9, 7, 1, 1, EYE); } else { p(6, 6, 1, 2, EYE); p(9, 6, 1, 2, EYE); }
    p(7, 8, 2, 1, shade(L.skin, 0.75));
    if (L.acc === "glasses") { p(5, 5, 3, 1, DARK); p(8, 5, 3, 1, DARK); p(5, 6, 1, 1, DARK); p(10, 6, 1, 1, DARK); }
    if (L.acc === "earring") p(3, 7, 1, 1, "#ffd166");
    if (L.acc === "freckles") { p(5, 8, 1, 1, shade(L.skin, 0.8)); p(10, 8, 1, 1, shade(L.skin, 0.8)); }
    if (L.acc === "beard") { p(5, 8, 6, 2, c); p(4, 7, 1, 2, c); p(11, 7, 1, 2, c); }
    if (L.acc === "flower") p(10, 1, 2, 2, "#f0a6a0");
    if (L.team === "dev") { p(2, 5, 2, 3, DARK); p(12, 5, 2, 3, DARK); p(3, 2, 1, 3, DARK); p(12, 2, 1, 3, DARK); p(10, 8, 2, 1, DARK); }
  } else if (view === "back") {
    p(4, 2, 8, 8, L.skin); p(3, 5, 1, 2, L.skin); p(12, 5, 1, 2, L.skin);
    if (L.acc === "cap") { p(4, 1, 8, 4, "#c0504d"); p(4, 5, 8, 3, c); }
    else {
      const len = L.style === "long" ? 9 : L.style === "bob" ? 6 : L.style === "buzz" ? 4 : 6;
      p(4, 1, 8, len, c); if (L.style === "curly" || L.style === "bob") { p(3, 2, 10, 4, c); }
      if (L.style === "ponytail") p(7, 7, 2, 5, c);
      if (L.style === "bun") p(6, 0, 4, 2, c);
      if (L.style === "spiky") { p(4, 0, 1, 1, c); p(7, 0, 1, 1, c); p(10, 0, 1, 1, c); }
    }
    if (L.acc === "flower") p(4, 1, 2, 2, "#f0a6a0");
    if (L.team === "dev") { p(2, 5, 2, 3, DARK); p(12, 5, 2, 3, DARK); p(4, 1, 8, 1, DARK); }
  } else {
    p(4, 2, 8, 8, L.skin); p(12, 6, 1, 1, L.skin);
    if (L.acc === "cap") { p(4, 1, 8, 3, "#c0504d"); p(11, 3, 3, 1, "#a03a38"); p(4, 4, 2, 3, c); }
    else switch (L.style) {
      case "long": p(4, 1, 8, 3, c); p(4, 3, 3, 8, c); break;
      case "bob": p(3, 1, 9, 3, c); p(3, 3, 4, 5, c); break;
      case "ponytail": p(4, 1, 8, 3, c); p(4, 3, 3, 2, c); p(2, 4, 2, 5, c); break;
      case "bun": p(4, 1, 8, 3, c); p(3, 0, 3, 2, c); p(4, 3, 2, 2, c); break;
      case "spiky": p(4, 1, 8, 3, c); p(5, 0, 1, 1, c); p(8, 0, 1, 1, c); p(4, 3, 2, 2, c); break;
      case "curly": p(3, 0, 9, 4, c); p(3, 4, 3, 3, c); break;
      case "buzz": p(4, 2, 8, 1, c); p(4, 3, 2, 1, c); break;
      default: p(4, 1, 8, 3, c); p(4, 3, 3, 3, c);
    }
    if (blink) p(10, 7, 1, 1, EYE); else p(10, 6, 1, 2, EYE);
    p(10, 8, 2, 1, shade(L.skin, 0.75));
    if (L.acc === "glasses") { p(9, 5, 3, 1, DARK); p(9, 6, 1, 1, DARK); }
    if (L.acc === "earring") p(6, 7, 1, 1, "#ffd166");
    if (L.acc === "beard") { p(8, 8, 4, 2, c); p(7, 7, 1, 2, c); }
    if (L.acc === "flower") p(5, 1, 2, 2, "#f0a6a0");
    if (L.team === "dev") { p(6, 5, 2, 3, DARK); p(6, 1, 1, 4, DARK); p(8, 8, 3, 1, DARK); }
  }
}

function drawFrame(p: P, L: Look, dirRow: number, f: number, sit: boolean) {
  const view = dirRow === 0 ? "front" : dirRow === 1 ? "back" : "side";
  p(4, 22, 8, 2, "rgba(0,0,0,0.25)");   // 그림자
  legs(p, L, view === "back" ? "front" : view, f, sit);
  if (view === "back") { outfit(p, L, "back", f); head(p, L, "back"); }
  else { outfit(p, L, view, f); head(p, L, view); }
}

/** 한 직원의 스프라이트 시트 (COLS x 3 프레임) */
export function makeSheet(L: Look): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = FW * COLS; c.height = FH * 3;
  const ctx = c.getContext("2d")!;
  for (let row = 0; row < 3; row++) for (let col = 0; col < COLS; col++) {
    const ox = col * FW, oy = row * FH, sit = col === 4;
    const dy = sit ? 2 : (col === 1 || col === 3 ? -1 : 0) * 0;   // 앉으면 2px 내려앉음
    const p: P = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(ox + x, oy + y + dy, w, h); };
    drawFrame(p, L, row, sit ? 0 : col, sit);
    outlineRegion(ctx, ox, oy, FW, FH);   // 캐릭터 외곽선
  }
  return c;
}
