// 움직이는 바깥 풍경: 계절 따라 흩날리는 꽃잎·낙엽·눈, 잔디 위로 흘러가는 구름 그림자, 가끔 지나가는 새 떼, 도로를 달리는 차.
// 진짜 날씨(ui/weather)가 있으면 그대로 따라간다: 비(빗줄기·튀는 물·웅덩이) · 눈 · 안개 · 흐림 · 뇌우(번개),
// 젖은 땅 · 창문 밖 하늘 색 · 창으로 들어오는 햇살 세기까지. 날씨를 모르면 계절 풍경만.
// 새를 빼고는 모두 건물보다 아래 깊이에 그려서 사무실 안을 가리지 않는다. 화면에 보이는 바깥에서만 생긴다.
import Phaser from "phaser";
import { OutdoorGeo, Season, OUT_MARGIN } from "./outdoor";
import { G } from "../map/defaultMap";
import { weatherNow, lightning, Weather } from "../ui/weather";
import { drawSun } from "./ambience";

type Px = (x: number, y: number, c: string, w?: number, h?: number) => void;
function tex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (px: Px) => void) {
  if (scene.textures.exists(key)) return;
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const g = cv.getContext("2d")!;
  draw((x, y, c, ww = 1, hh = 1) => { g.fillStyle = c; g.fillRect(x, y, ww, hh); });
  scene.textures.addCanvas(key, cv);
}

type Fall = { keys: string[]; every: number; max: number; fall: [number, number]; sway: number; spin: boolean };
const SEASON_FALL: Record<Season, Fall | null> = {
  spring: { keys: ["fall-spring-0", "fall-spring-1", "fall-spring-2"], every: 0.35, max: 26, fall: [9, 15], sway: 5, spin: true },     // 벚꽃잎
  summer: null,
  autumn: { keys: ["fall-autumn-0", "fall-autumn-1", "fall-autumn-2", "fall-autumn-3"], every: 0.45, max: 22, fall: [11, 18], sway: 6, spin: true },   // 낙엽
  winter: { keys: ["fall-winter-0", "fall-winter-1"], every: 0.07, max: 90, fall: [8, 14], sway: 3, spin: false },                 // 눈
};
/** 진짜 눈: 세기(1~3)에 따라 */
const SNOW = (lv: number): Fall => ({ keys: lv >= 3 ? ["fall-winter-0", "snow-big", "fall-winter-1"] : ["fall-winter-0", "fall-winter-1"],
  every: [0.07, 0.07, 0.035, 0.018][lv], max: [90, 90, 160, 260][lv], fall: [8, 15], sway: 3, spin: false });
/** 비: 세기(1~3), 이슬비는 가늘고 성기게. every = 바깥 넓이 12만 px² 기준 한 줄기 간격(초) */
const RAIN = (w: Weather) => {
  if (w.kind === "drizzle") return { every: 0.006, max: 200, key: "rain-2", vy: [150, 180] };
  const lv = Math.min(3, w.kind === "storm" ? 3 : Math.max(1, w.level));
  return { every: [0, 0.004, 0.002, 0.0012][lv], max: [0, 300, 500, 800][lv], key: "", vy: [240, 300] };
};

const CARS = ["#e07a6a", "#7fa7d9", "#f2d27a", "#9fd1a8", "#c9b6ff", "#f3efe6", "#5b6170"];
const BELOW_BUILDING = -99;   // 바깥 그림(-100) 위, 건물 타일(0) 아래
const BIRD_DEPTH = 9940;      // 가구 윗부분 위, 이름표·말풍선 아래

