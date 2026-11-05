// 코드로 생성하는 기본 맵 (Tiled .tmj 와 같은 JSON 구조)
// 레이어: floor / walls / furniture / furniture-top / collision + objectgroup(objects, rooms)
// Tiled 로 만든 public/maps/office.tmj 가 있으면 그걸 우선 사용하고, 없으면 이 맵을 쓴다. (/?export-map 으로 다시 만들 수 있음)
//
// ┌────────┬────────┬───────────────┬────────┐
// │ 생각실  │ 자료실  │ 코딩실 (가장 큼) │ 터미널실 │
// ├──── 복도 ─────────────────────────────────┤
// │ 조사실  │ 회의실  │GitHub│Notion│Obsidian│통로
// ├──── 복도 ─────────────────────────────────┤
// │ 결재대기 │ 수면실  │   탕비실      │ 리셉션  │→ 출입구
// └────────┴────────┴───────────────┴────────┘
export const TILE = 16;
export const MW = 40;
export const MH = 29;

// 생성 타일셋의 GID (tileset.ts 가 같은 순서로 그림)
export const G = {
  WOOD: 1, CARPET: 2, GRID: 3, GREEN: 4, PURPLE: 5, BEIGE: 6, CAFE: 7, NAP: 8, LOBBY: 9, OFFICE: 10,
  CAP: 11, FACE: 12, WINDOW: 13,
  DESK: 14, CHAIR: 15, SHELF: 16, RACK: 17, PLANT: 18, SOFA: 19, BED_TOP: 20, BED_BOT: 21,
  CAFE_TABLE: 22, COFFEE: 23, WHITEBOARD: 24, BENCH: 25, GLOBE: 26, MAT: 27, CABINET: 28,
  MTABLE: 29, BOSSDOOR: 30, CLOCK: 31, LAMP: 32, RACK_TOP: 33, SHELF_TOP: 34, LAPTOP_DESK: 35, PLANT_TOP: 36,
  GLASS: 37, COUNTER: 38, STANDBOARD: 39, TEAL: 40, DESK_UP: 41, CHAIR_UP: 42,
  LAB: 43, TROPHY: 44, ELEVATOR: 45,
  STEEL: 46, DOOR: 47, DOOR_FACE: 48, VOID: 49, WALLTOP: 50,   // WALLTOP ~ WALLTOP+15: 벽 윗면 오토타일 (바닥과 닿은 쪽에 테두리)
  PRINTER: 66, WATER: 67, LEAD_T: 68, LEAD_B: 69, CHAIR_L: 70,   // 팀장 책상(세로) 위·아래, 왼쪽을 보는 의자
  CHAIR_BACK: 71,   // 위를 보는 의자의 등받이만 (캐릭터 위에 덮어 그림)
} as const;
export const TILE_COUNT = 71;
export const TILE_COLS = 16;   // 타일셋 이미지 가로 칸 수 (Tiled 에서 보기 편하게 격자로)

/** 벽 칸을 "벽 윗면(바닥과 닿은 방향에 테두리)" 또는 "바깥(VOID)"으로 바꾼다 */
export function autotileWalls(walls: number[], w: number, h: number) {
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? G.CAP : walls[y * w + x]);
  const out = walls.slice();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (walls[y * w + x] !== G.CAP) continue;
    let near = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (at(x + dx, y + dy) !== G.CAP) near = true;
    if (!near) { out[y * w + x] = G.VOID; continue; }
    const open = (xx: number, yy: number) => at(xx, yy) === 0;
    const mask = (open(x, y - 1) ? 1 : 0) | (open(x + 1, y) ? 2 : 0) | (open(x, y + 1) ? 4 : 0) | (open(x - 1, y) ? 8 : 0);
    out[y * w + x] = G.WALLTOP + mask;
  }
  return out;
}

