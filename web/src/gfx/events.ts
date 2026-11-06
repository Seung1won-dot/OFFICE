// 날짜 따라 잠깐 놓이는 행사 소품 (1층): 빼빼로데이 · 할로윈 · 크리스마스 · 새해 · 설날 · 벚꽃 피크닉 · 추석.
// 탕비실 벽에 작은 현수막, 리셉션·책상·정원에 소품. ?event=christmas 처럼 붙이면 미리보기.
import Phaser from "phaser";
import { TILE } from "../map/defaultMap";
import { MAP_FONT } from "../ui/font";
import { DEPTH } from "./ambience";
import { OutdoorGeo } from "./outdoor";

type Room = { key: string; x: number; y: number; w: number; h: number };
type Poi = { name: string; kind: string; tx: number; ty: number; dir: string; pose: string };
export type EventKey = "pepero" | "halloween" | "christmas" | "newyear" | "seollal" | "cherry" | "chuseok";

// 음력 명절 (양력 날짜, 앞뒤 하루 포함)
const SEOLLAL = ["2026-02-17", "2027-02-07", "2028-01-27", "2029-02-13", "2030-02-03"];
const CHUSEOK = ["2026-09-25", "2027-09-15", "2028-10-03", "2029-09-22", "2030-09-12"];

export function eventNow(d = new Date()): EventKey | null {
  try { const q = new URLSearchParams(location.search).get("event"); if (q) return q as EventKey; } catch { /* */ }
  const m = d.getMonth() + 1, day = d.getDate();
  const near = (list: string[]) => list.some(s => Math.abs(new Date(s + "T12:00:00").getTime() - new Date(d.getFullYear(), m - 1, day, 12).getTime()) <= 864e5 * 1.01);
  if (near(SEOLLAL)) return "seollal";
  if (near(CHUSEOK)) return "chuseok";
  if ((m === 12 && day >= 30) || (m === 1 && day <= 2)) return "newyear";
  if (m === 12 && day <= 26) return "christmas";
  if (m === 11 && day >= 9 && day <= 12) return "pepero";
  if (m === 10 && day >= 25) return "halloween";
  if (m === 4 && day <= 14) return "cherry";
  return null;
}

const BANNER: Record<EventKey, string> = {
  pepero: "🍫 11월 11일 빼빼로데이", halloween: "🎃 Happy Halloween", christmas: "🎄 Merry Christmas",
  newyear: "🎍 새해 복 많이 받으세요", seollal: "🧧 설날 · 새해 복 많이 받으세요", cherry: "🌸 벚꽃 피크닉 주간", chuseok: "🌕 풍성한 한가위",
};

