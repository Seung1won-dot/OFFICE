// 분위기 연출 (두 층 공용): 밤 조명 + 빛 번짐, 둥근 러그, 책상 소품, 작은 움직임들
import Phaser from "phaser";
import { MAP_FONT } from "../ui/font";
import { G, TILE } from "../map/defaultMap";
import { hash } from "./people";

export const DEPTH = { rug: 0.5, props: 3, night: 9800, glow: 9850, sign: 9900, tag: 9950, icon: 9960 };

const hex = (c: string) => Phaser.Display.Color.HexStringToColor(c).color;

/** 가운데가 밝고 가장자리로 사라지는 원형 빛 텍스처 */
export function ensureGlowTexture(scene: Phaser.Scene) {
  if (scene.textures.exists("glow")) return;
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(255,255,255,0.45)"); g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  scene.textures.addCanvas("glow", c);
}

export function glow(scene: Phaser.Scene, x: number, y: number, color: string, radius: number, alpha: number, pulse = 0) {
  const img = scene.add.image(x, y, "glow").setTint(hex(color)).setBlendMode(Phaser.BlendModes.ADD)
    .setScale(radius / 32).setAlpha(alpha).setDepth(DEPTH.glow);
  if (pulse) scene.tweens.add({ targets: img, alpha: alpha * (1 - pulse), duration: 1600 + Math.random() * 1400, yoyo: true, repeat: -1, ease: "Sine.inOut" });
  return img;
}

/** 방 전체를 은은하게 어둡게 (밤) */
export function addNight(scene: Phaser.Scene, w: number, h: number, alpha = 0.26) {
  return scene.add.rectangle(0, 0, w, h, 0x160c1e, alpha).setOrigin(0).setDepth(DEPTH.night);
}

/** 타일을 보고 조명을 자동 배치: 천장등, 창문, 스탠드, 모니터, 서버, 커피머신 */
export function lightFromMap(scene: Phaser.Scene, map: Phaser.Tilemaps.Tilemap, rooms: { key: string; x: number; y: number; w: number; h: number }[]) {
  const at = (layer: string, cb: (gid: number, x: number, y: number) => void) =>
    map.getLayer(layer)?.data.forEach((row, ty) => row.forEach((t, tx) => { if (t.index > 0) cb(t.index, tx * TILE + TILE / 2, ty * TILE + TILE / 2); }));
  void rooms;   // 낮 오피스: 천장 다운라이트 대신 창문 햇빛(addSunlight)
  at("furniture", (g, x, y) => {
    if (g === G.LAMP) glow(scene, x, y - 6, "#ffcf7a", 22, 0.25, 0.12);
    else if (g === G.RACK) glow(scene, x, y + 2, "#5fe08a", 10, 0.18, 0.5);
  });
}

/** 섬·방 바닥에 둥근 테두리 러그 */
export function addRugs(scene: Phaser.Scene, rooms: { key: string; x: number; y: number; w: number; h: number }[], colors: Record<string, string>) {
  const g = scene.add.graphics().setDepth(DEPTH.rug);
  for (const r of rooms) {
    const c = colors[r.key]; if (!c) continue;
    g.lineStyle(1, hex(c), 0.55).strokeRoundedRect(r.x + 4.5, r.y + 4.5, r.w - 9, r.h - 9, 6);
    g.lineStyle(1, hex(c), 0.18).strokeRoundedRect(r.x + 7.5, r.y + 7.5, r.w - 15, r.h - 15, 4);
  }
}

