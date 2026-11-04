// 코드로 그리는 타일셋 (16px) — "저녁의 대기업 사옥" 팔레트 하나로 통일
// 슬레이트·그레이 바탕 + 흰 사무가구 + 팀별 포인트 색. 가구 아래엔 1px 그림자.
import { G, TILE, TILE_COUNT } from "../map/defaultMap";
import { outlineRegion } from "./outline";

type R = (x: number, y: number, w: number, h: number, c: string) => void;

// ── 팔레트 ──
export const P = {
  ink: "#2a1d1c", cap: "#2b2220", capHi: "#3d302b",
  wall: "#e2d3b5", wallHi: "#efe2c6", wainscot: "#8a5e3e", base: "#5a3c28",
  floor: "#9b6b43", floorSeam: "#85593a", floorHi: "#a8774d",
  white: "#c89463", whiteSide: "#9c6a42", whiteLine: "#b3804f",       // 원목 책상 상판·옆면
  steel: "#b7b2a8", steelDk: "#7d766c", black: "#2f2a2e", blackHi: "#443d42",
  walnut: "#6e4a32", walnutHi: "#835a3e", oak: "#7a5236", oakSeam: "#664430",
  screen: "#3d6fa8", screenHi: "#7fb6ff", led: "#7ee08a", ledB: "#7fb6ff", warm: "#ffd98a",
  leaf: "#5e9a4a", leafHi: "#86c060", leafDk: "#3f7037",
  navy: "#4d6a8a", navyHi: "#5d7da0",
  shadow: "rgba(40,20,10,0.28)",
};

function carpet(r: R, base: string, dot: string) {
  r(0, 0, 16, 16, base);
  for (const [x, y] of [[2, 2], [10, 3], [6, 7], [14, 9], [3, 12], [11, 14]]) r(x, y, 1, 1, dot);
}
function planks(r: R, base: string, seam: string, hi: string) {
  r(0, 0, 16, 16, base);
  for (let y = 0; y < 16; y += 4) { r(0, y + 3, 16, 1, seam); r(0, y, 16, 1, hi); r((y * 5 + 3) % 16, y, 1, 3, seam); }
}
const shadow = (r: R, x: number, y: number, w: number) => r(x, y, w, 1, P.shadow);
const books = ["#4d6a8a", "#b5503f", "#5e9a4a", "#d6a748", "#8a6a86", "#c0683f", "#3f6a6e"];
function bookRow(r: R, y: number, h: number, seed: number) {
  for (let b = 0; b < 7; b++) { const hh = h - ((b + seed) % 3 === 0 ? 1 : 0); r(1 + b * 2, y + (h - hh), 2, hh, books[(b + seed) % books.length]); }
}

