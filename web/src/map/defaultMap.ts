// 코드로 생성하는 기본 맵 (Tiled .tmj 와 같은 JSON 구조)
// 레이어: floor / walls / furniture / furniture-top / collision + objectgroup(objects, rooms)
// Tiled 로 만든 public/maps/office.tmj 가 있으면 그걸 우선 사용하고, 없으면 이 맵을 쓴다.
//
// ┌────────┬────────┬────────┬────────┬────────┐
// │대표실/  │ 유리    │ 자료실  │ 서버실  │ 수면실  │
// │결재대기 │ 회의실  │(책장 벽)│        │        │
// ├────────┴────────┴────────┴────────┴────────┤
// │ [개발팀 섬]        [GitHub 개발본부 섬]       │
// │ [기획팀 섬]  [연구팀 섬]      화이트보드(스탠드업) │
// ├──────────────┬──────────────┬──────────────┤
// │ 리셉션/입구   │ 탕비실·카페   │ 서류 캐비닛    │
// └──────────────┴──────────────┴──────────────┘
export const TILE = 16;
export const MW = 48;
export const MH = 32;

// 생성 타일셋의 GID (tileset.ts 가 같은 순서로 그림)
export const G = {
  WOOD: 1, CARPET: 2, GRID: 3, GREEN: 4, PURPLE: 5, BEIGE: 6, CAFE: 7, NAP: 8, LOBBY: 9, OFFICE: 10,
  CAP: 11, FACE: 12, WINDOW: 13,
  DESK: 14, CHAIR: 15, SHELF: 16, RACK: 17, PLANT: 18, SOFA: 19, BED_TOP: 20, BED_BOT: 21,
  CAFE_TABLE: 22, COFFEE: 23, WHITEBOARD: 24, BENCH: 25, GLOBE: 26, MAT: 27, CABINET: 28,
  MTABLE: 29, BOSSDOOR: 30, CLOCK: 31, LAMP: 32, RACK_TOP: 33, SHELF_TOP: 34, LAPTOP_DESK: 35, PLANT_TOP: 36,
  GLASS: 37, COUNTER: 38, STANDBOARD: 39, TEAL: 40, DESK_UP: 41, CHAIR_UP: 42,
  LAB: 43, TROPHY: 44, ELEVATOR: 45,
} as const;
export const TILE_COUNT = 45;

// 길을 막는 가구 (좌석·벤치·침대 머리·의자는 POI 라서 통과 가능)
const BLOCKING = new Set<number>([G.DESK, G.DESK_UP, G.SHELF, G.RACK, G.PLANT, G.CAFE_TABLE, G.COFFEE, G.GLOBE, G.CABINET,
  G.MTABLE, G.BED_BOT, G.LAPTOP_DESK, G.LAMP, G.COUNTER, G.STANDBOARD, G.TROPHY]);
export { BLOCKING };

interface Prop { name: string; type: string; value: string | number | boolean }
export interface TiledObject { id: number; name: string; type: string; x: number; y: number; width: number; height: number; properties?: Prop[] }