/** 책상마다 해시로 정해지는 소품 1~2개 (머그컵, 화분, 피규어, 서류, 포스트잇, 헤드폰) */
export function addDeskProps(scene: Phaser.Scene, pois: { name: string; kind: string; tx: number; ty: number; dir: string; pose: string }[], kinds: string[]) {
  const g = scene.add.graphics().setDepth(DEPTH.props);
  const r = (x: number, y: number, w: number, h: number, c: string) => g.fillStyle(hex(c), 1).fillRect(x, y, w, h);
  for (const p of pois) {
    if (!kinds.includes(p.kind) || p.pose !== "sit") continue;
    if (p.dir === "left") {   // 팀장 책상: 왼쪽 세로 책상 아래칸에 소품 하나
      const h = hash(p.name), x = (p.tx - 1) * TILE + 9, y = (p.ty + 1) * TILE + 2;
      if (h % 2) { r(x, y, 3, 3, "#f4f6f9"); r(x + 3, y + 1, 1, 1, "#f4f6f9"); r(x + 1, y, 1, 1, "#6a4528"); }
      else { r(x, y + 2, 3, 2, "#c0683f"); r(x, y, 3, 2, "#5e9a4a"); }
      continue;
    }
    const deskY = p.dir === "down" ? p.ty + 1 : p.ty - 1;
    const ox = p.tx * TILE, oy = deskY * TILE + (p.dir === "down" ? 3 : 1);
    const h = hash(p.name), side = h % 2 ? 12 : 0;
    const items = [h % 9, (h >> 3) % 9];
    items.slice(0, 1 + ((h >> 6) % 2)).forEach((it, i) => {
      const x = ox + (i ? 12 - side : side) + 1, y = oy + (i ? 4 : 1);
      switch (it) {
        case 0: r(x, y, 3, 3, "#f4f6f9"); r(x + 3, y + 1, 1, 1, "#f4f6f9"); r(x + 1, y, 1, 1, "#6a4528"); break;          // 머그컵
        case 1: r(x, y + 2, 3, 2, "#e6e8ec"); r(x, y, 3, 2, "#5aa06e"); r(x + 1, y - 1, 1, 1, "#7cc48a"); break;           // 미니 화분
        case 2: r(x + 1, y, 1, 1, "#ffd166"); r(x, y + 1, 3, 2, "#e8875a"); break;                                        // 피규어
        case 3: r(x, y, 4, 3, "#f4f6f9"); r(x + 1, y + 1, 2, 1, "#9aa0ad"); break;                                       // 서류
        case 4: r(x, y, 2, 2, "#ffd166"); r(x + 2, y + 1, 2, 2, "#f0a6a0"); break;                                       // 포스트잇
        case 5: r(x, y, 4, 1, "#2b2f3a"); r(x, y + 1, 1, 2, "#2b2f3a"); r(x + 3, y + 1, 1, 2, "#2b2f3a"); break;         // 헤드폰
        case 7: r(x, y + 1, 3, 3, "#b07a50"); r(x, y, 1, 1, "#b07a50"); r(x + 2, y, 1, 1, "#b07a50"); r(x + 1, y + 2, 1, 1, "#2a1d1c"); break;   // 곰 인형
        case 8: r(x, y + 2, 4, 2, "#f4f6f9"); r(x, y + 1, 4, 1, "#e6e2d8"); r(x + 1, y, 3, 1, "#f4f6f9"); r(x, y + 3, 4, 1, "#c9c3b6"); break;   // 서류 더미
        default: r(x, y, 3, 2, "#3d6fb0"); r(x, y + 2, 3, 1, "#c0504d"); break;                                          // 책
      }
    });
  }
}

/** 작은 움직임: 커피 김, 서버 LED 깜빡임 */
export function addLife(scene: Phaser.Scene, map: Phaser.Tilemaps.Tilemap) {
  const steam = (x: number, y: number) => {
    const s = scene.add.rectangle(x, y, 1, 2, 0xffffff, 0.5).setDepth(DEPTH.glow);
    scene.tweens.add({ targets: s, y: y - 6, alpha: 0, duration: 1800, repeat: -1, delay: Math.random() * 1800 });
  };
  const leds: Phaser.GameObjects.Rectangle[] = [];
  map.getLayer("furniture")?.data.forEach((row, ty) => row.forEach((t, tx) => {
    const x = tx * TILE, y = ty * TILE;
    if (t.index === G.COFFEE) { steam(x + 8, y + 8); steam(x + 9, y + 8); }
    if (t.index === G.CAFE_TABLE) steam(x + 10, y + 6);
    if (t.index === G.RACK) for (let l = 0; l < 4; l++) leds.push(scene.add.rectangle(x + 12.5, y + 1.5 + l * 3, 1, 1, l % 2 ? 0x5fe08a : 0x6fb0ff).setDepth(DEPTH.glow));
  }));
  scene.time.addEvent({ delay: 450, loop: true, callback: () => leds.forEach(l => l.setVisible(Math.random() > 0.3)) });
}