// 길을 막는 가구 (좌석·벤치·침대 머리·의자는 POI 라서 통과 가능)
const BLOCKING = new Set<number>([G.DESK, G.DESK_UP, G.SHELF, G.RACK, G.PLANT, G.CAFE_TABLE, G.COFFEE, G.GLOBE, G.CABINET,
  G.MTABLE, G.BED_BOT, G.LAPTOP_DESK, G.LAMP, G.COUNTER, G.STANDBOARD, G.TROPHY, G.PRINTER, G.WATER, G.LEAD_T, G.LEAD_B]);
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
  const door = (x: number, rows: number[]) => { rows.forEach((y, i) => { for (const dx of [0, 1]) { walls[idx(x + dx, y)] = 0; floor[idx(x + dx, y)] = i === 0 ? G.DOOR : G.DOOR_FACE; } }); };
  /** 책상 pod: 위 줄 책상(y)·아래 줄 책상(y+1)이 마주 보고, 가운데 낮은 파티션. 좌석은 y-1(아래를 봄)과 y+2(위를 봄).
   *  lead=true 면 pod 오른쪽 끝에 세로 팀장 책상 + 왼쪽(팀원 쪽)을 보는 의자 */
  const island = (prefix: string, xs: number[], y: number, deskTop: number = G.DESK, start = 1, lead = false) => {
    let n = start;
    // 앉은 사람 앞에 오는 것(위 줄 책상 앞면, 아래 줄 의자 등받이)은 furniture-top 에도 그려서 캐릭터를 자연스럽게 가림
    for (const x of xs) { put(x, y, deskTop); putTop(x, y, deskTop); put(x, y - 1, G.CHAIR); poi(`${prefix}_${n++}`, x, y - 1, "down", "sit"); }
    for (const x of xs) { put(x, y + 1, G.DESK_UP); put(x, y + 2, G.CHAIR_UP); putTop(x, y + 2, G.CHAIR_BACK); poi(`${prefix}_${n++}`, x, y + 2, "up", "sit"); }
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    objects.push({ id: oid++, name: "partition", type: "partition", x: x0 * TILE + 1, y: (y + 1) * TILE - 2, width: (x1 - x0 + 1) * TILE - 2, height: 4 });
    if (lead) {
      put(x1 + 1, y, G.LEAD_T); put(x1 + 1, y + 1, G.LEAD_B);
      put(x1 + 2, y, G.CHAIR_L); poi(`${prefix}_${n++}`, x1 + 2, y, "left", "sit");
    }
    return n;
  };

  // ── 행 구성: 1줄 방(위벽 0·뒷벽 1·바닥 2~7·아래벽 8) / 복도 9~10 / 2줄 방(위벽 11·뒷벽 12·바닥 13~17·아래벽 18) / 복도 19~20 / 3줄 방(위벽 21·뒷벽 22·바닥 23~27·아래벽 28) ──
  const R1 = { face: 1, f0: 2, f1: 7 }, R2 = { face: 12, f0: 13, f1: 17 }, R3 = { face: 22, f0: 23, f1: 27 };
  type Row = typeof R1;
  const makeRoom = (key: string, label: string, row: Row, x0: number, x1: number, f: number, doorX: number) => {
    carve(x0, row.face, x1, row.f1, f); face(x0, x1, row.face); room(key, label, x0, row.face, x1, row.f1);
    if (row === R1) door(doorX, [8]); else door(doorX, [row.face - 1, row.face]);
  };

  // 복도 두 줄 + 오른쪽 세로 복도(두 복도를 잇는 통로)
  carve(1, 9, 38, 10, G.OFFICE); room("hall", "복도", 1, 9, 38, 10);
  carve(1, 19, 38, 20, G.OFFICE);
  carve(37, 11, 38, 18, G.OFFICE);

  // ── 1줄: 생각실 / 자료실 / 코딩실(가장 큼) / 터미널실 ──
  makeRoom("think", "생각실", R1, 1, 7, G.PURPLE, 4);
  makeRoom("lib", "자료실", R1, 9, 15, G.WOOD, 12);
  makeRoom("dev", "코딩실", R1, 17, 30, G.CARPET, 25);
  makeRoom("srv", "터미널실", R1, 32, 38, G.STEEL, 34);
  // ── 2줄: 조사실 / 회의실 / GitHub·Notion·Obsidian 출장실 ──
  makeRoom("research", "조사실", R2, 1, 7, G.GREEN, 5);
  makeRoom("meet", "회의실", R2, 9, 15, G.PURPLE, 9);
  makeRoom("gh", "GitHub 출장", R2, 17, 22, G.TEAL, 21);
  makeRoom("plan", "Notion 출장", R2, 24, 29, G.LOBBY, 28);
  makeRoom("obsidian", "Obsidian 출장", R2, 31, 35, G.LAB, 31);
  // ── 3줄: 결재대기 / 수면실 / 탕비실 / 리셉션(출퇴근) ──
  makeRoom("ceo", "결재대기", R3, 1, 7, G.WOOD, 1);
  makeRoom("nap", "수면실", R3, 9, 15, G.NAP, 9);
  makeRoom("cafe", "탕비실", R3, 17, 29, G.CAFE, 22);
  makeRoom("lobby", "리셉션", R3, 31, 38, G.BEIGE, 36);
  // 출입구: 리셉션 오른쪽 벽
  for (const y of [25, 26]) { walls[idx(39, y)] = 0; floor[idx(39, y)] = G.DOOR; }
  poi("entrance", 38, 26, "left");

  // ── 벽 장식 (바깥 창은 1줄 방에만) ──
  for (const x of [2, 6, 10, 14, 19, 23, 28]) setWall(x, 1, G.WINDOW);
  setWall(4, 1, G.WHITEBOARD); setWall(36, 1, G.CLOCK);
  setWall(13, 12, G.WHITEBOARD); setWall(3, 12, G.CLOCK);
  setWall(6, 22, G.BOSSDOOR); setWall(3, 22, G.CLOCK); setWall(25, 22, G.CLOCK);

  // ── 생각실: 둥근 회의 테이블 + 안락 소파 ──
  for (const [x, y] of [[3, 4], [4, 4], [3, 5], [4, 5]]) put(x, y, G.MTABLE);
  poi("think_seat_1", 3, 3, "down", "sit"); poi("think_seat_2", 4, 3, "down", "sit");
  poi("think_seat_3", 3, 6, "up", "sit"); poi("think_seat_4", 4, 6, "up", "sit");
  put(6, 6, G.SOFA); put(7, 6, G.SOFA); poi("think_seat_5", 6, 6, "down", "sit");
  put(1, 3, G.LAMP); plant(7, 3); plant(1, 7);

  // ── 자료실: 책장 두 줄 + 열람 테이블 + 소파 ──
  for (let x = 9; x <= 15; x++) { put(x, 2, G.SHELF); putTop(x, 1, G.SHELF_TOP); }
  [9, 11, 13, 15].forEach((x, i) => poi(`bookshelf_${i + 1}`, x, 3, "up"));
  for (let x = 9; x <= 11; x++) put(x, 5, G.SHELF);
  poi("bookshelf_5", 9, 6, "up"); poi("bookshelf_6", 11, 6, "up");
  put(13, 5, G.MTABLE); put(14, 5, G.MTABLE); poi("bookshelf_7", 13, 6, "up", "sit"); poi("bookshelf_8", 14, 6, "up", "sit");
  put(14, 7, G.SOFA); put(15, 7, G.SOFA);

  // ── 코딩실: 마주 보는 책상 pod 두 개 + 팀장 책상 + 구석 스탠드업 ──
  const n = island("seat_dev", [18, 19, 20], 4, G.DESK, 1, true);
  island("seat_dev", [24, 25, 26], 4, G.DESK, n, true);
  put(29, 2, G.STANDBOARD); put(30, 2, G.STANDBOARD);
  [[29, 3], [30, 3], [29, 4], [30, 4]].forEach(([x, y], i) => poi(`standup_${i + 1}`, x, y, "up"));
  plant(17, 7); plant(30, 7); put(23, 7, G.PRINTER);

  // ── 터미널실: 서버랙 두 줄 + 랙 앞 작업 자리 ──
  [32, 34, 36, 38].forEach((x, i) => { put(x, 2, G.RACK); putTop(x, 1, G.RACK_TOP); poi(`server_rack_${i + 1}`, x, 3, "up"); });
  [33, 35, 37].forEach((x, i) => { put(x, 5, G.RACK); putTop(x, 4, G.RACK_TOP); poi(`server_rack_${i + 5}`, x, 6, "up"); });

  // ── 조사실: 노트북 pod + 지구본 ──
  island("research_desk", [2, 3, 4], 14, G.LAPTOP_DESK, 1, true);
  put(7, 15, G.GLOBE); plant(7, 17);

  // ── 회의실: 테이블과 양쪽 좌석 (서브에이전트 회의) ──
  for (let x = 11; x <= 13; x++) { put(x, 14, G.MTABLE); put(x, 15, G.MTABLE); }
  for (let x = 11; x <= 13; x++) poi(`meeting_seat_${x - 10}`, x, 13, "down", "sit");
  for (let x = 11; x <= 13; x++) poi(`meeting_seat_${x - 7}`, x, 16, "up", "sit");
  plant(15, 17); put(9, 17, G.LAMP);

  // ── 출장실 3곳: 마주 보는 pod ──
  island("repo_desk", [21, 22], 14, G.DESK, island("repo_desk", [17, 18], 14));   // GitHub: 2+2 pod 두 개
  island("plan_desk", [25, 26, 27], 14, G.LAPTOP_DESK, 1, true);
  island("obsidian_desk", [32, 33, 34], 14, G.LAPTOP_DESK);
  plant(22, 17); plant(29, 17); plant(35, 17);

  // ── 결재대기: 내 책상(대표 책상) + 대기 벤치 ──
  for (const x of [2, 3, 4]) put(x, 24, G.MTABLE);
  put(3, 23, G.CHAIR_UP);
  for (let x = 2; x <= 6; x++) { put(x, 26, G.BENCH); poi(`waiting_bench_${x - 1}`, x, 26, "up", "sit"); }
  plant(7, 26); plant(1, 27);   // 오른쪽 위(5~7, 23~24)는 현황판 자리

  // ── 수면실: 침대 + 무드등 ──
  [11, 13, 15].forEach((x, i) => { put(x, 23, G.BED_TOP); put(x, 24, G.BED_BOT); poi(`bed_${i + 1}`, x, 23, "down", "lie"); });
  put(9, 27, G.LAMP); plant(15, 27);

  // ── 탕비실: 커피머신·정수기·카운터 + 테이블 ──
  for (let x = 18; x <= 21; x++) put(x, 23, G.COUNTER);
  put(28, 23, G.COFFEE); poi("coffee_machine", 28, 24, "up");
  put(26, 23, G.WATER);
  put(20, 26, G.CAFE_TABLE); put(24, 26, G.CAFE_TABLE);
  poi("cafe_seat_1", 19, 26, "right", "sit"); poi("cafe_seat_2", 21, 26, "left", "sit");
  poi("cafe_seat_3", 23, 26, "right", "sit"); poi("cafe_seat_4", 25, 26, "left", "sit");
  put(17, 27, G.SOFA); put(18, 27, G.SOFA); poi("sofa_1", 17, 27, "down", "sit"); poi("sofa_2", 18, 27, "down", "sit");
  plant(29, 27);

  // ── 리셉션: 안내 데스크 + 대기 소파 + 벽면 서류 캐비닛(쉬는 저장소) ──
  for (let x = 33; x <= 35; x++) put(x, 25, G.COUNTER);
  put(31, 27, G.SOFA); put(32, 27, G.SOFA); poi("sofa_3", 31, 27, "down", "sit"); poi("sofa_4", 32, 27, "down", "sit");
  for (const x of [31, 32, 38]) put(x, 23, G.CABINET);
  poi("archive_cabinet", 32, 24, "up");
  room("archive", "서류 캐비닛", 31, 22, 32, 23);
  plant(38, 27);

  // ── 복도 리듬: 화분·정수기·프린터 ──
  plant(1, 10); plant(16, 10); put(31, 9, G.WATER); put(8, 19, G.PRINTER); plant(23, 20); plant(30, 20); plant(1, 20);

  // ── collision ──
  const collision = new Array<number>(N).fill(0);
  for (let i = 0; i < N; i++) if (walls[i] || BLOCKING.has(furn[i])) collision[i] = 1;

  const wallsTiled = autotileWalls(walls, MW, MH);
  const layer = (id: number, name: string, data: number[], visible = true) =>
    ({ id, name, type: "tilelayer", width: MW, height: MH, x: 0, y: 0, opacity: 1, visible, data });
  return {
    type: "map", version: "1.10", tiledversion: "generated", orientation: "orthogonal", renderorder: "right-down",
    width: MW, height: MH, tilewidth: TILE, tileheight: TILE, infinite: false, nextlayerid: 8, nextobjectid: oid,
    layers: [
      layer(1, "floor", floor), layer(2, "walls", wallsTiled), layer(3, "furniture", furn), layer(4, "furniture-top", top),
      layer(5, "collision", collision, false),
      { id: 6, name: "objects", type: "objectgroup", visible: true, opacity: 1, x: 0, y: 0, draworder: "topdown", objects },
      { id: 7, name: "rooms", type: "objectgroup", visible: true, opacity: 1, x: 0, y: 0, draworder: "topdown", objects: rooms },
    ],
    tilesets: [tilesetJson()],
  };
}

/** Tiled 타일셋 정의 (맵에 포함) — 이미지는 office-tiles.png */
export function tilesetJson() {
  const names = Object.entries(G).map(([k, v]) => ({ id: v - 1, name: k }));
  return { firstgid: 1, name: "office", tilewidth: TILE, tileheight: TILE, tilecount: TILE_COUNT, columns: TILE_COLS,
    image: "office-tiles.png", imagewidth: TILE * TILE_COLS, imageheight: TILE * Math.ceil(TILE_COUNT / TILE_COLS), margin: 0, spacing: 0,
    tiles: names.map(n => ({ id: n.id, properties: [{ name: "name", type: "string", value: n.name }] })) };
}
