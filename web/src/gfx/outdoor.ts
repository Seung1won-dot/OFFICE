// 건물 밖 풍경: 맵 둘레의 빈 화면을 잔디·나무·산책로·도로로 채운다 (코드로 그린 픽셀아트, 위에서 내려다본 시점)
// 맵 바깥(-M ~ W+M)에 큰 그림 한 장을 깔고 맵보다 아래 깊이에 둔다. 카메라가 맵 가운데를 보면 남는 화면이 풍경이 된다.
import Phaser from "phaser";

const T = 16;
export const OUT_MARGIN = 32 * T;   // 맵 둘레로 32칸 (반쪽 화면·가로 넓은 화면 모두 넉넉히)

type RGB = [number, number, number];
const hex = (s: string): RGB => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];

/** 정해진 씨앗으로 늘 같은 풍경 */
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export function addOutdoor(scene: Phaser.Scene, W: number, H: number, door: { tx: number; ty: number } | null, seed = 20261105) {
  const M = OUT_MARGIN, CW = W + 2 * M, CH = H + 2 * M;
  const cv = document.createElement("canvas"); cv.width = CW; cv.height = CH;
  const ctx = cv.getContext("2d")!;
  const R = rng(seed);

  // 구역: 건물(맵) · 둘레 보도 · 문에서 나가는 산책로 · 아래쪽 도로
  const bx0 = M, by0 = M, bx1 = M + W, by1 = M + H;
  const SW = 20;                                       // 건물 둘레 보도 폭
  const roadY0 = by1 + SW + 3 * T, roadY1 = roadY0 + 4 * T;   // 도로 (보도 아래 잔디 3칸 뒤)
  const doorY = door ? M + door.ty * T + T / 2 : -9999;   // 문이 없으면 산책로 없음
  const walkX0 = bx1 + SW, walkX1 = walkX0 + 5 * T;   // 문 → 동쪽 → 도로로 꺾이는 산책로
  const inRect = (x: number, y: number, x0: number, y0: number, x1: number, y1: number) => x >= x0 && x < x1 && y >= y0 && y < y1;
  const isSidewalk = (x: number, y: number) => inRect(x, y, bx0 - SW, by0 - SW, bx1 + SW, by1 + SW) && !inRect(x, y, bx0, by0, bx1, by1);
  const isWalk = (x: number, y: number) => !!door && (inRect(x, y, bx1, doorY - 14, walkX1, doorY + 14) || inRect(x, y, walkX1 - 28, doorY - 14, walkX1, roadY0));
  const isRoad = (y: number) => y >= roadY0 && y < roadY1;
  const isCurb = (y: number) => (y >= roadY0 - 10 && y < roadY0) || (y >= roadY1 && y < roadY1 + 10);
  const busy = (x: number, y: number, pad: number) =>
    inRect(x, y, bx0 - SW - pad, by0 - SW - pad, bx1 + SW + pad, by1 + SW + pad) ||
    inRect(x, y, bx1, doorY - 14 - pad, walkX1 + pad, doorY + 14 + pad) || inRect(x, y, walkX1 - 28 - pad, doorY - 14, walkX1 + pad, roadY0) ||
    (y >= roadY0 - 10 - pad && y < roadY1 + 10 + pad);

  // ① 바닥 픽셀 한 번에: 잔디(두 톤 디더 + 결) · 보도 타일 · 도로 · 연석
  const img = ctx.createImageData(CW, CH), d = img.data;
  const G = [hex("#8fb86a"), hex("#86ae62"), hex("#9ac274"), hex("#7fa65b")];
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

  // ② 잔디 장식: 풀 무더기 · 작은 꽃
  for (let k = 0; k < (CW * CH) / 900; k++) {
    const x = R() * CW, y = R() * CH;
    if (busy(x, y, 2)) continue;
    if (R() < 0.7) { px(x, y, "#6f9a50"); px(x + 2, y, "#6f9a50"); px(x + 1, y - 1, "#6f9a50"); }
    else { const f = ["#fff6e8", "#ffd86b", "#f6a6b8", "#c9b6ff"][Math.floor(R() * 4)]; px(x, y, f); px(x + 1, y + 1, "#6f9a50"); }
  }
  // 꽃밭 몇 군데
  for (let k = 0; k < 10; k++) {
    const cx = R() * CW, cy = R() * CH;
    if (busy(cx, cy, 30)) continue;
    const f = ["#ffd86b", "#f6a6b8", "#fff6e8", "#ff9b7a"][k % 4];
    for (let j = 0; j < 26; j++) { const a = R() * 6.28, rr = R() * 12; px(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.7, j % 3 ? f : "#6f9a50", 2, 2); }
  }

  // ③ 건물 둘레 산울타리 (보도 바깥, 문·산책로 자리는 비움)
  const hedge = (x: number, y: number) => { disc(x + 1, y + 2, 6, "rgba(40,60,30,0.25)"); disc(x, y, 6, "#4f7f43"); disc(x - 1, y - 1, 5, "#5f9450"); px(x - 3, y - 3, "#82b56a", 2, 1); px(x + 1, y - 4, "#82b56a"); };
  for (let x = bx0 - SW - 4; x <= bx1 + SW + 4; x += 11) { hedge(x, by0 - SW - 6); }
  for (let y = by0 - SW + 6; y <= by1 + SW; y += 11) { hedge(bx0 - SW - 6, y); if (Math.abs(y - doorY) > 26) hedge(bx1 + SW + 6, y); }

  // ④ 나무 (서로 겹치지 않게, 길·보도 피해서)
  const trees: [number, number, number][] = [];
  for (let k = 0; k < 4000 && trees.length < 260; k++) {
    const x = 10 + R() * (CW - 20), y = 10 + R() * (CH - 20), r = 9 + Math.floor(R() * 6);
    if (busy(x, y, r + 8)) continue;
    if (trees.some(([a, b, rr]) => Math.hypot(a - x, b - y) < r + rr + 6)) continue;
    trees.push([x, y, r]);
  }
  trees.sort((a, b) => a[1] - b[1]);
  for (const [x, y, r] of trees) {
    const autumn = R() < 0.28;   // 늦가을 느낌으로 몇 그루는 단풍
    const [dark, mid, lite] = autumn ? (R() < 0.5 ? ["#a65a32", "#d27a3c", "#f0a85a"] : ["#a8822e", "#d4a63e", "#f0cc68"]) : ["#3f6b3a", "#5a8c48", "#7db35e"];
    ctx.fillStyle = "rgba(30,45,25,0.28)"; ctx.beginPath(); ctx.ellipse(x + 4, y + r * 0.8, r * 1.05, r * 0.5, 0, 0, 6.29); ctx.fill();
    px(x - 2, y + r * 0.3, "#6b4a32", 4, r * 0.6);
    disc(x, y, r, dark); disc(x - 1, y - 1, r - 2, mid);
    disc(x - r * 0.35, y - r * 0.35, Math.max(2, r * 0.35), lite);
    for (let j = 0; j < 5; j++) px(x + (R() - 0.5) * r * 1.2, y + (R() - 0.5) * r * 1.2, lite);
  }

  // ⑤ 도로가: 가로등 · 벤치 · 주차된 차
  for (let x = 24; x < CW; x += 6 * T) {
    const y = roadY0 - 14;
    px(x + 2, y + 3, "rgba(30,30,30,0.25)", 10, 2);
    px(x, y - 10, "#4a4f57", 2, 13); px(x - 2, y - 13, "#3c4047", 6, 3); px(x - 1, y - 12, "#ffe7a3", 4, 1);
  }
  const bench = (x: number, y: number) => { px(x + 1, y + 6, "rgba(30,30,30,0.25)", 16, 2); px(x, y, "#8a5a3a", 16, 2); px(x, y + 3, "#8a5a3a", 16, 2); px(x + 1, y + 5, "#5c3b26", 2, 2); px(x + 13, y + 5, "#5c3b26", 2, 2); };
  if (door) { bench(walkX1 + 6, doorY - 30); bench(walkX1 + 6, doorY + 30); }
  bench(bx0 + 40, roadY0 - 26); bench(bx0 + W / 2, roadY0 - 26);
  const car = (x: number, y: number, body: string) => {
    px(x + 2, y + 3, "rgba(20,20,20,0.3)", 30, 14);
    px(x, y, body, 30, 14); px(x + 1, y - 1, body, 28, 1); px(x + 1, y + 14, body, 28, 1);
    px(x + 8, y + 2, "#2f3a48", 5, 10); px(x + 20, y + 2, "#2f3a48", 4, 10);   // 앞·뒤 유리
    px(x + 13, y + 2, "rgba(255,255,255,0.25)", 7, 10);                        // 지붕 반사
    px(x + 29, y + 2, "#fff3b0", 1, 3); px(x + 29, y + 9, "#fff3b0", 1, 3);  // 전조등
  };
  const lane = roadY0 + 4;
  car(bx0 + 30, lane, "#e07a6a"); car(bx0 + 120, lane, "#7fa7d9"); car(bx1 - 80, lane, "#f2d27a"); car(bx1 + 140, lane, "#9fd1a8"); car(bx0 - 200, lane, "#c9b6ff");

  // ⑥ 산책로 입구 표지판
  if (door) px(walkX0 + 4, doorY - 24, "#6b4a32", 2, 10); if (door) { px(walkX0, doorY - 30, "#f6efe0", 12, 7); px(walkX0 + 1, doorY - 27, "#e8875a", 10, 1); }

  const key = `outdoor-${scene.sys.settings.key}`;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, cv);
  return scene.add.image(-M, -M, key).setOrigin(0, 0).setDepth(-100);
}
