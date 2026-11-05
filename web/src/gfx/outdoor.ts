// 건물 밖 풍경: 맵 둘레의 빈 화면을 잔디·나무·산책로·도로로 채운다 (코드로 그린 픽셀아트, 위에서 내려다본 시점)
// 맵 바깥(-M ~ W+M)에 큰 그림 한 장을 깔고 맵보다 아래 깊이에 둔다. 카메라가 맵 가운데를 보면 남는 화면이 풍경이 된다.
// 계절(봄 벚꽃·여름 초록·가을 단풍·겨울 눈)에 따라 나무와 잔디 색이 바뀌고, 정원 벤치 자리는 직원들이 쉬러 나오는 곳이다.
import Phaser from "phaser";

const T = 16;
export const OUT_MARGIN = 32 * T;   // 맵 둘레로 32칸 (반쪽 화면·가로 넓은 화면 모두 넉넉히)

type RGB = [number, number, number];
const hex = (s: string): RGB => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];

/** 정해진 씨앗으로 늘 같은 풍경 */
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export type Season = "spring" | "summer" | "autumn" | "winter";
/** 지금 계절 (주소 뒤에 ?season=winter 처럼 붙이면 그 계절로 미리보기) */
export function seasonNow(d = new Date()): Season {
  let q: string | null = null;
  try { q = new URLSearchParams(location.search).get("season"); } catch { /* */ }
  if (q === "spring" || q === "summer" || q === "autumn" || q === "winter") return q;
  const m = d.getMonth() + 1;
  return m >= 3 && m <= 5 ? "spring" : m >= 6 && m <= 8 ? "summer" : m >= 9 && m <= 11 ? "autumn" : "winter";
}

/** 바깥 배치 (월드 좌표, 맵 왼쪽 위가 0,0) — 그림·정원 벤치·직원 출퇴근 길·움직이는 풍경이 같이 쓴다 */
export interface Bench { x: number; y: number; w: number; side: "bottom" | "left" | "right" }
export interface OutdoorGeo {
  W: number; H: number; SW: number;
  roadY0: number; roadY1: number;
  door: { y: number; walkX: number } | null;   // 문 줄 가운데 y, 산책로가 도로 쪽으로 꺾이는 x
  benches: Bench[];
}
export const BENCH_W = 40;   // 둘이 나란히 앉아도 겹치지 않게
export function outdoorGeo(W: number, H: number, door: { tx: number; ty: number } | null): OutdoorGeo {
  const SW = 20, roadY0 = H + SW + 3 * T, roadY1 = roadY0 + 4 * T;
  const d = door ? { y: door.ty * T + T / 2, walkX: W + SW + 5 * T - 14 } : null;
  const benches: Bench[] = [];
  const by = H + SW + 8;   // 아래쪽 잔디 띠, 보도 바로 아래 (세로로 긴 창에서도 이름표까지 보이는 자리)
  for (let x = 40; x + BENCH_W <= W - 20; x += 120) benches.push({ x, y: by, w: BENCH_W, side: "bottom" });
  for (const x of [-170, -300]) benches.push({ x, y: by, w: BENCH_W, side: "bottom" });
  if (d) for (const x of [W + 140, W + 260]) benches.push({ x, y: by, w: BENCH_W, side: "bottom" });
  for (let y = 70; y <= H - 40; y += 120) benches.push({ x: -SW - 64, y, w: BENCH_W, side: "left" });   // 가로로 넓은 창용
  if (d) for (const dy of [-30, 30]) benches.push({ x: d.walkX + 20, y: d.y + dy, w: BENCH_W, side: "right" });
  return { W, H, SW, roadY0, roadY1, door: d, benches };
}

const TREES: Record<Season, { p: number; on: string[][]; off: string[][] }> = {
  spring: { p: 0.3, on: [["#c46a8c", "#ec9ab6", "#ffd3e2"]], off: [["#4a7d3c", "#66a04c", "#93cf6b"]] },                       // 벚꽃
  summer: { p: 0, on: [], off: [["#33663a", "#4b8a40", "#72b55a"]] },
  autumn: { p: 0.55, on: [["#9e4430", "#cf5f3c", "#f08a5a"], ["#a65a32", "#d27a3c", "#f0a85a"], ["#a8822e", "#d4a63e", "#f0cc68"]], off: [["#46683a", "#5f8848", "#86ad62"]] },   // 단풍
  winter: { p: 0.5, on: [], off: [["#2f5a3a", "#3f7048", "#eef4f6"]] },                                                        // on = 잎 진 나무, off = 눈 쌓인 상록수
};
const GRASS: Record<Season, string[]> = {
  spring: ["#93bd6c", "#89b264", "#9ec777", "#83aa5d"],
  summer: ["#86b562", "#7daa5a", "#92c06c", "#76a054"],
  autumn: ["#97b66a", "#8dac62", "#a2bf73", "#86a35b"],
  winter: ["#b9c6a8", "#adbb9d", "#c6d1b8", "#a3b293"],
};
const LEAF: Record<Season, string[]> = {
  spring: ["#f6b6c9", "#ffd3e2", "#f09ab4"], summer: [], autumn: ["#d2643a", "#e8a04a", "#c94a36", "#e6c25a"], winter: [],
};