/** 둥근 간판: 짙은 판 + 왼쪽 팀 색 띠 */
export function sign(scene: Phaser.Scene, x: number, y: number, label: string, accent: string) {
  const t = scene.add.text(0, 0, label, { fontFamily: MAP_FONT, fontSize: "7px", color: "#f6ead2" }).setResolution(4);
  const w = Math.ceil(t.width) + 9, h = 11;
  const g = scene.add.graphics().setDepth(DEPTH.sign);
  g.fillStyle(0x000000, 0.3).fillRoundedRect(x + 1, y + 1, w, h, 3);
  g.fillStyle(0x2b2220, 0.95).fillRoundedRect(x, y, w, h, 3);
  g.fillStyle(hex(accent), 1).fillRoundedRect(x + 2, y + 3, 2, h - 6, 1);
  t.setPosition(x + 6, y + 2).setDepth(DEPTH.sign + 1);
  return { w, h };
}

/** 창문으로 들어오는 햇빛: 창 아래 바닥에 비스듬한 밝은 사다리꼴 */
export function addSunlight(scene: Phaser.Scene, map: Phaser.Tilemaps.Tilemap) {
  const g = scene.add.graphics().setDepth(DEPTH.rug + 0.1);
  const walls = map.getLayer("walls")?.data, floor = map.getLayer("floor")?.data;
  if (!walls || !floor) return;
  walls.forEach((row, ty) => row.forEach((t, tx) => {
    if (t.index !== G.WINDOW) return;
    let len = 0;   // 창 아래로 바닥이 이어지는 만큼 (최대 4칸)
    while (len < 4 && floor[ty + 1 + len]?.[tx]?.index > 0 && !(walls[ty + 1 + len]?.[tx]?.index > 0)) len++;
    if (!len) return;
    const x0 = tx * TILE + 2, y0 = (ty + 1) * TILE, y1 = y0 + len * TILE, skew = len * 4;
    g.fillStyle(0xfff3cf, 0.22).fillPoints([{ x: x0, y: y0 }, { x: x0 + 12, y: y0 }, { x: x0 + 12 + skew, y: y1 }, { x: x0 + skew, y: y1 }], true);
    g.fillStyle(0xffffff, 0.10).fillPoints([{ x: x0 + 2, y: y0 }, { x: x0 + 6, y: y0 }, { x: x0 + 6 + skew, y: y1 }, { x: x0 + 2 + skew, y: y1 }], true);
  }));
}

/** 마주 보는 책상 사이 낮은 파티션 (objects 레이어의 type=partition) */
export function addPartitions(scene: Phaser.Scene, map: Phaser.Tilemaps.Tilemap) {
  const g = scene.add.graphics().setDepth(2.5);
  for (const o of map.getObjectLayer("objects")?.objects ?? []) {
    if (o.type !== "partition") continue;
    const x = Math.round(o.x!), y = Math.round(o.y!), w = Math.round(o.width!);
    g.fillStyle(0x6e5440, 1).fillRect(x, y - 1, w, 1);                    // 위 테두리
    g.fillStyle(0xdfe8ea, 0.92).fillRect(x, y, w, 3);                     // 반투명 패널
    g.fillStyle(0xffffff, 0.6).fillRect(x, y, w, 1);
    g.fillStyle(0x8a9aa0, 1).fillRect(x, y + 3, w, 1);
    for (let px = x + 15; px < x + w; px += 16) g.fillStyle(0x6e5440, 1).fillRect(px, y - 1, 1, 5);   // 책상마다 기둥
  }
}
