// 움직이는 바깥 풍경: 계절 따라 흩날리는 꽃잎·낙엽·눈, 잔디 위로 흘러가는 구름 그림자, 가끔 지나가는 새 떼, 도로를 달리는 차.
// 새를 빼고는 모두 건물보다 아래 깊이에 그려서 사무실 안을 가리지 않는다. 화면에 보이는 바깥에서만 생긴다.
import Phaser from "phaser";
import { OutdoorGeo, Season } from "./outdoor";

type Px = (x: number, y: number, c: string, w?: number, h?: number) => void;
function tex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (px: Px, g: CanvasRenderingContext2D) => void) {
  if (scene.textures.exists(key)) return;
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const g = cv.getContext("2d")!;
  draw((x, y, c, ww = 1, hh = 1) => { g.fillStyle = c; g.fillRect(x, y, ww, hh); }, g);
  scene.textures.addCanvas(key, cv);
}

const FALL: Record<Season, { colors: string[]; every: number; max: number; size: [number, number]; fall: [number, number]; sway: number } | null> = {
  spring: { colors: ["#ffd3e2", "#f6b6c9", "#fff0f4"], every: 0.35, max: 26, size: [2, 2], fall: [9, 15], sway: 5 },        // 벚꽃잎
  summer: null,
  autumn: { colors: ["#d2643a", "#e8a04a", "#c94a36", "#e6c25a"], every: 0.45, max: 22, size: [2, 1], fall: [11, 18], sway: 6 },   // 낙엽
  winter: { colors: ["#ffffff", "#f2f6f8"], every: 0.07, max: 90, size: [1, 1], fall: [8, 14], sway: 3 },                      // 눈
};
const CARS = ["#e07a6a", "#7fa7d9", "#f2d27a", "#9fd1a8", "#c9b6ff", "#f3efe6", "#5b6170"];
const BELOW_BUILDING = -99;   // 바깥 그림(-100) 위, 건물 타일(0) 아래
const BIRD_DEPTH = 9940;      // 가구 윗부분 위, 이름표·말풍선 아래

function ensure(scene: Phaser.Scene, season: Season) {
  const f = FALL[season];
  if (f) f.colors.forEach((c, i) => tex(scene, `fall-${season}-${i}`, f.size[0], f.size[1], px => px(0, 0, c, f.size[0], f.size[1])));
  // 구름 그림자: 가장자리가 디더로 흐려지는 납작한 타원
  tex(scene, "cloud-shadow", 120, 56, px => {
    for (let y = 0; y < 56; y++) for (let x = 0; x < 120; x++) {
      const dx = (x - 60) / 60, dy = (y - 28) / 28, d = Math.hypot(dx * (1 + 0.25 * Math.sin(y / 5)), dy);
      if (d < 0.72 || (d < 1 && (x + y) % 2 === 0 && d < 0.72 + 0.28 * (((x * 7 + y * 13) % 10) / 10))) px(x, y, "#1f2d1c");
    }
  });
  // 새: 날개 위 / 아래 두 장
  tex(scene, "bird-0", 7, 4, px => { px(0, 0, "#3b3f4a"); px(1, 1, "#3b3f4a"); px(2, 2, "#3b3f4a"); px(3, 2, "#3b3f4a"); px(4, 2, "#3b3f4a"); px(5, 1, "#3b3f4a"); px(6, 0, "#3b3f4a"); });
  tex(scene, "bird-1", 7, 4, px => { px(0, 2, "#3b3f4a"); px(1, 2, "#3b3f4a"); px(2, 1, "#3b3f4a"); px(3, 1, "#3b3f4a"); px(4, 1, "#3b3f4a"); px(5, 2, "#3b3f4a"); px(6, 2, "#3b3f4a"); });
  // 차 (위에서 본 모습, 오른쪽으로 달림)
  CARS.forEach((body, i) => tex(scene, `car-${i}`, 33, 17, px => {
    px(2, 3, "rgba(20,20,20,0.3)", 30, 14);
    px(0, 1, body, 30, 14); px(1, 0, body, 28, 1); px(1, 15, body, 28, 1);
    px(8, 3, "#2f3a48", 5, 10); px(20, 3, "#2f3a48", 4, 10);   // 앞·뒤 유리
    px(13, 3, "rgba(255,255,255,0.25)", 7, 10);                 // 지붕 반사
    px(29, 3, "#fff3b0", 1, 3); px(29, 10, "#fff3b0", 1, 3);    // 전조등
    px(0, 3, "#c0504d", 1, 2); px(0, 11, "#c0504d", 1, 2);      // 미등
  }));
}