export function addEventProps(scene: Phaser.Scene, o: { rooms: Room[]; pois: Poi[]; geo: OutdoorGeo }) {
  const ev = eventNow();
  if (!ev || !BANNER[ev]) return;
  const room = (k: string) => o.rooms.find(r => r.key === k);
  const cafe = room("cafe"), lobby = room("lobby");
  const hex = (c: string) => Phaser.Display.Color.HexStringToColor(c).color;
  const g = (y: number) => scene.add.graphics().setDepth(10 + y);   // 바닥 소품은 캐릭터와 앞뒤가 맞게
  const px = (gr: Phaser.GameObjects.Graphics, x: number, y: number, c: string, w = 1, h = 1) => gr.fillStyle(hex(c), 1).fillRect(Math.round(x), Math.round(y), w, h);

  // 현수막: 탕비실 벽 가운데
  if (cafe) {
    const t = scene.add.text(cafe.x + cafe.w / 2 + 20, cafe.y + 3, BANNER[ev], { fontFamily: MAP_FONT, fontSize: "7px", color: "#2a1d1c", backgroundColor: "#fff3e6", padding: { x: 4, y: 1 } })
      .setOrigin(0.5, 0).setResolution(4).setDepth(DEPTH.sign + 1);
    const b = scene.add.graphics().setDepth(DEPTH.sign);
    b.lineStyle(1, 0xe8875a, 1).strokeRect(t.x - t.width / 2 - 0.5, t.y - 0.5, t.width + 1, t.height + 1);
    for (const sx of [t.x - t.width / 2 - 3, t.x + t.width / 2 + 2]) px(b, sx, t.y - 2, "#8a6a4a", 1, t.height + 3);   // 줄
  }

  const pumpkin = (x: number, y: number) => {
    const gr = g(y);
    px(gr, x + 1, y - 7, "#2a1d1c", 8, 7); px(gr, x, y - 6, "#2a1d1c", 10, 5);
    px(gr, x + 1, y - 6, "#f08a2c", 8, 5); px(gr, x + 2, y - 7, "#f8a64a", 6, 1); px(gr, x + 4, y - 9, "#4f7f43", 2, 2);
    px(gr, x + 2, y - 5, "#4a2a10", 2, 1); px(gr, x + 6, y - 5, "#4a2a10", 2, 1); px(gr, x + 3, y - 3, "#4a2a10", 4, 1);
  };
  const pouch = (x: number, y: number, c: string) => {
    const gr = g(y);
    px(gr, x + 2, y - 9, "#2a1d1c", 4, 2); px(gr, x, y - 7, "#2a1d1c", 8, 7);
    px(gr, x + 1, y - 6, c, 6, 5); px(gr, x + 3, y - 8, "#ffd166", 2, 1); px(gr, x + 2, y - 4, "#ffd166", 4, 1);
  };

  if (ev === "pepero") {   // 책상마다 빼빼로 상자 (절반쯤)
    for (const p of o.pois) {
      if (!/desk|seat_dev/.test(p.kind) || p.pose !== "sit" || (p.tx * 7 + p.ty * 3) % 2) continue;
      const dy = p.dir === "up" ? -1 : 1, x = p.tx * TILE + 10, y = (p.ty + dy) * TILE + (dy < 0 ? 9 : 5);
      const gr = scene.add.graphics().setDepth(DEPTH.props + 1);
      px(gr, x, y, "#2a1d1c", 5, 6); px(gr, x + 1, y + 1, "#d8343a", 3, 4); px(gr, x + 1, y + 2, "#ffffff", 3, 1);
      px(gr, x + 1, y - 2, "#6b3a1e", 1, 2); px(gr, x + 3, y - 2, "#6b3a1e", 1, 2);   // 삐져나온 과자
    }
  }
  if (ev === "halloween") {
    if (lobby) { pumpkin(lobby.x + 40, lobby.y + 46); pumpkin(lobby.x + lobby.w - 20, lobby.y + lobby.h - 8); }
    if (cafe) pumpkin(cafe.x + 10, cafe.y + cafe.h - 6);
  }
  if (ev === "christmas" && lobby) {   // 리셉션 트리 + 반짝이는 전구
    const x = lobby.x + 4, base = lobby.y + 68, gr = g(base);   // 왼쪽 캐비닛과 소파 사이
    px(gr, x + 7, base - 4, "#6b4a32", 3, 4);
    [[0, 18, 6], [3, 12, 12], [6, 6, 18]].forEach(([w0, y0, half]) => {
      for (let r = 0; r < 7; r++) { const hw = Math.round(half / 2 - (6 - r) * half / 16); px(gr, x + 8 - hw, base - 4 - y0 - 7 + r + w0 * 0, r === 6 ? "#2f6a3a" : "#3f8a48", hw * 2 + 1, 1); }
    });
    px(gr, x + 7, base - 34, "#ffd166", 3, 3); px(gr, x + 8, base - 35, "#fff2c2");
    const lights = scene.add.graphics().setDepth(10 + base + 0.1);
    const spots = [[4, -12], [12, -14], [6, -20], [11, -22], [8, -27], [3, -8], [13, -9]];
    const LC = ["#ff6b6b", "#ffd166", "#7fd1ff", "#a8e07c", "#f29ab8"];
    let k = 0;
    scene.time.addEvent({ delay: 500, loop: true, callback: () => { lights.clear(); k++; spots.forEach(([dx, dy], i) => px(lights, x + dx, base + dy, LC[(i + k) % LC.length])); } });
    for (let i = 0; i < 3; i++) { const bx = x + 2 + i * 6, gr2 = g(base + 1); px(gr2, bx, base - 4, ["#d8343a", "#5aa0e6", "#f2c84b"][i], 5, 4); px(gr2, bx + 2, base - 4, "#ffffff", 1, 4); }   // 선물 상자
  }
  if (ev === "seollal" || ev === "newyear") {
    if (lobby) { pouch(lobby.x + 36, lobby.y + 50, "#d8343a"); pouch(lobby.x + 48, lobby.y + 50, "#5aa0e6"); pouch(lobby.x + 60, lobby.y + 50, "#f29ab8"); }
  }
  if (ev === "chuseok" && cafe) {   // 탕비실 테이블마다 송편 접시
    for (const p of o.pois.filter(q => q.kind === "cafe_seat" && q.dir === "up")) {
      const x = p.tx * TILE + 4, y = (p.ty - 1) * TILE + 8, gr = scene.add.graphics().setDepth(DEPTH.props + 1);
      px(gr, x - 1, y + 2, "#ffffff", 9, 2); ["#ffffff", "#a8e07c", "#f6b6c9", "#ffffff"].forEach((c, i) => px(gr, x + i * 2, y, c, 2, 2));
    }
  }
  if (ev === "cherry") {   // 정원 벤치 사이 돗자리 + 바구니
    const bench = o.geo.benches.filter(b => b.side === "bottom" && b.x > 0 && b.x < o.geo.W);
    for (let i = 0; i + 1 < bench.length; i += 2) {
      const x = (bench[i].x + bench[i + 1].x) / 2 + 6, y = bench[i].y + 14, gr = scene.add.graphics().setDepth(-98);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) px(gr, x + c * 3, y + r * 3, (r + c) % 2 ? "#ffffff" : "#e8574a", 3, 3);
      px(gr, x + 26, y + 2, "#8a5a3a", 6, 5); px(gr, x + 27, y, "#6b4430", 4, 2); px(gr, x + 27, y + 2, "#f6b6c9", 2, 2);
    }
  }
}