const DRAW: Record<number, (r: R) => void> = {
  // ── 바닥 ──
  [G.OFFICE]: (r) => planks(r, P.floor, P.floorSeam, P.floorHi),                      // 오픈 오피스: 따뜻한 원목
  [G.CARPET]: (r) => carpet(r, "#4d6a8a", "#57759a"),          // 개발팀 섬: 더스티 블루
  [G.TEAL]: (r) => carpet(r, "#5f7f5a", "#688a62"),            // GitHub 섬: 세이지
  [G.LOBBY]: (r) => carpet(r, "#8a6a86", "#94748f"),           // 기획팀 섬: 모브
  [G.GREEN]: (r) => carpet(r, "#9a8a4e", "#a59456"),           // 연구팀 섬: 머스터드
  [G.PURPLE]: (r) => carpet(r, "#6b6f86", "#757990"),          // 회의실
  [G.NAP]: (r) => carpet(r, "#3b3f63", "#43476d"),             // 수면실: 인디고
  [G.WOOD]: (r) => planks(r, P.oak, P.oakSeam, "#94744f"),       // 자료실·캐비닛실: 오크
  [G.BEIGE]: (r) => {                                            // 대표실·로비: 크림 타일
    r(0, 0, 16, 16, "#d8c9ad"); r(0, 15, 16, 1, "#c4b496"); r(15, 0, 1, 16, "#c4b496"); r(0, 0, 16, 1, "#e4d7bd"); r(5, 6, 2, 1, "#cfbfa2"); r(10, 11, 2, 1, "#cfbfa2");
  },
  [G.CAFE]: (r) => {                                             // 탕비실: 테라코타·크림 체크
    const a = "#c9906a", b = "#e6d3b3"; r(0, 0, 8, 8, a); r(8, 0, 8, 8, b); r(0, 8, 8, 8, b); r(8, 8, 8, 8, a);
    r(0, 0, 16, 1, "rgba(255,255,255,0.12)");
  },
  [G.GRID]: (r) => {                                             // 서버실: 액세스 플로어
    r(0, 0, 16, 16, "#3a3a44"); r(0, 0, 16, 1, "#47474f"); r(0, 0, 1, 16, "#47474f"); r(15, 0, 1, 16, "#2f2f37"); r(0, 15, 16, 1, "#2f2f37");
    for (let y = 4; y < 14; y += 3) for (let x = 4; x < 14; x += 3) r(x, y, 1, 1, "#303038");
  },
  [G.MAT]: (r) => { r(0, 0, 16, 16, "#7a3b34"); r(1, 1, 14, 14, "#8f4a40"); r(2, 2, 12, 1, "#a35a4e"); r(1, 14, 14, 1, "#6a3029"); },
  [G.CAP]: (r) => { r(0, 0, 16, 16, P.cap); r(0, 0, 16, 1, P.capHi); },
  [G.FACE]: (r) => { r(0, 0, 16, 16, P.wall); r(0, 0, 16, 1, P.wallHi); for (let x = 1; x < 16; x += 4) r(x, 1, 1, 8, "#d8c8a8"); r(0, 9, 16, 6, P.wainscot); r(0, 9, 16, 1, "#a87450"); r(4, 10, 1, 5, "#7a5236"); r(12, 10, 1, 5, "#7a5236"); r(0, 15, 16, 1, P.base); },
  [G.WINDOW]: (r) => {                                           // 통유리 창 + 도시 야경
    r(0, 0, 16, 16, P.wall); r(0, 15, 16, 1, P.base);
    r(1, 1, 14, 13, "#2b2f3a"); r(2, 2, 12, 11, "#1b2342"); r(2, 8, 12, 5, "#222c52");
    r(3, 7, 3, 6, "#121729"); r(7, 5, 3, 8, "#151b30"); r(11, 8, 3, 5, "#121729");
    for (const [x, y, c] of [[4, 8, P.warm], [8, 6, P.warm], [8, 9, "#9fd3ff"], [12, 9, P.warm], [4, 11, "#9fd3ff"]] as const) r(x, y, 1, 1, c);
    r(5, 3, 1, 1, "#ffffff"); r(8, 1, 1, 13, "#2b2f3a"); r(1, 14, 14, 1, "#9aa0ad");
  },
  [G.GLASS]: (r) => {                                            // 유리 파티션
    r(0, 0, 16, 16, "rgba(160,205,240,0.16)"); r(0, 0, 16, 1, "#9aa7b8"); r(0, 15, 16, 1, "#7d8798");
    r(3, 3, 1, 7, "rgba(255,255,255,0.30)"); r(5, 3, 1, 3, "rgba(255,255,255,0.22)"); r(0, 0, 1, 16, "rgba(154,167,184,0.6)");
  },
  [G.WHITEBOARD]: (r) => {
    DRAW[G.FACE](r);
    r(1, 2, 14, 9, "#b8bec9"); r(2, 3, 12, 7, "#f4f6f9"); r(3, 4, 6, 1, "#3d6fb0"); r(3, 6, 8, 1, "#c0504d"); r(10, 7, 2, 2, "#5aa06e"); r(2, 11, 12, 1, "#9aa0ad");
  },
  [G.CLOCK]: (r) => { DRAW[G.FACE](r); r(5, 2, 6, 6, "#2b2f3a"); r(6, 3, 4, 4, "#f4f6f9"); r(8, 4, 1, 2, "#2b2f3a"); r(8, 5, 1, 1, "#c0504d"); },
  [G.BOSSDOOR]: (r) => { DRAW[G.FACE](r); r(3, 0, 10, 16, "#3a2a20"); r(4, 1, 8, 15, P.walnut); r(4, 1, 8, 1, P.walnutHi); r(10, 8, 1, 2, "#c9a24a"); r(5, 3, 6, 2, "#c9a24a"); },

  // ── 책상 · 의자 ──
  [G.DESK]: (r) => {          // 위쪽 줄 책상: 앉은 사람이 위(북쪽)에 있어 모니터 뒷면이 보임
    r(0, 2, 16, 11, P.white); r(0, 2, 16, 1, "#f7f8fa"); r(0, 13, 16, 2, P.whiteSide); shadow(r, 0, 15, 16); r(15, 2, 1, 11, P.whiteLine);
    r(4, 3, 8, 1, "#c9ccd3");                                     // 키보드 (앉은 사람 쪽)
    r(3, 6, 10, 5, P.black); r(4, 6, 8, 1, P.blackHi); r(7, 11, 2, 1, P.steelDk); r(7, 8, 2, 1, "#4a4f5c");   // 모니터 뒷면
  },
  [G.DESK_UP]: (r) => {       // 아래쪽 줄 책상: 앉은 사람이 아래에 있어 화면이 보임
    r(0, 0, 16, 11, P.white); r(0, 0, 16, 1, "#f7f8fa"); r(0, 11, 16, 2, P.whiteSide); shadow(r, 0, 13, 16); r(15, 0, 1, 11, P.whiteLine);
    r(3, 0, 10, 7, P.black); r(4, 1, 8, 5, P.screen); r(4, 1, 8, 1, P.screenHi); r(5, 3, 4, 1, "#9fd3ff"); r(5, 4, 5, 1, "#7ee0a0");
    r(7, 7, 2, 1, P.steelDk); r(4, 9, 8, 1, "#c9ccd3");
  },
  [G.LAPTOP_DESK]: (r) => {
    r(0, 2, 16, 11, P.white); r(0, 2, 16, 1, "#f7f8fa"); r(0, 13, 16, 2, P.whiteSide); shadow(r, 0, 15, 16); r(15, 2, 1, 11, P.whiteLine);
    r(4, 3, 8, 6, P.steel); r(4, 3, 8, 1, "#c2c7d0"); r(7, 5, 2, 2, "#d9dde4"); r(10, 10, 2, 2, "#f7f8fa");
  },
  [G.CHAIR]: (r) => {         // 패브릭 의자 (앉는 사람이 아래를 봄)
    r(4, 1, 8, 6, "#3f6a6e"); r(5, 2, 6, 1, "#4f7e82"); r(3, 7, 10, 4, "#4a777b"); r(3, 7, 10, 1, "#5a8a8e");
    r(7, 11, 2, 2, "#3a2a24"); r(4, 13, 8, 1, "#3a2a24"); shadow(r, 4, 14, 8);
  },
  [G.CHAIR_UP]: (r) => {
    r(3, 2, 10, 4, "#4a777b"); r(3, 2, 10, 1, "#5a8a8e"); r(4, 6, 8, 6, "#3f6a6e"); r(5, 7, 6, 1, "#4f7e82");
    r(7, 12, 2, 1, "#3a2a24"); r(4, 13, 8, 1, "#3a2a24"); shadow(r, 4, 14, 8);
  },
  [G.MTABLE]: (r) => { r(0, 1, 16, 12, P.walnut); r(0, 1, 16, 1, P.walnutHi); r(0, 13, 16, 2, "#45322a"); shadow(r, 0, 15, 16); },
  [G.COUNTER]: (r) => {       // 안내 데스크: 흰 상판 + 월넛 전면 + 간접등
    r(0, 2, 16, 4, P.white); r(0, 2, 16, 1, "#f7f8fa"); r(0, 6, 16, 8, P.walnut); r(0, 6, 16, 1, P.warm); r(0, 14, 16, 1, "#3a2a20"); shadow(r, 0, 15, 16);
  },

  // ── 자료실 · 서버실 ──
  [G.SHELF]: (r) => {
    r(0, 0, 16, 15, "#8a5e3e"); r(1, 0, 14, 14, "#4a3226"); bookRow(r, 0, 6, 1); r(1, 6, 14, 1, "#8a5e3e"); bookRow(r, 7, 6, 4); r(0, 14, 16, 1, "#6e4a32"); shadow(r, 0, 15, 16);
  },
  [G.SHELF_TOP]: (r) => { r(0, 3, 16, 13, "#8a5e3e"); r(0, 3, 16, 1, "#a87450"); r(1, 4, 14, 12, "#4a3226"); bookRow(r, 9, 6, 2); r(1, 8, 14, 1, "#8a5e3e"); bookRow(r, 4, 4, 5); },
  [G.RACK]: (r) => {
    r(1, 0, 14, 15, "#15181f"); r(2, 0, 12, 14, "#1f232c"); shadow(r, 1, 15, 14);
    for (let l = 0; l < 4; l++) { r(3, 1 + l * 3, 8, 2, "#2b303b"); r(4, 2 + l * 3, 6, 1, "#232832"); r(12, 1 + l * 3, 1, 1, l % 2 ? P.led : P.ledB); }
  },
  [G.RACK_TOP]: (r) => { r(1, 5, 14, 11, "#15181f"); r(1, 5, 14, 1, "#2b303b"); r(2, 6, 12, 10, "#1f232c"); r(3, 8, 8, 2, "#2b303b"); r(12, 8, 1, 1, P.led); r(3, 12, 8, 2, "#2b303b"); r(12, 12, 1, 1, "#ffd166"); },

  // ── 휴식 공간 ──
  [G.SOFA]: (r) => { r(0, 3, 16, 11, "#b5832e"); r(0, 3, 16, 4, "#c9973a"); r(1, 8, 14, 5, "#d6a748"); r(1, 8, 14, 1, "#e2b65a"); r(7, 8, 1, 5, "#c9973a"); shadow(r, 0, 14, 16); },
  [G.BED_TOP]: (r) => {       // 퀼트 이불 침대 머리 쪽
    r(1, 0, 14, 16, "#8a5e3e"); r(1, 0, 14, 2, "#a87450"); r(2, 2, 12, 14, "#f2e6cf"); r(3, 3, 10, 4, "#ffffff"); r(3, 6, 10, 1, "#e6d8bd");
    r(2, 9, 12, 7, "#b5503f"); r(2, 9, 12, 1, "#c9654f"); for (let x = 3; x < 14; x += 4) r(x, 11, 2, 2, "#e6d3b3");
  },
  [G.BED_BOT]: (r) => { r(1, 0, 14, 15, "#8a5e3e"); r(2, 0, 12, 13, "#b5503f"); for (let x = 3; x < 14; x += 4) { r(x, 2, 2, 2, "#e6d3b3"); r(x + 2, 7, 2, 2, "#e6d3b3"); } r(1, 13, 14, 2, "#6e4a32"); shadow(r, 1, 15, 14); },
  [G.CAFE_TABLE]: (r) => { r(3, 3, 10, 9, P.white); r(2, 4, 12, 7, P.white); r(3, 3, 10, 1, "#f7f8fa"); r(7, 12, 2, 2, P.steelDk); shadow(r, 4, 14, 8); r(5, 5, 2, 2, "#ffffff"); r(9, 7, 2, 2, "#6a4528"); },
  [G.COFFEE]: (r) => {
    r(2, 0, 12, 15, P.steel); r(2, 0, 12, 1, "#c6cbd4"); r(3, 1, 10, 4, "#23262f"); r(4, 2, 3, 1, P.ledB); r(10, 2, 2, 1, P.led);
    r(5, 7, 6, 5, "#5d636f"); r(6, 9, 4, 3, "#f4f6f9"); r(3, 13, 10, 1, "#5d636f"); shadow(r, 2, 15, 12);
  },
  [G.BENCH]: (r) => { r(0, 4, 16, 7, "#8f4a40"); r(0, 4, 16, 2, "#a35a4e"); r(0, 11, 16, 1, "#6a3029"); r(1, 12, 1, 3, "#5a3c28"); r(14, 12, 1, 3, "#5a3c28"); shadow(r, 0, 15, 16); },
  [G.PLANT]: (r) => {         // 테라코타 화분
    r(4, 9, 8, 6, "#c0683f"); r(4, 9, 8, 1, "#d47a4f"); r(4, 14, 8, 1, "#9c5030"); shadow(r, 4, 15, 8);
    r(3, 2, 10, 8, P.leaf); r(2, 4, 3, 4, P.leafDk); r(11, 3, 3, 4, P.leafDk); r(5, 3, 2, 2, P.leafHi); r(9, 5, 2, 2, P.leafHi);
  },
  [G.PLANT_TOP]: (r) => { r(6, 12, 4, 4, P.leaf); r(4, 14, 2, 2, P.leafDk); r(10, 13, 2, 3, P.leafDk); r(7, 13, 1, 1, P.leafHi); },   // 키 큰 잎 끝만
  [G.GLOBE]: (r) => { r(4, 1, 8, 8, "#3d6fb0"); r(5, 3, 3, 2, P.leaf); r(8, 5, 3, 3, P.leaf); r(4, 1, 8, 1, "#5a8cd0"); r(7, 9, 2, 4, P.steelDk); r(4, 13, 8, 2, P.black); shadow(r, 4, 15, 8); },
  [G.CABINET]: (r) => {
    r(1, 0, 14, 15, "#a87450"); r(1, 0, 14, 1, "#bf8a5f"); r(2, 1, 12, 6, "#b07c55"); r(2, 8, 12, 6, "#b07c55");
    r(6, 3, 4, 1, "#e0c070"); r(6, 10, 4, 1, "#e0c070"); r(1, 7, 14, 1, "#7a5236"); shadow(r, 1, 15, 14);
  },
  [G.STANDBOARD]: (r) => { r(0, 1, 16, 10, "#b8bec9"); r(1, 2, 14, 8, "#f4f6f9"); r(2, 3, 6, 1, "#3d6fb0"); r(2, 5, 9, 1, "#c0504d"); r(10, 3, 3, 3, "#ffd166"); r(3, 11, 1, 4, P.steelDk); r(12, 11, 1, 4, P.steelDk); shadow(r, 2, 15, 12); },
  [G.LAB]: (r) => {                                              // 연구실: 연한 리놀륨 바닥
    r(0, 0, 16, 16, "#a99a86"); r(0, 15, 16, 1, "#978874"); r(15, 0, 1, 16, "#978874"); r(0, 0, 16, 1, "#b5a792"); r(4, 5, 1, 1, "#b2a48f"); r(11, 10, 1, 1, "#9f907b");
  },
  [G.TROPHY]: (r) => {                                           // 완료 트로피 받침대
    r(3, 10, 10, 5, "#6e4a32"); r(3, 10, 10, 1, "#835a3e"); shadow(r, 3, 15, 10);
    r(5, 2, 6, 5, "#e8b84a"); r(5, 2, 6, 1, "#ffd98a"); r(3, 3, 2, 2, "#e8b84a"); r(11, 3, 2, 2, "#e8b84a"); r(7, 7, 2, 2, "#c9973a"); r(6, 9, 4, 1, "#c9973a");
  },
  [G.ELEVATOR]: (r) => {                                         // 엘리베이터 문 (벽)
    DRAW[G.FACE](r); r(2, 0, 12, 16, "#5a5560"); r(3, 1, 10, 15, "#8a8590"); r(7.5, 1, 1, 15, "#5a5560"); r(6, 0, 4, 1, "#ffd98a");
  },
  [G.LAMP]: (r) => { r(4, 1, 8, 4, P.warm); r(5, 0, 6, 1, "#ffe7b0"); r(7, 5, 2, 8, P.steelDk); r(5, 13, 6, 2, P.black); shadow(r, 5, 15, 6); },
};