export function addOutdoor(scene: Phaser.Scene, W: number, H: number, door: { tx: number; ty: number } | null, seed = 20261105, season: Season = seasonNow()) {
  const M = OUT_MARGIN, CW = W + 2 * M, CH = H + 2 * M;
  const geo = outdoorGeo(W, H, door);
  const cv = document.createElement("canvas"); cv.width = CW; cv.height = CH;
  const ctx = cv.getContext("2d")!;
  const R = rng(seed);

  // 구역(캔버스 좌표 = 월드 + M): 건물(맵) · 둘레 보도 · 문에서 나가는 산책로 · 아래쪽 도로 · 정원 벤치
  const bx0 = M, by0 = M, bx1 = M + W, by1 = M + H;
  const SW = geo.SW;
  const roadY0 = geo.roadY0 + M, roadY1 = geo.roadY1 + M;
  const doorY = door ? M + door.ty * T + T / 2 : -9999;   // 문이 없으면 산책로 없음
  const walkX0 = bx1 + SW, walkX1 = walkX0 + 5 * T;   // 문 → 동쪽 → 도로로 꺾이는 산책로
  const benches = geo.benches.map(b => ({ ...b, x: b.x + M, y: b.y + M }));
  const inRect = (x: number, y: number, x0: number, y0: number, x1: number, y1: number) => x >= x0 && x < x1 && y >= y0 && y < y1;
  const isSidewalk = (x: number, y: number) => inRect(x, y, bx0 - SW, by0 - SW, bx1 + SW, by1 + SW) && !inRect(x, y, bx0, by0, bx1, by1);
  const isWalk = (x: number, y: number) => !!door && (inRect(x, y, bx1, doorY - 14, walkX1, doorY + 14) || inRect(x, y, walkX1 - 28, doorY - 14, walkX1, roadY0));
  const isRoad = (y: number) => y >= roadY0 && y < roadY1;
  const isCurb = (y: number) => (y >= roadY0 - 10 && y < roadY0) || (y >= roadY1 && y < roadY1 + 10);
  // 벤치 자리와 거기까지 걸어가는 길 (나무가 막지 않게)
  const nearBench = (x: number, y: number, pad: number) => benches.some(b =>
    inRect(x, y, b.x - pad, b.y - 24 - pad, b.x + b.w + pad, b.y + 10 + pad) ||
    (b.side === "left" && inRect(x, y, b.x - pad, b.y - 16 - pad, bx0 - SW + pad, b.y + 10 + pad)));
  const busy = (x: number, y: number, pad: number) =>
    inRect(x, y, bx0 - SW - pad, by0 - SW - pad, bx1 + SW + pad, by1 + SW + pad) ||
    inRect(x, y, bx1, doorY - 14 - pad, walkX1 + pad, doorY + 14 + pad) || inRect(x, y, walkX1 - 28 - pad, doorY - 14, walkX1 + pad, roadY0) ||
    (y >= roadY0 - 10 - pad && y < roadY1 + 10 + pad) || nearBench(x, y, pad);

  // ① 바닥 픽셀 한 번에: 잔디(두 톤 디더 + 결, 겨울엔 눈 얼룩) · 보도 타일 · 도로 · 연석
  const img = ctx.createImageData(CW, CH), d = img.data;
  const G = GRASS[season].map(hex), SNOW = hex("#eef3f4"), SNOW2 = hex("#dfe7ea");
  const STONE = hex("#ddd5c4"), STONE2 = hex("#cfc6b3"), STONE3 = hex("#e6dfd0");
  const ROAD = hex("#5f6369"), ROAD2 = hex("#585c62"), LINE = hex("#f1e2a8"), CURB = hex("#c4bba9"), CURB2 = hex("#b2a996");
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    let c: RGB;
    if (inRect(x, y, bx0, by0, bx1, by1)) continue;   // 건물 자리는 비움 (맵이 그려짐)
    if (isRoad(y)) {
      const mid = (roadY0 + roadY1) / 2;
      c = Math.abs(y - mid) < 1.5 && Math.floor(x / 24) % 2 === 0 ? LINE : ((x * 7 + y * 13) % 11 === 0 ? ROAD2 : ROAD);
    } else if (isCurb(y)) c = (y === roadY0 - 1 || y === roadY1) ? CURB2 : (x % 32 === 0 ? CURB2 : CURB);
    else if (isSidewalk(x, y) || isWalk(x, y)) {
      const gx = (x - (bx0 - SW)) % T, gy = (y - (by0 - SW)) % T;
      c = gx === 0 || gy === 0 ? STONE2 : (gx === 1 || gy === 1 ? STONE3 : STONE);
    } else {
      // 잔디: 결이 보이는 디더 + 가끔 짙은 점
      const n = (x * 374761393 + y * 668265263) >>> 0, r = (n ^ (n >>> 13)) * 1274126177 >>> 0;
      c = G[((x >> 1) + (y >> 2)) % 7 === 0 ? 2 : r % 23 === 0 ? 3 : (x + y) % 2 === 0 && r % 5 === 0 ? 1 : 0];
      if (season === "winter") {   // 거의 다 눈, 군데군데 풀이 드러남 (낮은 주파수 무늬) + 가장자리 디더
        const s = Math.sin(x / 23) + Math.sin(y / 17) + Math.sin((x + y) / 31);
        if (s > -1.6 || (s > -2 && (x + y) % 2 === 0)) c = r % 9 === 0 ? SNOW2 : SNOW;
      }
    }
    const i = (y * CW + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  const px = (x: number, y: number, col: string, w = 1, h = 1) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  const disc = (cx: number, cy: number, r: number, col: string) => {
    ctx.fillStyle = col;
    for (let y = -r; y <= r; y++) { const w = Math.floor(Math.sqrt(r * r - y * y + r * 0.6)); ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1); }
  };

  // 건물 그림자 (오른쪽 아래로 살짝) — 건물이 땅 위에 서 있는 느낌
  ctx.fillStyle = "rgba(40,50,30,0.22)";
  ctx.fillRect(bx1, by0 + 6, 6, H); ctx.fillRect(bx0 + 6, by1, W, 6);

  // ② 잔디 장식: 풀 무더기 · 작은 꽃 (봄엔 꽃이 두 배, 겨울엔 없음)
  const flowers = season === "spring" ? 2 : season === "winter" ? 0 : 1;
  for (let k = 0; k < (CW * CH) / 900; k++) {
    const x = R() * CW, y = R() * CH;
    if (busy(x, y, 2) || season === "winter") continue;
    if (R() < 1 - 0.3 * flowers) { px(x, y, "#6f9a50"); px(x + 2, y, "#6f9a50"); px(x + 1, y - 1, "#6f9a50"); }
    else { const f = ["#fff6e8", "#ffd86b", "#f6a6b8", "#c9b6ff"][Math.floor(R() * 4)]; px(x, y, f); px(x + 1, y + 1, "#6f9a50"); }
  }
  // 꽃밭 몇 군데
  for (let k = 0; k < 10 * flowers; k++) {
    const cx = R() * CW, cy = R() * CH;
    if (busy(cx, cy, 30)) continue;
    const f = ["#ffd86b", "#f6a6b8", "#fff6e8", "#ff9b7a"][k % 4];
    for (let j = 0; j < 26; j++) { const a = R() * 6.28, rr = R() * 12; px(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.7, j % 3 ? f : "#6f9a50", 2, 2); }
  }

  // ③ 건물 둘레 산울타리 (보도 바깥, 문·산책로·왼쪽 벤치 길 자리는 비움). 겨울엔 위에 눈
  const hedge = (x: number, y: number) => {
    disc(x + 1, y + 2, 6, "rgba(40,60,30,0.25)"); disc(x, y, 6, "#4f7f43"); disc(x - 1, y - 1, 5, "#5f9450"); px(x - 3, y - 3, "#82b56a", 2, 1); px(x + 1, y - 4, "#82b56a");
    if (season === "winter") { px(x - 4, y - 5, "#f4f8fa", 7, 2); px(x - 2, y - 6, "#ffffff", 4, 1); }
  };
  const leftGap = (y: number) => benches.some(b => b.side === "left" && y > b.y - 18 && y < b.y + 14);
  for (let x = bx0 - SW - 4; x <= bx1 + SW + 4; x += 11) { hedge(x, by0 - SW - 6); }
  for (let y = by0 - SW + 6; y <= by1 + SW; y += 11) { if (!leftGap(y)) hedge(bx0 - SW - 6, y); if (Math.abs(y - doorY) > 26) hedge(bx1 + SW + 6, y); }

  // ④ 나무 (서로 겹치지 않게, 길·보도·벤치 피해서) — 색은 계절 따라
  const trees: [number, number, number][] = [];
  for (let k = 0; k < 4000 && trees.length < 260; k++) {
    const x = 10 + R() * (CW - 20), y = 10 + R() * (CH - 20), r = 9 + Math.floor(R() * 6);
    if (busy(x, y, r + 8)) continue;
    if (trees.some(([a, b, rr]) => Math.hypot(a - x, b - y) < r + rr + 6)) continue;
    trees.push([x, y, r]);
  }
  trees.sort((a, b) => a[1] - b[1]);
  const pal = TREES[season], fallen = LEAF[season];
  for (const [x, y, r] of trees) {
    const special = R() < pal.p, set = special ? pal.on : pal.off;
    ctx.fillStyle = "rgba(30,45,25,0.28)"; ctx.beginPath(); ctx.ellipse(x + 4, y + r * 0.8, r * 1.05, r * 0.5, 0, 0, 6.29); ctx.fill();
    if (season === "winter" && special) {   // 잎 진 나무: 줄기 + 잔가지, 가지 위에 눈
      px(x - 1, y - r * 0.6, "#6b4a32", 3, r * 1.5);
      for (let j = 0; j < 7; j++) {
        const a = -Math.PI / 2 + (R() - 0.5) * 2.4, len = r * (0.5 + R() * 0.5);
        for (let s = 2; s < len; s++) px(x + Math.cos(a) * s, y - r * 0.2 + Math.sin(a) * s, s > len - 2 ? "#f4f8fa" : "#7a5638");
      }
      continue;
    }
    const [dark, mid, lite] = set[Math.floor(R() * set.length)];
    px(x - 2, y + r * 0.3, "#6b4a32", 4, r * 0.6);
    disc(x, y, r, dark); disc(x - 1, y - 1, r - 2, mid);
    disc(x - r * 0.35, y - r * 0.35, Math.max(2, r * 0.35), lite);
    for (let j = 0; j < 5; j++) px(x + (R() - 0.5) * r * 1.2, y + (R() - 0.5) * r * 1.2, lite);
    // 떨어진 잎·꽃잎이 나무 밑에 소복이
    if (fallen.length && (special || season === "autumn")) for (let j = 0; j < (special ? 14 : 5); j++) {
      const a = R() * 6.28, rr = r * (0.8 + R() * 0.9), lx = x + Math.cos(a) * rr, ly = y + r * 0.5 + Math.sin(a) * rr * 0.55;
      if (!busy(lx, ly, 0)) px(lx, ly, fallen[Math.floor(R() * fallen.length)], 2, 1);
    }
  }

  // ⑤ 도로가 가로등 · 정원 벤치
  for (let x = 24; x < CW; x += 6 * T) {
    const y = roadY0 - 14;
    px(x + 2, y + 3, "rgba(30,30,30,0.25)", 10, 2);
    px(x, y - 10, "#4a4f57", 2, 13); px(x - 2, y - 13, "#3c4047", 6, 3); px(x - 1, y - 12, "#ffe7a3", 4, 1);
  }
  for (const b of benches) {   // 위에서 본 벤치: 등받이 + 앉는 판 두 줄 + 다리
    const { x, y, w } = b;
    px(x + 1, y + 7, "rgba(30,30,30,0.22)", w, 2);
    px(x, y - 2, "#6b4430", w, 2);
    px(x, y + 1, "#9a6844", w, 2); px(x, y + 4, "#8a5a3a", w, 2); px(x, y + 1, "#b58058", w, 1);
    px(x + 1, y + 6, "#5c3b26", 2, 2); px(x + w - 3, y + 6, "#5c3b26", 2, 2);
    if (season === "winter") px(x + 2, y - 3, "#f4f8fa", w - 4, 1);
  }

  // ⑥ 산책로 입구 표지판
  if (door) px(walkX0 + 4, doorY - 24, "#6b4a32", 2, 10); if (door) { px(walkX0, doorY - 30, "#f6efe0", 12, 7); px(walkX0 + 1, doorY - 27, "#e8875a", 10, 1); }

  const key = `outdoor-${scene.sys.settings.key}`;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, cv);
  const image = scene.add.image(-M, -M, key).setOrigin(0, 0).setDepth(-100);
  return { image, geo, season };
}