export function buildDefaultMap() {
  const N = MW * MH;
  const floor = new Array<number>(N).fill(0);
  const walls = new Array<number>(N).fill(G.CAP);   // 전부 벽으로 시작해서 방을 파낸다
  const furn = new Array<number>(N).fill(0);
  const top = new Array<number>(N).fill(0);
  const idx = (x: number, y: number) => y * MW + x;
  const objects: TiledObject[] = [];
  const rooms: TiledObject[] = [];
  let oid = 1;

  const carve = (x0: number, y0: number, x1: number, y1: number, gid: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { floor[idx(x, y)] = gid; walls[idx(x, y)] = 0; }
  };
  const paint = (x0: number, y0: number, x1: number, y1: number, gid: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) floor[idx(x, y)] = gid;
  };
  const face = (x0: number, x1: number, y: number, gid: number = G.FACE) => { for (let x = x0; x <= x1; x++) walls[idx(x, y)] = gid; };
  const setWall = (x: number, y: number, gid: number) => { walls[idx(x, y)] = gid; };
  const put = (x: number, y: number, gid: number) => { furn[idx(x, y)] = gid; };
  const putTop = (x: number, y: number, gid: number) => { top[idx(x, y)] = gid; };
  const plant = (x: number, y: number) => { put(x, y, G.PLANT); putTop(x, y - 1, G.PLANT_TOP); };
  const poi = (name: string, x: number, y: number, dir = "down", pose = "stand") => {
    objects.push({ id: oid++, name, type: "poi", x: x * TILE, y: y * TILE, width: TILE, height: TILE,
      properties: [{ name: "dir", type: "string", value: dir }, { name: "pose", type: "string", value: pose }] });
  };
  const room = (key: string, label: string, x0: number, y0: number, x1: number, y1: number) => {
    rooms.push({ id: oid++, name: key, type: "room", x: x0 * TILE, y: y0 * TILE, width: (x1 - x0 + 1) * TILE, height: (y1 - y0 + 1) * TILE,
      properties: [{ name: "label", type: "string", value: label }] });
  };
  const door = (x: number, rows: number[]) => { for (const y of rows) for (const dx of [0, 1]) { walls[idx(x + dx, y)] = 0; floor[idx(x + dx, y)] = G.MAT; } };
  /** 마주보는 책상 섬: 위 줄 책상(y)·아래 줄 책상(y+1), 좌석은 y-1(아래를 봄)과 y+2(위를 봄) */
  const island = (prefix: string, xs: number[], y: number, deskTop: number = G.DESK, start = 1) => {
    let n = start;
    for (const x of xs) { put(x, y, deskTop); put(x, y - 1, G.CHAIR); poi(`${prefix}_${n++}`, x, y - 1, "down", "sit"); }
    for (const x of xs) { put(x, y + 1, G.DESK_UP); put(x, y + 2, G.CHAIR_UP); poi(`${prefix}_${n++}`, x, y + 2, "up", "sit"); }
    return n;
  };

  // ── 위쪽 방 5개 (0행 벽, 1행 뒷벽, 2~7행 바닥, 8행 아래벽에 문) ──
  const TOP = [
    { k: "ceo", n: "대표실·결재대기", x0: 1, x1: 9, f: G.BEIGE },
    { k: "meet", n: "유리 회의실", x0: 11, x1: 18, f: G.PURPLE },
    { k: "lib", n: "자료실", x0: 20, x1: 28, f: G.WOOD },
    { k: "srv", n: "서버실", x0: 30, x1: 37, f: G.GRID },
    { k: "nap", n: "수면실", x0: 39, x1: 46, f: G.NAP },
  ] as const;
  for (const r of TOP) { carve(r.x0, 1, r.x1, 7, r.f); face(r.x0, r.x1, 1); room(r.k, r.n, r.x0, 1, r.x1, 7); door(r.x0 + 3, [8]); }
  // 유리 회의실: 벽이 유리
  for (let y = 0; y <= 8; y++) { if (walls[idx(10, y)]) setWall(10, y, G.GLASS); if (walls[idx(19, y)]) setWall(19, y, G.GLASS); }
  for (let x = 11; x <= 18; x++) if (walls[idx(x, 8)]) setWall(x, 8, G.GLASS);
  face(11, 18, 1, G.GLASS);
  for (let i = 0; i < N; i++) if (walls[i] === G.GLASS) floor[i] = G.PURPLE;   // 유리 너머로 바닥이 보이게

  // ── 가운데 오픈 오피스 (9~22행) ──
  carve(1, 9, 46, 22, G.OFFICE); room("floor", "오픈 오피스", 1, 9, 46, 22);
  // 섬마다 러그(바닥색)로 구역 표시
  paint(2, 10, 12, 15, G.CARPET); room("dev", "개발팀 섬", 2, 10, 12, 15);
  paint(16, 10, 45, 15, G.TEAL); room("gh", "GitHub 개발본부 섬", 16, 10, 45, 15);
  paint(2, 17, 12, 22, G.LOBBY); room("plan", "기획팀 섬 · Notion", 2, 17, 12, 22);
  paint(16, 17, 28, 22, G.GREEN); room("research", "연구팀 섬 · Obsidian", 16, 17, 28, 22);
  room("standup", "스탠드업 화이트보드", 33, 17, 44, 22);

  // ── 아래쪽 방 3개 (23행 위벽, 24행 뒷벽, 25~30 바닥, 31행 바닥벽) ──
  const BOT = [
    { k: "lobby", n: "리셉션·입구", x0: 1, x1: 14, f: G.BEIGE, d: 7 },
    { k: "cafe", n: "탕비실·카페", x0: 16, x1: 30, f: G.CAFE, d: 22 },
    { k: "archive", n: "서류 캐비닛", x0: 32, x1: 46, f: G.WOOD, d: 38 },
  ] as const;
  for (const r of BOT) { carve(r.x0, 24, r.x1, 30, r.f); face(r.x0, r.x1, 24); room(r.k, r.n, r.x0, 24, r.x1, 30); door(r.d, [23, 24]); }
  // 입구 (리셉션 왼쪽 벽)
  for (const y of [27, 28]) { walls[idx(0, y)] = 0; floor[idx(0, y)] = G.MAT; }
  poi("entrance", 1, 28, "right");

  // ── 벽 장식 ──
  setWall(3, 1, G.WINDOW); setWall(7, 1, G.BOSSDOOR);
  setWall(14, 1, G.WHITEBOARD); setWall(17, 1, G.CLOCK);
  setWall(41, 1, G.WINDOW); setWall(45, 1, G.WINDOW);
  for (const x of [4, 11]) setWall(x, 24, G.WINDOW);
  for (const x of [18, 26]) setWall(x, 24, G.WINDOW);
  setWall(35, 24, G.CLOCK);

  // ── 대표실·결재대기: 대표 책상 + 결재 대기 벤치 ──
  for (const x of [4, 5, 6]) put(x, 4, G.MTABLE);
  put(5, 3, G.CHAIR_UP);
  for (let x = 2; x <= 6; x++) { put(x, 6, G.BENCH); poi(`waiting_bench_${x - 1}`, x, 6, "up", "sit"); }
  plant(9, 3); plant(1, 3);

  // ── 유리 회의실: 가운데 테이블, 양쪽 좌석 ──
  for (let x = 13; x <= 16; x++) { put(x, 4, G.MTABLE); put(x, 5, G.MTABLE); }
  let m = 1;
  for (let x = 13; x <= 16; x++) poi(`meeting_seat_${m++}`, x, 3, "down", "sit");
  for (let x = 13; x <= 16; x++) poi(`meeting_seat_${m++}`, x, 6, "up", "sit");

  // ── 자료실: 뒷벽 전체가 책장 ──
  for (let x = 20; x <= 28; x++) { put(x, 2, G.SHELF); putTop(x, 1, G.SHELF_TOP); }
  [21, 23, 25, 27].forEach((x, i) => poi(`bookshelf_${i + 1}`, x, 3, "up"));
  put(21, 6, G.MTABLE); put(27, 6, G.MTABLE);

  // ── 서버실 ──
  [31, 33, 35, 37].forEach((x, i) => { put(x, 2, G.RACK); putTop(x, 1, G.RACK_TOP); poi(`server_rack_${i + 1}`, x, 3, "up"); });

  // ── 수면실: 캡슐 침대 + 무드등 ──
  [40, 42, 44, 46].forEach((x, i) => { put(x, 2, G.BED_TOP); put(x, 3, G.BED_BOT); poi(`bed_${i + 1}`, x, 2, "down", "lie"); });
  put(39, 7, G.LAMP);

  // ── 섬: 개발팀(Claude 세션) / GitHub 개발본부(가장 큼) / 기획팀(Notion) / 연구팀(Obsidian) ──
  island("seat_dev", [4, 6, 8, 10], 12);
  island("repo_desk", [18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42], 12);
  island("plan_desk", [4, 6, 8, 10], 19, G.LAPTOP_DESK);
  island("research_desk", [18, 20, 22, 24, 26], 19, G.LAPTOP_DESK);
  put(28, 18, G.GLOBE);
  // 스탠드업 화이트보드 (서브에이전트에게 일을 나눠줄 때)
  for (const x of [37, 38, 39, 40]) put(x, 18, G.STANDBOARD);
  [36, 37, 38, 39, 40, 41].forEach((x, i) => poi(`standup_${i + 1}`, x, 20, "up"));
  plant(14, 10); plant(14, 21); plant(46, 10); plant(31, 21); plant(46, 21);

  // ── 리셉션: 안내 데스크 + 소파 ──
  for (let x = 6; x <= 9; x++) put(x, 27, G.COUNTER);
  put(2, 25, G.SOFA); put(3, 25, G.SOFA); poi("sofa_1", 2, 25, "down", "sit"); poi("sofa_2", 3, 25, "down", "sit");
  plant(13, 26); plant(1, 30);

  // ── 탕비실·카페 ──
  put(29, 25, G.COFFEE); poi("coffee_machine", 29, 26, "up");
  for (let x = 17; x <= 20; x++) put(x, 25, G.COUNTER);
  let c = 1;
  for (const x of [19, 23, 27]) { put(x, 28, G.CAFE_TABLE); poi(`cafe_seat_${c++}`, x - 1, 28, "right", "sit"); poi(`cafe_seat_${c++}`, x + 1, 28, "left", "sit"); }
  plant(16, 30); plant(30, 30);

  // ── 서류 캐비닛 (비활성 저장소) ──
  for (let x = 33; x <= 45; x++) if (x !== 38 && x !== 39) put(x, 25, G.CABINET);
  for (let x = 33; x <= 45; x += 3) put(x, 29, G.CABINET);
  poi("archive_cabinet", 40, 27, "up");

  // ── collision ──
  const collision = new Array<number>(N).fill(0);
  for (let i = 0; i < N; i++) if (walls[i] || BLOCKING.has(furn[i])) collision[i] = 1;

  const layer = (id: number, name: string, data: number[], visible = true) =>
    ({ id, name, type: "tilelayer", width: MW, height: MH, x: 0, y: 0, opacity: 1, visible, data });
  return {
    type: "map", version: "1.10", tiledversion: "generated", orientation: "orthogonal", renderorder: "right-down",
    width: MW, height: MH, tilewidth: TILE, tileheight: TILE, infinite: false, nextlayerid: 8, nextobjectid: oid,
    layers: [
      layer(1, "floor", floor), layer(2, "walls", walls), layer(3, "furniture", furn), layer(4, "furniture-top", top),
      layer(5, "collision", collision, false),
      { id: 6, name: "objects", type: "objectgroup", visible: true, opacity: 1, x: 0, y: 0, draworder: "topdown", objects },
      { id: 7, name: "rooms", type: "objectgroup", visible: true, opacity: 1, x: 0, y: 0, draworder: "topdown", objects: rooms },
    ],
    tilesets: [{ firstgid: 1, name: "office", tilewidth: TILE, tileheight: TILE, tilecount: TILE_COUNT, columns: TILE_COUNT,
      image: "office-tiles.png", imagewidth: TILE * TILE_COUNT, imageheight: TILE, margin: 0, spacing: 0 }],
  };
}