const OUTLINED = [G.DESK, G.DESK_UP, G.LAPTOP_DESK, G.CHAIR, G.CHAIR_UP, G.SHELF, G.SHELF_TOP, G.RACK, G.RACK_TOP, G.PLANT, G.PLANT_TOP,
  G.SOFA, G.BED_TOP, G.BED_BOT, G.CAFE_TABLE, G.COFFEE, G.BENCH, G.GLOBE, G.CABINET, G.MTABLE, G.COUNTER, G.STANDBOARD, G.LAMP, G.TROPHY];

// 벽에 거는 것: 벽면을 먼저 깔고 그 위에 에셋 타일을 얹는다
const ON_WALL = new Set<number>([G.WINDOW, G.BOSSDOOR]);

/** 외부 에셋 타일셋: public/tiles/<name>.png + .map.json (이름 → 인덱스). 지금은 사용 안 함 */
export interface AssetTiles { img: HTMLImageElement | HTMLCanvasElement; index: Record<string, number> }

/**
 * 타일셋을 캔버스에 그려 돌려준다 (가로 한 줄, GID 순서).
 * 에셋에 같은 이름의 타일이 있으면 에셋을, 없으면 코드로 그린 타일을 쓴다.
 */
export function makeTilesetCanvas(assets?: AssetTiles | null): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = TILE * TILE_COUNT; c.height = TILE;
  const ctx = c.getContext("2d")!;
  const nameOf = Object.fromEntries(Object.entries(G).map(([k, v]) => [v, k])) as Record<number, string>;
  for (let gid = 1; gid <= TILE_COUNT; gid++) {
    const ox = (gid - 1) * TILE;
    const r: R = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(ox + x, y, w, h); };
    const ai = assets?.index[nameOf[gid]];
    if (ai == null) { DRAW[gid]?.(r); continue; }
    if (ON_WALL.has(gid)) DRAW[G.FACE](r);
    ctx.drawImage(assets!.img, ai * TILE, 0, TILE, TILE, ox, 0, TILE, TILE);
  }
  if (assets?.index.PLANT != null) ctx.clearRect((G.PLANT_TOP - 1) * TILE, 0, TILE, TILE);
  // 가구에 진한 외곽선 (바닥·벽은 제외)
  for (const gid of OUTLINED) outlineRegion(ctx, (gid - 1) * TILE, 0, TILE, TILE);
  return c;
}