function ensure(scene: Phaser.Scene) {
  const FALLC: Record<string, string[]> = { spring: ["#ffd3e2", "#f6b6c9", "#fff0f4"], autumn: ["#d2643a", "#e8a04a", "#c94a36", "#e6c25a"], winter: ["#ffffff", "#f2f6f8"] };
  const SIZE: Record<string, [number, number]> = { spring: [2, 2], autumn: [2, 1], winter: [1, 1] };
  for (const [s, cs] of Object.entries(FALLC)) cs.forEach((c, i) => tex(scene, `fall-${s}-${i}`, SIZE[s][0], SIZE[s][1], px => px(0, 0, c, SIZE[s][0], SIZE[s][1])));
  tex(scene, "snow-big", 2, 2, px => { px(0, 0, "#ffffff", 2, 2); });
  // 빗줄기 · 튀는 물 · 웅덩이 · 물결
  tex(scene, "rain-0", 1, 6, px => { px(0, 0, "rgba(214,230,242,0.5)", 1, 2); px(0, 2, "rgba(232,242,250,0.85)", 1, 4); });
  tex(scene, "rain-1", 1, 4, px => { px(0, 0, "rgba(200,218,232,0.5)", 1, 1); px(0, 1, "rgba(224,236,246,0.8)", 1, 3); });
  tex(scene, "rain-2", 1, 3, px => { px(0, 0, "rgba(220,232,242,0.55)", 1, 3); });
  tex(scene, "splash", 3, 2, px => { px(0, 1, "#e8f2fa"); px(2, 1, "#e8f2fa"); px(1, 0, "#ffffff"); });
  tex(scene, "puddle", 18, 6, px => {
    for (let y = 0; y < 6; y++) { const w = Math.round(9 * Math.sqrt(1 - ((y - 2.5) / 3) ** 2)); px(9 - w, y, y === 0 || y === 5 ? "#a9bccb" : "#93a9ba", w * 2, 1); }
    px(4, 1, "#c8d8e4", 5, 1);
  });
  tex(scene, "ripple", 9, 3, px => { px(2, 0, "#e4eef6", 5, 1); px(0, 1, "#e4eef6"); px(8, 1, "#e4eef6"); px(2, 2, "#e4eef6", 5, 1); });
  // 구름 그림자 / 안개 덩어리: 가장자리가 디더로 흐려지는 납작한 타원
  const blob = (key: string, col: string) => tex(scene, key, 120, 56, px => {
    for (let y = 0; y < 56; y++) for (let x = 0; x < 120; x++) {
      const dx = (x - 60) / 60, dy = (y - 28) / 28, d = Math.hypot(dx * (1 + 0.25 * Math.sin(y / 5)), dy);
      if (d < 0.72 || (d < 1 && (x + y) % 2 === 0 && d < 0.72 + 0.28 * (((x * 7 + y * 13) % 10) / 10))) px(x, y, col);
    }
  });
  blob("cloud-shadow", "#1f2d1c"); blob("fog-blob", "#f4f6f7");
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

/** 날씨별 목표값: 땅 덮개(색·진하기) · 구름 그림자 배율 · 창밖 하늘(색·진하기) · 창으로 드는 햇살 */
function look(w: Weather | null, season: Season) {
  if (!w) return { ground: [0x000000, 0], clouds: 1, sky: ["", 0], sun: 1 } as const;
  const lv = Math.max(1, w.level);
  switch (w.kind) {
    case "clear": return { ground: [0x000000, 0], clouds: w.level ? 0.9 : 0.5, sky: ["", 0], sun: 1 } as const;
    case "cloudy": return { ground: [0x33404a, 0.03 * lv], clouds: lv > 1 ? 0.6 : 1.4, sky: [lv > 1 ? "#c9d2d9" : "#dfe6eb", lv > 1 ? 0.55 : 0.35], sun: lv > 1 ? 0.35 : 0.65 } as const;
    case "fog": return { ground: [0xeef1f3, 0.32], clouds: 1, sky: ["#e9edef", 0.7], sun: 0.3 } as const;
    case "drizzle": return { ground: [0x22303c, 0.08], clouds: 0, sky: ["#a3b0bc", 0.5], sun: 0.3 } as const;
    case "rain": return { ground: [0x22303c, 0.07 + 0.04 * lv], clouds: 0, sky: ["#8e9dab", 0.55 + 0.05 * lv], sun: 0.2 } as const;
    case "storm": return { ground: [0x1c2834, 0.2], clouds: 0, sky: ["#6c7684", 0.75], sun: 0.1 } as const;
    case "snow": return { ground: [0xffffff, season === "winter" ? 0.04 : 0.08 * lv], clouds: 0, sky: ["#e3eaee", 0.6], sun: 0.4 } as const;
  }
}

export interface LifeOpts {
  topCover?: () => number;                       // 화면 위쪽을 가리는 HTML(멤버 보드) 높이를 월드 단위로
  map?: Phaser.Tilemaps.Tilemap;                 // 창문(창밖 하늘 색·유리에 맺히는 빗방울)
  sun?: Phaser.GameObjects.Graphics | null;      // 창으로 드는 햇살 (흐리거나 비 오면 약하게)
}

export function addOutdoorLife(scene: Phaser.Scene, geo: OutdoorGeo, season: Season, opts: LifeOpts = {}) {
  ensure(scene);
  const cam = scene.cameras.main, R = Math.random, topCover = opts.topCover ?? (() => 0);

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

  // 빗줄기·눈송이·물결은 많이 생겼다 사라지므로 이미지를 버리지 않고 다시 씀
  const pool: Phaser.GameObjects.Image[] = [];
  const take = (x: number, y: number, key: string, depth: number) => {
    const img = pool.pop();
    return img ? img.setTexture(key).setPosition(x, y).setDepth(depth).setVisible(true).setAlpha(1).setScale(1).setAngle(0) : scene.add.image(x, y, key).setDepth(depth);
  };
  const give = (img: Phaser.GameObjects.Image) => { img.setVisible(false); pool.push(img); };

  // ── 땅 덮개: 젖은 땅(어둡게) · 쌓이는 눈(하얗게) · 안개 · 흐린 날 — 바깥 그림 위, 건물 아래 ──
  const M = OUT_MARGIN;
  const ground = scene.add.rectangle(-M, -M, geo.W + 2 * M, geo.H + 2 * M, 0x000000, 1).setOrigin(0).setDepth(BELOW_BUILDING - 0.9).setAlpha(0);
  let groundColor = 0;
  // ── 흩날리는 것들 (꽃잎·낙엽·눈) ──
  type P = { img: Phaser.GameObjects.Image; x: number; y: number; h: number; vx: number; vf: number; ph: number; landed: number; spin: boolean; sway: number };
  const ps: P[] = [];
  let fallT = 0;
  // ── 비 ──
  type Drop = { img: Phaser.GameObjects.Image; x: number; y: number; h: number; vy: number; slope: number };
  const drops: Drop[] = [];
  type Fx = { img: Phaser.GameObjects.Image; t: number; life: number; grow: number };
  const fx: Fx[] = [];   // 튀는 물 · 웅덩이 물결
  type Puddle = { img: Phaser.GameObjects.Image; a: number; nextRipple: number };
  let puddles: Puddle[] = [];
  let rainAcc = 0, wetFor = 0, dryFor = 0, stormT = 8 + R() * 10;
  // ── 구름 그림자 3개 (천천히 동쪽으로) ──
  const clouds = [0, 1, 2].map(i => ({ img: scene.add.image(0, 0, "cloud-shadow").setDepth(BELOW_BUILDING - 0.5).setAlpha(0).setScale(1 + i * 0.45, 1 + i * 0.3), base: 0.1 + 0.03 * i, v: 4 + i * 1.6, placed: false, a: 0 }));
  // ── 새 떼 / 차 ──
  type Bird = { img: Phaser.GameObjects.Image; x: number; y: number; vx: number; ph: number };
  let birds: Bird[] = [], nextBirds = 6 + R() * 14;
  type Car = { img: Phaser.GameObjects.Image; x: number; vx: number };
  let cars: Car[] = [], nextCar = 1 + R() * 3;
  // ── 창문: 창밖 하늘 색 + 유리에 맺혀 흐르는 빗방울 / 눈송이 ──
  const wins: { x: number; y: number }[] = [];
  opts.map?.getLayer("walls")?.data.forEach(row => row.forEach(t => { if (t.index === G.WINDOW) wins.push({ x: t.pixelX + 2, y: t.pixelY + 2 }); }));
  const winG = wins.length ? scene.add.graphics().setDepth(1.5) : null;
  const winDrops = wins.map(() => [0, 1, 2].map(() => ({ dx: 1 + Math.floor(R() * 11), ph: R() * 11, v: 6 + R() * 10 })));
  let winT = 0, winKey = "";
  let sunA = 1, sunT = 60, t = 0;

  const tick = (_: number, dms: number) => {
    const dt = Math.min(0.1, dms / 1000); t += dt;
    const v = cam.worldView;
    if (!v.width) return;
    const rs = outRects(), outArea = area(rs), scale = Math.min(1.5, Math.max(0.25, outArea / 120000));
    const w = weatherNow(), L = look(w, season);
    const raining = !!w && (w.kind === "rain" || w.kind === "drizzle" || w.kind === "storm"), snowing = w?.kind === "snow";
    const ease = Math.min(1, dt / 6);   // 날씨가 바뀌면 몇 초에 걸쳐 서서히

    // 땅 덮개
    if (L.ground[0] !== groundColor && ground.alpha < 0.01) { groundColor = L.ground[0]; ground.setFillStyle(groundColor, 1); }
    const gTarget = L.ground[0] === groundColor ? L.ground[1] : 0;   // 색이 바뀌면 먼저 걷히고 나서 새 색으로
    ground.setAlpha(ground.alpha + (gTarget - ground.alpha) * ease);

    // 흩날리는 것: 진짜 눈 > (비 안 올 때) 계절 풍경. 날씨를 아는 겨울엔 진짜로 올 때만 눈
    const fall = snowing ? SNOW(Math.max(1, w!.level)) : raining || w?.kind === "storm" ? null : (w && season === "winter") ? null : SEASON_FALL[season];
    if (fall && rs.length) {
      fallT -= dt;
      if (fallT <= 0 && ps.length < fall.max) {
        fallT = (fall.every / scale) * (0.6 + R() * 0.8);
        const at = randomOut(rs);
        if (at) {
          const img = take(at.x, at.y, fall.keys[Math.floor(R() * fall.keys.length)], BELOW_BUILDING);
          ps.push({ img, x: at.x, y: at.y, h: 26 + R() * 40, vx: 5 + R() * 9, vf: fall.fall[0] + R() * (fall.fall[1] - fall.fall[0]), ph: R() * 6.28, landed: 0, spin: fall.spin, sway: fall.sway });
        }
      }
    }
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      if (p.h > 0) {
        p.h -= p.vf * dt; p.x += p.vx * dt;
        p.img.setPosition(Math.round(p.x + Math.sin(t * 2.2 + p.ph) * p.sway), Math.round(p.y - Math.max(0, p.h)));
        if (p.spin) p.img.setAngle(Math.sin(t * 5 + p.ph) > 0 ? 0 : 90);   // 빙글빙글
      } else {
        p.landed += dt;   // 땅에 내려앉았다가 서서히 사라짐
        if (p.landed > 2.5) p.img.setAlpha(Math.max(0, 1 - (p.landed - 2.5) / 1.5));
        if (p.landed > 4) { give(p.img); ps.splice(i, 1); }
      }
    }

    // 비: 빗줄기가 바람 따라 비스듬히 떨어져 땅에서 톡 튐
    if (raining && rs.length) {
      const r = RAIN(w!), slope = Math.min(0.35, Math.max(0.06, (w!.wind ?? 3) * 0.03)), every = r.every / scale;
      rainAcc = Math.min(rainAcc + dt, every * 40);
      while (rainAcc >= every && drops.length < r.max * scale) {
        rainAcc -= every;
        const at = randomOut(rs); if (!at) break;
        const key = r.key || (R() < 0.6 ? "rain-0" : "rain-1");
        drops.push({ img: take(at.x, at.y, key, BELOW_BUILDING + 0.1), x: at.x, y: at.y, h: 60 + R() * 80, vy: r.vy[0] + R() * (r.vy[1] - r.vy[0]), slope });
      }
    }
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.h -= d.vy * dt;
      if (d.h <= 0) {
        if (R() < 0.35) fx.push({ img: take(Math.round(d.x), Math.round(d.y), "splash", BELOW_BUILDING + 0.1), t: 0, life: 0.2, grow: 1.6 });
        give(d.img); drops.splice(i, 1); continue;
      }
      d.img.setPosition(Math.round(d.x - d.h * d.slope), Math.round(d.y - d.h));
    }
    // 웅덩이: 비가 한동안 오면 하나둘 생기고 물결이 퍼짐, 그치고 한참 지나면 마름
    if (raining) { wetFor += dt; dryFor = 0; } else { dryFor += dt; if (dryFor > 30) wetFor = 0; }
    const wantPuddles = raining && wetFor > 40 ? Math.round((4 + 3 * Math.min(3, w!.kind === "storm" ? 3 : w!.level)) * Math.min(1, scale * 1.5)) : 0;
    if (puddles.length < wantPuddles && R() < dt * 0.5) {
      const at = randomOut(rs);
      if (at) puddles.push({ img: scene.add.image(Math.round(at.x), Math.round(at.y), "puddle").setDepth(BELOW_BUILDING - 0.7).setAlpha(0).setScale(0.8 + R() * 0.6, 1), a: 0, nextRipple: 1 });
    }
    for (const pd of puddles) {
      const target = dryFor > 120 ? 0 : 0.55;
      pd.a += (target - pd.a) * Math.min(1, dt / (target ? 12 : 40));
      pd.img.setAlpha(pd.a);
      pd.nextRipple -= dt;
      if (raining && pd.nextRipple <= 0 && pd.a > 0.2) {
        pd.nextRipple = 0.5 + R() * 1.2;
        fx.push({ img: take(pd.img.x + (R() - 0.5) * 10 * pd.img.scaleX, pd.img.y + (R() - 0.5) * 2, "ripple", BELOW_BUILDING - 0.6).setScale(0.4), t: 0, life: 0.6, grow: 1.3 });
      }
    }
    if (puddles.some(pd => dryFor > 120 && pd.a < 0.02)) { puddles.filter(pd => pd.a < 0.02).forEach(pd => pd.img.destroy()); puddles = puddles.filter(pd => pd.a >= 0.02); }
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i]; f.t += dt;
      const k = f.t / f.life;
      if (k >= 1) { give(f.img); fx.splice(i, 1); continue; }
      f.img.setAlpha(0.85 * (1 - k)).setScale((f.img.texture.key === "ripple" ? 0.4 : 1) + f.grow * k, f.img.texture.key === "ripple" ? 0.4 + f.grow * k : 1);
    }

    // 구름 그림자 (흐림·비 오는 날엔 하늘이 다 덮여서 그림자 대신 땅이 전체로 어두워짐) / 안개 날엔 하얀 안개 덩어리
    const fog = w?.kind === "fog";
    for (const c of clouds) {
      const key = fog ? "fog-blob" : "cloud-shadow";
      if (c.img.texture.key !== key) c.img.setTexture(key);
      const target = fog ? 0.32 : c.base * L.clouds;
      c.a += (target - c.a) * ease; c.img.setAlpha(c.a);
      const cw = c.img.displayWidth, ch = c.img.displayHeight;
      if (!c.placed) { c.img.setPosition(v.x + R() * v.width, v.y + R() * v.height); c.placed = true; }
      c.img.x += c.v * dt;
      if (c.img.x - cw / 2 > v.right + 10) c.img.setPosition(v.x - cw / 2 - R() * 160, v.y + ch / 2 + R() * Math.max(1, v.height - ch));
    }

    // 새 떼: 날씨 좋을 때 20~50초마다 3~5마리가 V 모양으로 화면을 가로질러 감
    nextBirds -= dt;
    if (nextBirds <= 0 && !birds.length) {
      nextBirds = 20 + R() * 30;
      if (!raining && !snowing && !fog) {
        const dir = R() < 0.5 ? 1 : -1, n = 3 + Math.floor(R() * 3), y0 = v.y + topCover() + v.height * (0.1 + R() * 0.45), vx = dir * (48 + R() * 16);
        for (let k = 0; k < n; k++) {
          const side = k % 2 ? 1 : -1, rank = Math.ceil(k / 2);
          const x = (dir > 0 ? v.x - 20 : v.right + 20) - dir * rank * 8;
          birds.push({ img: scene.add.image(x, y0 + side * rank * 5, "bird-0").setDepth(BIRD_DEPTH).setAlpha(0.85), x, y: y0 + side * rank * 5, vx, ph: R() * 6.28 });
        }
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

    // 뇌우: 가끔 번개
    if (w?.kind === "storm") { stormT -= dt; if (stormT <= 0) { stormT = 12 + R() * 25; lightning(); } }

    // 창으로 드는 햇살: 날씨 따라 세기, 1분마다 시각 따라 색과 기울기
    if (opts.sun) {
      sunA += (L.sun - sunA) * ease; opts.sun.setAlpha(sunA);
      sunT -= dt; if (sunT <= 0 && opts.map) { sunT = 60; drawSun(opts.sun, opts.map); }
    }

    // 창문: 0.12초마다 다시 그림 (맑으면 원래 그림 그대로)
    winT -= dt;
    if (winG && winT <= 0) {
      winT = 0.12;
      const [col, a] = L.sky, key = `${col}|${a}|${raining}|${snowing}`;
      if (!col) { if (winKey !== key) winG.clear(); winKey = key; }
      else {
        winKey = key; winG.clear();
        const c = Phaser.Display.Color.HexStringToColor(col).color;
        wins.forEach((p, i) => {
          winG.fillStyle(c, a).fillRect(p.x, p.y, 12, 11);
          if (raining || snowing) for (const d of winDrops[i]) {
            const yy = (d.ph + t * (snowing ? d.v * 0.4 : d.v)) % 11;
            winG.fillStyle(snowing ? 0xffffff : 0xe6f2fb, 0.9).fillRect(p.x + d.dx, p.y + Math.floor(yy), 1, snowing ? 1 : 2);
          }
          winG.fillStyle(0x6e5440, 1).fillRect(p.x + 6, p.y - 1, 1, 13);   // 창살은 그대로 보이게
        });
      }
    }
  };
  scene.events.on("update", tick);
  scene.events.once("shutdown", () => scene.events.off("update", tick));
}
