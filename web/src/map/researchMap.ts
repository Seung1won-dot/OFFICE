// B1 연구실 층 맵 (1층과 같은 Tiled JSON 구조·타일셋 재사용)
// 위: 라운지(엘리베이터·주간 로그 게시판) / 아래: 프로젝트마다 방 하나 (한 줄에 3개)
import { G, TILE, TiledObject, BLOCKING, autotileWalls, tilesetJson } from "./defaultMap";

export const RW = 48;
const ROOM_W = 16, ROOM_H = 9, PER_ROW = 3, LOUNGE_H = 7;

export function buildResearchMap(count: number) {
  const n = Math.max(1, count), rows = Math.ceil(n / PER_ROW);
  const MH = LOUNGE_H + rows * ROOM_H + 1, N = RW * MH;
  const floor = new Array<number>(N).fill(0), walls = new Array<number>(N).fill(G.CAP);
  const furn = new Array<number>(N).fill(0), top = new Array<number>(N).fill(0);
  const idx = (x: number, y: number) => y * RW + x;
  const objects: TiledObject[] = [], rooms: TiledObject[] = [];
  let oid = 1;
  const carve = (x0: number, y0: number, x1: number, y1: number, gid: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { floor[idx(x, y)] = gid; walls[idx(x, y)] = 0; }
  };
  const face = (x0: number, x1: number, y: number) => { for (let x = x0; x <= x1; x++) walls[idx(x, y)] = G.FACE; };
  const put = (x: number, y: number, gid: number) => { furn[idx(x, y)] = gid; };
  const plant = (x: number, y: number) => { put(x, y, G.PLANT); top[idx(x, y - 1)] = G.PLANT_TOP; };
  const poi = (name: string, x: number, y: number, dir: string, pose: string) =>
    objects.push({ id: oid++, name, type: "poi", x: x * TILE, y: y * TILE, width: TILE, height: TILE,
      properties: [{ name: "dir", type: "string", value: dir }, { name: "pose", type: "string", value: pose }] });
  const room = (key: string, label: string, x0: number, y0: number, x1: number, y1: number) =>
    rooms.push({ id: oid++, name: key, type: "room", x: x0 * TILE, y: y0 * TILE, width: (x1 - x0 + 1) * TILE, height: (y1 - y0 + 1) * TILE,
      properties: [{ name: "label", type: "string", value: label }] });

  // ── 라운지 ──
  carve(1, 1, RW - 2, LOUNGE_H - 1, G.WOOD);   // 라운지: 따뜻한 나무 바닥 face(1, RW - 2, 1); room("lounge", "B1 연구실 라운지", 1, 1, RW - 2, LOUNGE_H - 1);
  walls[idx(3, 1)] = G.ELEVATOR; walls[idx(4, 1)] = G.ELEVATOR;
  for (const x of [8, 12, 16, 20, 34, 38, 42]) walls[idx(x, 1)] = G.WINDOW;   // 창 많이 → 볕 잘 드는 라운지
  for (let x = 27; x <= 30; x++) put(x, 2, G.STANDBOARD);          // 주간 로그 게시판 (글씨는 씬이 얹음)
  put(8, 4, G.SOFA); put(9, 4, G.SOFA); put(44, 4, G.COFFEE);
  plant(1, 3); plant(RW - 2, 3); plant(16, 5); plant(38, 5); plant(22, 5); plant(33, 3); plant(6, 5);

  // ── 프로젝트 방 ──
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / PER_ROW), c = i % PER_ROW;
    const x0 = c * ROOM_W + 1, x1 = Math.min(x0 + ROOM_W - 2, RW - 2), y0 = LOUNGE_H + r * ROOM_H;   // y0 = 위벽
    carve(x0, y0 + 1, x1, y0 + ROOM_H - 1, [G.CAFE, G.BEIGE, G.LOBBY][i % 3]);   // 방마다 밝은 바닥 face(x0, x1, y0 + 1);
    room(`lab_${i}`, "", x0, y0 + 1, x1, y0 + ROOM_H - 1);
    // 문 (라운지/위 방과 연결된 느낌만)
    for (const dx of [6, 7]) { walls[idx(x0 + dx, y0)] = 0; walls[idx(x0 + dx, y0 + 1)] = 0; floor[idx(x0 + dx, y0)] = G.DOOR; floor[idx(x0 + dx, y0 + 1)] = G.DOOR_FACE; }
    walls[idx(x0 + 2, y0 + 1)] = G.WINDOW; walls[idx(x0 + 4, y0 + 1)] = G.WINDOW; walls[idx(x0 + 11, y0 + 1)] = G.WHITEBOARD; walls[idx(x0 + 14, y0 + 1)] = G.WINDOW;
    // 책장 · 책상 · 소파 · 트로피 · 화분
    for (const dx of [0, 1, 2]) { put(x0 + dx, y0 + 2, G.SHELF); }
    put(x0 + 7, y0 + 5, G.DESK_UP); put(x0 + 8, y0 + 5, G.DESK_UP);
    put(x0 + 7, y0 + 6, G.CHAIR_UP); poi(`lab_seat_${i}`, x0 + 7, y0 + 6, "up", "sit");
    put(x0 + 11, y0 + 7, G.SOFA); put(x0 + 12, y0 + 7, G.SOFA); poi(`lab_sofa_${i}`, x0 + 11, y0 + 7, "down", "lie");
    put(x0 + 12, y0 + 3, G.TROPHY); poi(`lab_trophy_${i}`, x0 + 11, y0 + 4, "right", "stand");
    plant(x0, y0 + 7); plant(x0 + 14, y0 + 4); put(x0 + 3, y0 + 7, G.LAMP);
  }
  const collision = new Array<number>(N).fill(0);
  for (let i = 0; i < N; i++) if (walls[i] || BLOCKING.has(furn[i])) collision[i] = 1;
  const layer = (id: number, name: string, data: number[], visible = true) => ({ id, name, type: "tilelayer", width: RW, height: MH, x: 0, y: 0, opacity: 1, visible, data });
  const wallsTiled = autotileWalls(walls, RW, MH);
  return {
    type: "map", version: "1.10", orientation: "orthogonal", renderorder: "right-down", width: RW, height: MH, tilewidth: TILE, tileheight: TILE, infinite: false,
    layers: [layer(1, "floor", floor), layer(2, "walls", wallsTiled), layer(3, "furniture", furn), layer(4, "furniture-top", top), layer(5, "collision", collision, false),
      { id: 6, name: "objects", type: "objectgroup", visible: true, opacity: 1, x: 0, y: 0, draworder: "topdown", objects },
      { id: 7, name: "rooms", type: "objectgroup", visible: true, opacity: 1, x: 0, y: 0, draworder: "topdown", objects: rooms }],
    tilesets: [tilesetJson()],
  };
}