/** topCover: 화면 위쪽을 가리는 HTML(멤버 보드) 높이를 월드 단위로 */
export function addOutdoorLife(scene: Phaser.Scene, geo: OutdoorGeo, season: Season, topCover: () => number = () => 0) {
  ensure(scene, season);
  const cam = scene.cameras.main, R = Math.random;

  // 지금 화면에 보이는 바깥 직사각형들 (건물 위·아래·왼쪽·오른쪽)
  const outRects = () => {
    const v = cam.worldView, L = v.x, Rt = v.right, T = v.y + topCover(), B = v.bottom;
    const rs: [number, number, number, number][] = [];
    if (T < 0) rs.push([L, T, Rt, Math.min(0, B)]);
    if (B > geo.H) rs.push([L, Math.max(geo.H, T), Rt, B]);
    const y0 = Math.max(0, T), y1 = Math.min(geo.H, B);
    if (y1 > y0) { if (L < 0) rs.push([L, y0, Math.min(0, Rt), y1]); if (Rt > geo.W) rs.push([Math.max(geo.W, L), y0, Rt, y1]); }
    return rs.filter(r => r[2] - r[0] > 4 && r[3] - r[1] > 4);
  };
  const area = (rs: [number, number, number, number][]) => rs.reduce((a, r) => a + (r[2] - r[0]) * (r[3] - r[1]), 0);
  const randomOut = (rs: [number, number, number, number][]) => {
    let k = R() * area(rs);
    for (const r of rs) { const a = (r[2] - r[0]) * (r[3] - r[1]); if (k < a) return { x: r[0] + R() * (r[2] - r[0]), y: r[1] + R() * (r[3] - r[1]) }; k -= a; }
    return null;
  };

  // ── 흩날리는 것들 ──
  const fall = FALL[season];
  type P = { img: Phaser.GameObjects.Image; x: number; y: number; h: number; vx: number; vf: number; ph: number; landed: number };
  const ps: P[] = [];
  let fallT = 0;
  // ── 구름 그림자 3개 (천천히 동쪽으로) ──
  const clouds = [0, 1, 2].map(i => ({ img: scene.add.image(0, 0, "cloud-shadow").setDepth(BELOW_BUILDING - 0.5).setAlpha(0.1 + 0.03 * i).setScale(1 + i * 0.45, 1 + i * 0.3), v: 4 + i * 1.6, placed: false }));
  // ── 새 떼 / 차 ──
  type Bird = { img: Phaser.GameObjects.Image; x: number; y: number; vx: number; ph: number };
  let birds: Bird[] = [], nextBirds = 6 + R() * 14;
  type Car = { img: Phaser.GameObjects.Image; x: number; vx: number };
  let cars: Car[] = [], nextCar = 1 + R() * 3;
  let t = 0;

  const tick = (_: number, dms: number) => {
    const dt = Math.min(0.1, dms / 1000); t += dt;
    const v = cam.worldView;
    if (!v.width) return;
    const rs = outRects(), outArea = area(rs);

    if (fall && rs.length) {
      fallT -= dt;
      const every = fall.every / Math.min(1.5, Math.max(0.25, outArea / 120000));
      if (fallT <= 0 && ps.length < fall.max) {
        fallT = every * (0.6 + R() * 0.8);
        const at = randomOut(rs);
        if (at) {
          const img = scene.add.image(at.x, at.y, `fall-${season}-${Math.floor(R() * fall.colors.length)}`).setDepth(BELOW_BUILDING);
          ps.push({ img, x: at.x, y: at.y, h: 26 + R() * 40, vx: 5 + R() * 9, vf: fall.fall[0] + R() * (fall.fall[1] - fall.fall[0]), ph: R() * 6.28, landed: 0 });
        }
      }
    }
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      if (p.h > 0) {
        p.h -= p.vf * dt; p.x += p.vx * dt;
        const sway = Math.sin(t * 2.2 + p.ph) * (fall?.sway ?? 3);
        p.img.setPosition(Math.round(p.x + sway), Math.round(p.y - Math.max(0, p.h)));
        if (season !== "winter") p.img.setAngle(Math.sin(t * 5 + p.ph) > 0 ? 0 : 90);   // 빙글빙글
      } else {
        p.landed += dt;   // 땅에 내려앉았다가 서서히 사라짐
        if (p.landed > 2.5) p.img.setAlpha(Math.max(0, 1 - (p.landed - 2.5) / 1.5));
        if (p.landed > 4) { p.img.destroy(); ps.splice(i, 1); }
      }
    }

    for (const c of clouds) {
      const w = c.img.displayWidth, h = c.img.displayHeight;
      if (!c.placed) { c.img.setPosition(v.x + R() * v.width, v.y + R() * v.height); c.placed = true; }
      c.img.x += c.v * dt;
      if (c.img.x - w / 2 > v.right + 10) c.img.setPosition(v.x - w / 2 - R() * 160, v.y + h / 2 + R() * Math.max(1, v.height - h));
      c.img.setPosition(c.img.x, c.img.y);
    }

    // 새 떼: 20~50초마다 3~5마리가 V 모양으로 화면을 가로질러 감
    nextBirds -= dt;
    if (nextBirds <= 0 && !birds.length) {
      nextBirds = 20 + R() * 30;
      const dir = R() < 0.5 ? 1 : -1, n = 3 + Math.floor(R() * 3), y0 = v.y + topCover() + v.height * (0.1 + R() * 0.45), vx = dir * (48 + R() * 16);
      for (let k = 0; k < n; k++) {
        const side = k % 2 ? 1 : -1, rank = Math.ceil(k / 2);
        const x = (dir > 0 ? v.x - 20 : v.right + 20) - dir * rank * 8;
        birds.push({ img: scene.add.image(x, y0 + side * rank * 5, "bird-0").setDepth(BIRD_DEPTH).setAlpha(0.85), x, y: y0 + side * rank * 5, vx, ph: R() * 6.28 });
      }
    }
    for (const b of birds) {
      b.x += b.vx * dt;
      b.img.setPosition(Math.round(b.x), Math.round(b.y + Math.sin(t * 1.6 + b.ph) * 2)).setTexture(`bird-${Math.floor(t * 6 + b.ph) % 2}`);
    }
    if (birds.length && birds.every(b => (b.vx > 0 ? b.x > v.right + 40 : b.x < v.x - 40))) { birds.forEach(b => b.img.destroy()); birds = []; }

    // 차: 도로가 화면에 보일 때만. 아래 차선은 오른쪽으로, 위 차선은 왼쪽으로
    const roadSeen = geo.roadY0 < v.bottom && geo.roadY1 > v.y;
    nextCar -= dt;
    if (roadSeen && nextCar <= 0) {
      nextCar = 4 + R() * 8;
      const dir = R() < 0.5 ? 1 : -1, y = dir > 0 ? geo.roadY0 + 49 : geo.roadY0 + 17, x = dir > 0 ? v.x - 40 : v.right + 40;
      const img = scene.add.image(x, y, `car-${Math.floor(R() * CARS.length)}`).setDepth(BELOW_BUILDING + 0.2).setFlipX(dir < 0);
      cars.push({ img, x, vx: dir * (70 + R() * 40) });
    }
    for (const c of cars) { c.x += c.vx * dt; c.img.setX(Math.round(c.x)); }
    const gone = cars.filter(c => (c.vx > 0 ? c.x > v.right + 60 : c.x < v.x - 60));
    if (gone.length) { gone.forEach(c => c.img.destroy()); cars = cars.filter(c => !gone.includes(c)); }
  };
  scene.events.on("update", tick);
  scene.events.once("shutdown", () => scene.events.off("update", tick));
}
