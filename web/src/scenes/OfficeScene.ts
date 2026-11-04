import Phaser from "phaser";
import EasyStar from "easystarjs";
import { buildDefaultMap, TILE } from "../map/defaultMap";
import { makeTilesetCanvas } from "../gfx/tileset";
import { FW, FH, COLS, DIR_ROW, Dir, lookFor, makeSheet, hash, Team } from "../gfx/people";
import { ensureGlowTexture, addNight, lightFromMap, addRugs, addDeskProps, addLife, sign, glow, DEPTH } from "../gfx/ambience";
import { showBubble, hideBubble, placeBubble, esc, ago } from "../ui/bubble";
import { Speech, SpeechKind, twoLines } from "../gfx/speech";
import { rankOf, ROLE, NICK } from "../ui/names";

export interface Poi { name: string; kind: string; tx: number; ty: number; dir: Dir; pose: "stand" | "sit" | "lie" }
export interface RoomRect { key: string; label: string; x: number; y: number; w: number; h: number }
interface Session {
  id: string; title: string; project: string; state: string; activity: string; tool?: string; toolFull?: string;
  detail?: string; activeSubagents?: number; updated?: number; toolCount?: number;
}
interface Config {
  tripKeywords: Record<string, string>; zones: Record<string, string>;
  debounce: { minStaySec: number; quickToolSec: number };
  standup: { times: string[]; durationMin: number };
  maxSubagentsShown: number; pollMs: number; ambientStaff: number;
}
const DEFAULT_CONFIG: Config = {
  tripKeywords: { github: "gh", notion: "plan", obsidian: "research", websearch: "research", webfetch: "research" },
  zones: { waiting: "ceo", read: "lib", run: "srv", edit: "dev", browse: "research", think: "meet", delegate: "dev", done: "cafe", sleep: "nap" },
  debounce: { minStaySec: 8, quickToolSec: 3 },
  standup: { times: ["10:00", "16:00"], durationMin: 5 },
  maxSubagentsShown: 3, pollMs: 1000, ambientStaff: 16,
};

// 구역 → POI 종류 (POI 이름 규칙: <종류>_<번호>)
export const ZONE_POI: Record<string, string> = {
  dev: "seat_dev", lib: "bookshelf", srv: "server_rack", research: "research_desk", plan: "plan_desk", gh: "repo_desk",
  meet: "meeting_seat", ceo: "waiting_bench", cafe: "cafe_seat", nap: "bed", standup: "standup",
};
export const ZONE_ORDER = ["dev", "lib", "srv", "research", "meet", "ceo", "cafe", "nap", "standup"];
export const ZONE_NAME: Record<string, string> = {
  dev: "개발팀 섬", lib: "자료실", srv: "서버실", research: "연구팀 섬", plan: "기획팀 섬", gh: "GitHub 개발본부 섬",
  meet: "유리 회의실", ceo: "대표실·결재대기", cafe: "탕비실·카페", nap: "수면실", standup: "스탠드업",
};
// 이동하지 않고 자리에서 띄우는 머리 위 아이콘
const ZONE_ICON: Record<string, string> = {
  dev: "</>", lib: "책", srv: ">_", research: "www", plan: "기획", gh: "git", meet: "…", ceo: "!", cafe: "커피", nap: "z", standup: "회의",
};
const SPEED = 46; // px/s

// 잡담 대본 (번갈아 말함)
const CHATS: string[][] = [
  ["점심 뭐 먹을까요?", "김치찌개 어때요?", "좋아요, 12시에 가요!"],
  ["어제 배포 잘 됐어요?", "네, 롤백 없이 끝났어요", "다행이다…"],
  ["커피 한 잔 더 해야겠어요", "저도요. 오늘 PR이 많네요"],
  ["회의 몇 시였죠?", "3시요. 자료 다 됐어요?", "거의요!"],
  ["버그 원인 찾았어요?", "결국 캐시였어요…", "늘 캐시죠 ㅋㅋ"],
  ["Claude 세션들 열일하네요", "우리도 힘내요!"],
  ["주말에 뭐 하셨어요?", "등산 다녀왔어요", "부지런하시네요"],
  ["이거 리뷰 좀 봐줄 수 있어요?", "네, 5분만요"],
  ["오늘 날씨 좋네요", "퇴근하고 산책 가야지"],
  ["스탠드업 때 뭐 말하지…", "어제 한 거 말하면 돼요"],
  ["서버 로그 이상한 거 봤어요?", "아까 재시작했어요", "아 그래서였구나"],
  ["테스트 다 초록불이에요!", "오 축하해요!"],
  ["회식 이번 주 금요일이래요", "어디서요?", "고깃집이요!"],
  ["이 함수 이름 뭐로 하지…", "naming은 언제나 어렵죠"],
];
const SOLO = ["휴, 다 끝났다", "커피가 맛있네", "다음 일은 뭘까", "잠깐 쉬어야지", "오늘 꽤 했다"];

/** 받침 따라 "로/으로" */
function ro(word: string) {
  const c = word.charCodeAt(word.length - 1) - 0xac00;
  if (c < 0 || c > 11171) return "로";
  const jong = c % 28;
  return jong === 0 || jong === 8 ? "로" : "으로";
}
/** 도구 이름을 사람이 읽는 문장으로 */
function friendly(s: Session) {
  const detail = (s.detail || "").trim(), tool = s.tool || detail.split(" ")[0] || "";
  const arg = detail.startsWith(tool) ? detail.slice(tool.length).trim() : "";
  const a = arg ? `: ${arg.length > 40 ? arg.slice(0, 39) + "…" : arg}` : "";
  if (s.activity === "think" || !tool) return detail.startsWith("요청 받음") ? detail : "곰곰이 생각하는 중";
  if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool)) return `파일 고치는 중${a}`;
  if (/^Read$/.test(tool)) return `파일 읽는 중${a}`;
  if (/^(Grep|Glob|LS)$/.test(tool)) return `코드 찾아보는 중${a}`;
  if (/^(Bash|Monitor|BashOutput)$/.test(tool)) return `터미널 명령 실행 중${a}`;
  if (/^(WebSearch)$/.test(tool)) return `웹 검색 중${a}`;
  if (/^(WebFetch)$|browser|navigate|screenshot|read_page|get_page_text|computer|javascript|tabs_|find|form_input|resize|preview/i.test(tool)) return "브라우저로 화면 확인 중";
  if (/^(Agent|Task)$/.test(tool)) return `서브에이전트에게 일 맡기는 중${a}`;
  if (/notion/i.test(tool)) return "Notion 문서 보는 중";
  if (/github/i.test(tool)) return "GitHub 작업 중";
  if (/update_plan|TodoWrite/.test(tool)) return "할 일 목록 정리 중";
  if (/wrap_up/.test(tool)) return "작업 마무리하는 중";
  if (/AskUserQuestion/.test(tool)) return "나에게 질문하는 중";
  return `${tool} 도구 쓰는 중`;
}

function stateKey(s: Session) {
  if (s.state === "waiting" || s.activity === "ask") return "waiting";
  if (s.activity === "sleep") return "sleep";
  if (s.state === "idle") return "done";
  switch (s.activity) {
    case "type": case "tool": case "present": return "edit";
    case "read": return "read";
    case "run": return "run";
    case "browse": return "browse";
    case "delegate": return "delegate";
    default: return "think";
  }
}

class Walker {
  sprite: Phaser.GameObjects.Sprite;
  tag: Phaser.GameObjects.Text;
  icon: Speech;
  base: { text: string; kind: SpeechKind } = { text: "", kind: "plain" };
  sayText = ""; sayUntil = 0; inChat = false;
  path: { x: number; y: number }[] = [];
  tx: number; ty: number;
  dir: Dir = "down";
  target: Poi | null = null;
  zone = "";
  arrivedAt = 0;               // 목적지에 도착한 시각 (최소 머무는 시간 계산)
  want = ""; wantSince = 0;    // 디바운스: 가고 싶은 구역과 그 상태가 시작된 시각
  leaving = false;
  manualUntil = 0;
  session: Session | null = null;
  name = ""; rank = -1;
  npc = false; home: Poi | null = null; nextAt = 0; task = "";   // 배경 직원
  constructor(public scene: OfficeScene, public id: string, public key: string, tx: number, ty: number, public junior = false, public parentId = "") {
    this.tx = tx; this.ty = ty;
    this.sprite = scene.add.sprite(tx * TILE + TILE / 2, ty * TILE + TILE - 1, key, 0).setOrigin(0.5, 1);
    if (junior) this.sprite.setScale(0.8);
    const font = { fontFamily: "Galmuri11, ui-monospace, monospace", fontSize: "7px" };
    this.tag = scene.add.text(0, 0, "", { ...font, color: "#eef0f4", stroke: "#2a1d1c", strokeThickness: 3 }).setOrigin(0.5, 0).setResolution(4);
    // 커서를 올리면 머리 위 말풍선
    this.sprite.setInteractive({ useHandCursor: true });
    this.sprite.on("pointerover", () => scene.hover(this));
    this.sprite.on("pointerout", () => hideBubble(scene));
    this.icon = new Speech(scene);
  }
  get walking() { return this.path.length > 0; }
  goTo(poi: Poi | null, zone: string) {
    this.zone = zone;
    this.scene.release(this);
    if (!poi) return;
    this.scene.reserve(poi, this);
    this.target = poi;
    this.arrivedAt = Number.POSITIVE_INFINITY;
    this.scene.findPath(this.tx, this.ty, poi.tx, poi.ty, (p) => {
      this.path = p ? p.slice(1) : [];
      if (!this.path.length) this.arrivedAt = Date.now();
    });
  }
  /** 계속 떠 있는 말풍선 (하는 일 / 확인 필요 / 작은 표시) */
  setIcon(text: string, kind: boolean | "work" | SpeechKind = false) {
    this.base = { text, kind: kind === true ? "wait" : kind === false ? "plain" : kind };
  }
  /** 잠깐 말하기 (잡담) */
  say(text: string, ms = 2600) { this.sayText = text; this.sayUntil = this.scene.time.now + ms; }
  // ── 실제 세션 표시: 발밑 상태 링 + 스포트라이트 ──
  ring?: Phaser.GameObjects.Ellipse; light?: Phaser.GameObjects.Image;
  stateColor() {
    const st = this.session?.state;
    return this.junior ? 0xe8875a : st === "working" ? 0xff9a5a : st === "waiting" ? 0xffd166 : 0x9a8f88;
  }
  updateMarker() {
    if (this.npc) return;
    const s = this.sprite, now = this.scene.time.now;
    if (!this.ring) {
      this.ring = this.scene.add.ellipse(s.x, s.y, 14, 6).setStrokeStyle(1.5, 0xff9a5a, 1).setFillStyle(0xff9a5a, 0.18);
      this.light = glow(this.scene, s.x, s.y - 8, "#ffb070", 22, 0);
    }
    const c = this.stateColor(), active = this.junior || this.session?.state !== "idle";
    const pulse = 0.55 + 0.45 * Math.sin(now / 260);
    this.ring.setPosition(s.x, s.y - 1).setDepth(9 + s.y).setStrokeStyle(1.5, c, active ? pulse : 0.5).setFillStyle(c, active ? 0.12 + 0.12 * pulse : 0.06)
      .setScale(this.junior ? 0.75 : 1);
    const lit = this.session?.state === "working" ? 0.45 : this.session?.state === "waiting" ? 0.35 : 0;
    this.light!.setPosition(s.x, s.y - 8).setAlpha(lit * (0.8 + 0.2 * pulse)).setTint(c);
  }
  update(dt: number) {
    const s = this.sprite;
    if (this.path.length) {
      const n = this.path[0], gx = n.x * TILE + TILE / 2, gy = n.y * TILE + TILE - 1;
      const dx = gx - s.x, dy = gy - s.y, d = Math.hypot(dx, dy), step = SPEED * dt;
      this.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
      if (d <= step) {
        s.x = gx; s.y = gy; this.tx = n.x; this.ty = n.y; this.path.shift();
        if (!this.path.length) this.arrivedAt = Date.now();
      } else { s.x += dx / d * step; s.y += dy / d * step; }
      s.play(`${this.key}-walk-${this.dir === "left" ? "right" : this.dir}`, true);
      s.setFlipX(this.dir === "left").setAngle(0);
    } else {
      s.anims.stop();
      const t = this.target, arrived = t && t.tx === this.tx && t.ty === this.ty;
      const dir = arrived ? t!.dir : this.dir, row = DIR_ROW[dir === "left" ? "right" : dir];
      const sit = arrived && t!.pose !== "stand";
      const busy = sit && (this.npc ? this.target === this.home : this.session?.state === "working");
      s.setOrigin(0.5, busy && Math.floor((this.scene.time.now + this.tx * 97) / 280) % 2 ? 1 + 1 / FH : 1);
      s.setFrame(row * COLS + (sit ? 4 : 0)).setFlipX(dir === "left");
      s.setAngle(arrived && t!.pose === "lie" ? -90 : 0);
    }
    s.setDepth(10 + s.y);
    const h = FH * s.scaleY;
    this.tag.setPosition(s.x, s.y + 1).setDepth(DEPTH.tag).setVisible(!this.path.length && !this.npc && !this.junior);
    // 말풍선: 잡담 중이면 잡담, 아니면 계속 띄우는 상태 말풍선. 걷는 동안엔 잡담만
    const now = this.scene.time.now, chatting = now < this.sayUntil;
    if (chatting) this.icon.set(this.sayText, "chat");
    else this.icon.set(this.base.text, this.base.kind);
    const lying = s.angle !== 0, headY = lying ? s.y - 12 : s.y - h + (s.originY > 1 ? 1 : 0) - 1;
    const bob = this.base.kind === "work" && !chatting ? Math.round(Math.sin(now / 420 + this.tx)) : 0;
    this.icon.at(s.x, headY, bob);
    this.icon.box.setDepth(DEPTH.icon + s.y / 1000);
    this.updateMarker();
  }
  destroy() { this.sprite.destroy(); this.tag.destroy(); this.icon.destroy(); this.ring?.destroy(); this.light?.destroy(); }
}

export class OfficeScene extends Phaser.Scene {
  map!: Phaser.Tilemaps.Tilemap;
  pois: Poi[] = [];
  rooms: RoomRect[] = [];
  easy = new EasyStar.js();
  walkers = new Map<string, Walker>();
  reservedBy = new Map<string, string>();   // poi 이름 → walker id
  cfg: Config = DEFAULT_CONFIG;
  hud!: HTMLElement;
  entrance!: Poi;
  ready = false;
  constructor() { super("office"); }

  preload() {
    // 선택: 재배포 불가 타일셋을 assets/third-party/ 에 넣으면 사용 (없으면 코드로 그린 기본 타일)
    this.load.image("tp-tiles", "/third-party/tileset.png");
    this.load.json("tp-map", "/third-party/tileset.map.json");
    this.load.on("loaderror", () => { /* 없으면 기본 타일 사용 */ });
  }


  async create() {
    (window as any).office = this;   // 디버깅용
    // ① 맵: Tiled 파일(public/maps/office.tmj)이 있으면 그걸, 없으면 코드 생성 기본 맵
    let data: any = null, source = "코드 생성 기본 맵";
    try { const r = await fetch("/maps/office.tmj"); if (r.ok && (r.headers.get("content-type") || "").includes("json")) { data = await r.json(); source = "Tiled: maps/office.tmj"; } } catch { /* 없음 */ }
    if (!data) data = buildDefaultMap();
    // 타일셋: 기본은 코드로 그린 타일. assets/third-party/tileset.png(+map.json)이 있으면 같은 이름 타일을 그걸로 교체
    const tpMap = this.cache.json.get("tp-map");
    const tpImg = this.textures.exists("tp-tiles") ? this.textures.get("tp-tiles").getSourceImage() as HTMLImageElement : null;
    this.textures.addCanvas("office-tiles", makeTilesetCanvas(tpImg && tpMap ? { img: tpImg, index: tpMap } : null));
    this.cache.tilemap.add("office", { format: Phaser.Tilemaps.Formats.TILED_JSON, data });
    this.map = this.make.tilemap({ key: "office" });
    const ts = this.map.addTilesetImage("office", "office-tiles")!;
    this.map.createLayer("floor", ts)!.setDepth(0);
    this.map.createLayer("walls", ts)!.setDepth(1);
    this.map.createLayer("furniture", ts)!.setDepth(2);
    this.map.createLayer("furniture-top", ts)!.setDepth(9000);   // 캐릭터보다 위

    // ② POI / 방 영역 (이름 규칙만으로 연결)
    const prop = (o: any, k: string) => o.properties?.find((p: any) => p.name === k)?.value;
    for (const o of this.map.getObjectLayer("objects")?.objects ?? [])
      this.pois.push({ name: o.name, kind: o.name.replace(/_\d+$/, ""), tx: Math.floor(o.x! / TILE), ty: Math.floor(o.y! / TILE),
        dir: (prop(o, "dir") || "down") as Dir, pose: prop(o, "pose") || "stand" });
    for (const o of this.map.getObjectLayer("rooms")?.objects ?? [])
      this.rooms.push({ key: o.name, label: prop(o, "label") || o.name, x: o.x!, y: o.y!, w: o.width!, h: o.height! });
    this.entrance = this.pois.find(p => p.name === "entrance")!;
    // 분위기: 러그 · 책상 소품 · 조명 · 밤 · 작은 움직임
    ensureGlowTexture(this);
    addRugs(this, this.rooms, { dev: "#6c8cff", gh: "#3fb8a8", plan: "#b48ae0", research: "#6fbf8a", standup: "#f0c060", meet: "#8fa3c8" });
    addDeskProps(this, this.pois, ["seat_dev", "repo_desk", "plan_desk", "research_desk"]);
    lightFromMap(this, this.map, this.rooms.filter(r => r.key !== "floor"));
    addNight(this, this.map.widthInPixels, this.map.heightInPixels);
    addLife(this, this.map);
    this.drawRoomSigns();

    // ③ 길찾기 격자 (collision 레이어)
    const col = this.map.getLayer("collision")!.data;
    this.easy.setGrid(col.map(row => row.map(t => (t.index > 0 ? 1 : 0))));
    this.easy.setAcceptableTiles([0]);
    this.easy.disableDiagonals();

    // ④ 화면 맞춤 (정수 배율)
    this.fit(); window.addEventListener("resize", () => this.fit());
    new ResizeObserver(() => this.fit()).observe(document.getElementById("stage")!);

    this.hud = document.getElementById("hud")!;
    this.hud.dataset.source = source;
    this.input.keyboard!.on("keydown", (e: KeyboardEvent) => {
      const i = Number(e.key) - 1;
      if (i >= 0 && i < ZONE_ORDER.length) this.sendFirstTo(ZONE_ORDER[i]);
      if (e.key === "f" || e.key === "F") this.scale.isFullscreen ? this.scale.stopFullscreen() : this.scale.startFullscreen();
    });
    await this.loadConfig();
    this.ready = true;
    await this.poll();
    this.time.addEvent({ delay: this.cfg.pollMs || 1000, loop: true, callback: () => this.poll() });
    this.time.addEvent({ delay: 30000, loop: true, callback: () => this.loadConfig() });
  }

  async loadConfig() {
    try {
      const c = await (await fetch("/api/config")).json();
      if (!c.error) this.cfg = { ...DEFAULT_CONFIG, ...c, debounce: { ...DEFAULT_CONFIG.debounce, ...c.debounce }, standup: { ...DEFAULT_CONFIG.standup, ...c.standup } };
    } catch { /* 기본값 */ }
  }

  fit() {
    if (!this.map || !this.sys.isActive()) return;
    // 맵 영역(#stage)에 꽉 차게. 2배 이상이면 정수 배율(선명), 그보다 작으면(화면 반쪽 분할 등) 소수 배율 허용
    const W = this.map.widthInPixels, H = this.map.heightInPixels;
    const box = document.getElementById("stage")!.getBoundingClientRect();
    let z = Math.min(box.width / W, box.height / H);
    z = z >= 2 ? Math.floor(z) : Math.max(0.5, Math.floor(z * 8) / 8);
    this.scale.resize(Math.round(W * z), Math.round(H * z));
    this.cameras.main.setZoom(z).centerOn(W / 2, H / 2).setRoundPixels(true);
  }

  renderGuide(sessions: Session[]) {
    // 부서 안내: 구역 색 · 이름 · 언제 가는지 · 지금 인원
    const count: Record<string, number> = {};
    for (const w of this.walkers.values()) if (!w.npc && !w.leaving && w.zone) count[w.zone] = (count[w.zone] || 0) + 1;
    const when: Record<string, string[]> = {};
    const LABEL: Record<string, string> = { waiting: "내 승인·대답 기다림", read: "파일 읽기·검색", run: "터미널 명령", edit: "파일 수정",
      browse: "웹 검색", think: "생각 중", delegate: "서브에이전트에게 맡김", done: "작업 끝, 휴식", sleep: "30분 넘게 조용함" };
    for (const [k, z] of Object.entries(this.cfg.zones)) if (!k.startsWith("_")) (when[z] ??= []).push(LABEL[k] || k);
    for (const [kw, z] of Object.entries(this.cfg.tripKeywords)) if (!kw.startsWith("_")) (when[z] ??= []).push(`${kw} 도구 출장`);
    (when.standup ??= []).push(`매일 ${this.cfg.standup.times.join(", ")}`);
    const ORDER = ["dev", "gh", "plan", "research", "ceo", "meet", "lib", "srv", "cafe", "nap", "standup"];
    const COLOR: Record<string, string> = { ceo: "#e0b04a", meet: "#8fa3c8", lib: "#d39a5c", srv: "#5fd08a", nap: "#8d86c0",
      dev: "#6c8cff", gh: "#3fb8a8", plan: "#b48ae0", research: "#6fbf8a", standup: "#f0c060", cafe: "#e0a080" };
    const el = document.getElementById("zones");
    if (!el) return;
    const html = ORDER.map(z => `<div class="z"><i style="background:${COLOR[z]}"></i><div><b>${ZONE_NAME[z]}</b><span>${[...new Set(when[z] || [])].join(" · ") || "-"}</span></div><em class="${count[z] ? "on" : ""}">${count[z] || 0}</em></div>`).join("");
    if (el.innerHTML !== html) el.innerHTML = html;
    void sessions;
  }

  drawRoomSigns() {
    // 통일된 사인: 짙은 남색 판 + 왼쪽 팀 색 띠 + 흰 글씨
    const ACCENT: Record<string, string> = {
      ceo: "#e0b04a", meet: "#8fa3c8", lib: "#d39a5c", srv: "#5fd08a", nap: "#8d86c0",
      dev: "#6c8cff", gh: "#3fb8a8", plan: "#b48ae0", research: "#6fbf8a", standup: "#f0c060",
      lobby: "#e8875a", cafe: "#e0a080", archive: "#a0a8b8",
    };
    for (const r of this.rooms) if (r.key !== "floor") sign(this, r.x + 3, r.y + 2, r.label, ACCENT[r.key] || "#9aa0ad");
    // 리셉션 로고 벽
    const lobby = this.rooms.find(r => r.key === "lobby");
    if (lobby) {
      const cx = lobby.x + lobby.w / 2 + 8, y = lobby.y + 4;
      const logo = this.add.text(cx, y, "CLAUDE OFFICE", { fontFamily: "Galmuri11, ui-monospace, monospace", fontSize: "8px", color: "#eef0f4", fontStyle: "bold" })
        .setOrigin(0.5, 0).setResolution(4).setDepth(DEPTH.sign + 1);
      const g = this.add.graphics().setDepth(DEPTH.sign);
      g.fillStyle(0x2b2220, 1).fillRoundedRect(cx - logo.width / 2 - 9, y - 2, logo.width + 18, 13, 3);
      g.fillStyle(0xe8875a, 1).fillCircle(cx - logo.width / 2 - 4, y + 4.5, 1.5);
    }
  }

  findPath(sx: number, sy: number, ex: number, ey: number, cb: (p: { x: number; y: number }[] | null) => void) {
    this.easy.findPath(sx, sy, ex, ey, cb);
    this.easy.calculate();
  }

  ensureTextures(key: string, lookKey: string, team: Team = "dev") {
    if (this.textures.exists(key)) return;
    const tex = this.textures.addCanvas(key, makeSheet(lookFor(lookKey, team)))!;
    for (let r = 0; r < 3; r++) for (let c = 0; c < COLS; c++) tex.add(r * COLS + c, 0, c * FW, r * FH, FW, FH);
    for (const [d, r] of Object.entries(DIR_ROW))
      this.anims.create({ key: `${key}-walk-${d}`, frames: [0, 1, 2, 3].map(c => ({ key, frame: r * COLS + c })), frameRate: 7, repeat: -1 });
  }

  // ── 좌석 예약: 같은 자리에 두 명이 겹치지 않게. 꽉 차면 가까운 빈 자리 ──
  reserve(p: Poi, w: Walker) {
    const prev = this.walkers.get(this.reservedBy.get(p.name) || "");
    this.reservedBy.set(p.name, w.id);
    // 실제 세션에게 자리를 내준 배경 직원은 새 자리로
    if (prev && prev !== w && prev.npc) {
      if (prev.home === p) prev.home = this.freePoi(prev.home.kind, prev.home, prev) ?? this.freePoi("repo_desk", undefined, prev);
      if (prev.home) { prev.goTo(prev.home, "npc"); prev.nextAt = Date.now() + 30000; }
    }
  }
  release(w: Walker) { for (const [k, v] of this.reservedBy) if (v === w.id) this.reservedBy.delete(k); }
  freePoi(kind: string, near?: { tx: number; ty: number }, w?: Walker): Poi | null {
    const free = (p: Poi) => { const r = this.reservedBy.get(p.name); return !r || r === w?.id || (!!w && !w.npc && !!this.walkers.get(r)?.npc); };
    const d = (p: Poi) => near ? Math.abs(p.tx - near.tx) + Math.abs(p.ty - near.ty) : 0;
    const same = this.pois.filter(p => p.kind === kind && free(p)).sort((a, b) => d(a) - d(b));
    if (same.length) return same[0];
    // 같은 종류가 꽉 찼으면 그 종류 첫 자리 근처의 아무 빈 자리
    const anchor = this.pois.find(p => p.kind === kind);
    if (!anchor) return null;
    const da = (p: Poi) => Math.abs(p.tx - anchor.tx) + Math.abs(p.ty - anchor.ty);
    return this.pois.filter(p => p.kind !== "entrance" && free(p)).sort((a, b) => da(a) - da(b))[0] ?? null;
  }

  // ── 세션 → 구역 (설정 기반) ──
  inStandup(now = new Date()) {
    const m = now.getHours() * 60 + now.getMinutes();
    return this.cfg.standup.times.some(t => { const [h, mm] = t.split(":").map(Number); const s = h * 60 + mm; return m >= s && m < s + this.cfg.standup.durationMin; });
  }
  zoneOf(s: Session) {
    const k = stateKey(s), z = this.cfg.zones;
    let zone = z[k] || "meet";
    if (s.state === "working") {
      const tool = (s.toolFull || s.tool || "").toLowerCase();
      for (const [kw, zz] of Object.entries(this.cfg.tripKeywords)) if (!kw.startsWith("_") && tool.includes(kw.toLowerCase())) { zone = zz; break; }
    }
    if (this.inStandup() && k !== "waiting" && k !== "sleep") zone = "standup";
    return zone;
  }

  spawn(id: string, lookKey: string, junior = false, parentId = "", team: Team = "dev") {
    const key = "emp-" + team + hash(lookKey);
    this.ensureTextures(key, lookKey, team);
    const w = new Walker(this, id, key, this.entrance.tx, this.entrance.ty, junior, parentId);
    this.walkers.set(id, w);
    return w;
  }
  // ── 잡담: 일 안 하는 직원 둘이 마주 보는 자리로 가서 몇 마디 주고받음 ──
  convs: { a: Walker; b: Walker; lines: string[]; i: number; nextAt: number; started: number }[] = [];
  pairs: [Poi, Poi][] | null = null;
  chatPairs() {
    if (this.pairs) return this.pairs;
    const by = (n: string) => this.pois.find(p => p.name === n);
    const out: [Poi, Poi][] = [];
    for (let k = 1; by(`cafe_seat_${2 * k}`); k++) out.push([by(`cafe_seat_${2 * k - 1}`)!, by(`cafe_seat_${2 * k}`)!]);   // 탕비실 테이블 마주 보기
    for (let i = 1; i <= 4; i++) { const a = by(`meeting_seat_${i}`), b = by(`meeting_seat_${i + 4}`); if (a && b) out.push([a, b]); }   // 회의 테이블 건너편
    for (const [a, b] of [["sofa_1", "sofa_2"], ["standup_2", "standup_3"], ["standup_4", "standup_5"]]) if (by(a) && by(b)) out.push([by(a)!, by(b)!]);
    return (this.pairs = out);
  }
  chats() {
    const now = Date.now();
    const end = (c: (typeof this.convs)[number]) => {
      for (const w of [c.a, c.b]) { w.inChat = false; w.nextAt = now + 800 + Math.random() * 2000; }
      this.convs = this.convs.filter(x => x !== c);
    };
    for (const c of [...this.convs]) {
      if (!this.walkers.has(c.a.id) || !this.walkers.has(c.b.id)) { end(c); continue; }
      const ready = [c.a, c.b].every(w => !w.walking && w.target && w.tx === w.target.tx && w.ty === w.target.ty);
      if (!ready) { if (now - c.started > 45000) end(c); continue; }
      if (now < c.nextAt) continue;
      if (c.i < c.lines.length) { (c.i % 2 ? c.b : c.a).say(c.lines[c.i], 2700); c.i++; c.nextAt = now + 3000; }
      else end(c);
    }
    if (this.convs.length >= 2 || Math.random() > 0.15) return;
    const idle = [...this.walkers.values()].filter(w => w.npc && !w.inChat && !w.walking && w.home && w.target === w.home);
    if (idle.length < 2) return;
    const free = this.chatPairs().filter(([p, q]) => !this.reservedBy.get(p.name) && !this.reservedBy.get(q.name));
    if (!free.length) return;
    const a = idle.splice(Math.floor(Math.random() * idle.length), 1)[0], b = idle[Math.floor(Math.random() * idle.length)];
    const [p, q] = free[Math.floor(Math.random() * free.length)];
    for (const [w, spot] of [[a, p], [b, q]] as const) {
      const home = w.home!;
      w.goTo(spot, "npc"); if (!this.reservedBy.get(home.name)) this.reserve(home, w);
      w.inChat = true; w.task = "동료와 잡담 중";
    }
    this.convs.push({ a, b, lines: CHATS[Math.floor(Math.random() * CHATS.length)], i: 0, nextAt: 0, started: now });
  }

  // ── 배경 직원: 사무실이 북적이게. 실제 세션과 별개로 자리에서 일하다 가끔 볼일 보러 다님 ──
  ambient() {
    const want = Math.max(0, this.cfg.ambientStaff ?? 16);
    const npcs = [...this.walkers.values()].filter(w => w.npc);
    const HOMES: { kind: string; team: Team; nick: string; max: number }[] = [
      { kind: "repo_desk", team: "gh", nick: "깃돌이", max: 99 }, { kind: "plan_desk", team: "dev", nick: "기획이", max: 5 },
      { kind: "research_desk", team: "dev", nick: "연구리", max: 5 }, { kind: "seat_dev", team: "dev", nick: "개발이", max: 3 },
    ];
    for (let i = npcs.length; i < want; i++) {
      const h = HOMES[i % 4];
      const used = [...this.walkers.values()].filter(w => w.npc && w.home?.kind === h.kind).length;
      const spec = used >= h.max ? HOMES[0] : h;
      const seat = this.pois.filter(p => p.kind === spec.kind && !this.reservedBy.get(p.name));
      if (!seat.length) break;
      const home = seat[(i * 5 + 1) % seat.length];
      const w = this.spawn(`npc-${i}`, `npc-${i}-${spec.kind}`, false, "", spec.team);
      w.npc = true; w.home = home; w.zone = "npc";
      w.sprite.setTint(0xcfc4b8).setAlpha(0.92);   // 실제 세션이 돋보이도록 살짝 바래게
      w.sprite.setPosition(home.tx * TILE + TILE / 2, home.ty * TILE + TILE - 1); w.tx = home.tx; w.ty = home.ty;   // 처음엔 이미 출근해 있음
      w.target = home; this.reserve(home, w); w.arrivedAt = Date.now();
      w.nextAt = Date.now() + 15000 + Math.random() * 60000;
      w.tag.setVisible(false); w.tag.setAlpha(0);
      w.name = spec.nick; w.task = this.deskTask(w);
    }
    for (const w of npcs.slice(want)) { this.release(w); w.destroy(); this.walkers.delete(w.id); }
    // 볼일 보기 / 자리로 돌아오기
    const now = Date.now();
    const ERRANDS: [string, string][] = [["coffee_machine", "커피 타는 중"], ["cafe_seat", "잠깐 쉬는 중"], ["bookshelf", "자료 찾는 중"],
      ["server_rack", "서버 점검 중"], ["standup", "화이트보드 정리 중"], ["meeting_seat", "짧은 회의 중"], ["sofa", "로비에서 통화 중"]];
    for (const w of npcs) {
      if (w.walking || w.inChat || now < w.nextAt || !w.home) continue;
      if (w.target === w.home) {
        if (Math.random() < 0.5) { w.nextAt = now + 10000 + Math.random() * 30000; continue; }   // 계속 일함
        const [kind, task] = ERRANDS[Math.floor(Math.random() * ERRANDS.length)];
        const p = this.freePoi(kind, w.home, w);
        if (!p || p.kind !== kind) { w.nextAt = now + 15000; continue; }
        const home = w.home;
        w.goTo(p, "npc"); if (!this.reservedBy.get(home.name)) this.reserve(home, w);   // 자리는 비워두지 않음
        w.task = task; w.nextAt = now + 7000 + Math.random() * 10000;
      } else {
        let home: Poi | null = w.home;
        if (this.reservedBy.get(home.name) && this.reservedBy.get(home.name) !== w.id) home = this.freePoi(home.kind, home, w);
        if (!home) continue;
        w.home = home; w.goTo(home, "npc"); w.task = this.deskTask(w);
        w.nextAt = now + 25000 + Math.random() * 45000;
      }
    }
  }
  deskTask(w: Walker) {
    const T: Record<string, string[]> = {
      repo_desk: ["PR 리뷰 중", "이슈 정리 중", "CI 로그 보는 중", "커밋 메시지 고민 중", "릴리스 노트 쓰는 중"],
      plan_desk: ["기획서 쓰는 중", "일정 정리 중", "회의록 정리 중", "요구사항 정리 중"],
      research_desk: ["논문 읽는 중", "실험 노트 쓰는 중", "데이터 정리 중", "그래프 그리는 중"],
      seat_dev: ["버그 고치는 중", "테스트 돌리는 중", "리팩터링 중", "코드 리뷰 중"],
    };
    const list = T[w.home?.kind || "repo_desk"] || T.repo_desk;
    return list[hash(w.id + Math.floor(Date.now() / 60000)) % list.length];
  }

  leave(w: Walker) {
    if (w.leaving) return;
    w.leaving = true; this.release(w); w.setIcon("");
    w.target = this.entrance;
    this.findPath(w.tx, w.ty, this.entrance.tx, this.entrance.ty, (p) => { w.path = p ? p.slice(1) : []; });
  }

  sendFirstTo(zone: string) {
    const w = [...this.walkers.values()].find(x => !x.junior && !x.leaving && !x.npc);
    if (!w) return;
    w.manualUntil = Date.now() + 30000;
    w.goTo(this.freePoi(ZONE_POI[zone], w, w), zone);
  }

  async poll() {
    if (!this.ready) return;
    let sessions: Session[] = [];
    try { sessions = (await (await fetch("/api/sessions")).json()).sessions; } catch { return; }
    const now = Date.now(), { minStaySec, quickToolSec } = this.cfg.debounce;
    const alive = new Set<string>();

    for (const s of sessions) {
      alive.add(s.id);
      const zone = this.zoneOf(s);
      let w = this.walkers.get(s.id);
      if (!w) {   // 새 세션: 입구에서 바로 출근
        w = this.spawn(s.id, s.project || s.id);
        w.goTo(this.freePoi(ZONE_POI[zone], undefined, w), zone);
      }
      w.session = s;
      // 이름 + 직급 (같은 프로젝트는 같은 이름, 직급은 누적 도구 호출 수)
      const rk = rankOf(s.toolCount);
      if (w.rank >= 0 && rk.index > w.rank) this.promote(w, rk.title);
      w.rank = rk.index;
      if (now < w.manualUntil) continue;

      // 디바운스: 3초 넘게 같은 상태가 이어지고, 지금 자리에 8초 이상 머물렀을 때만 이동
      if (zone === w.zone) { w.want = ""; }
      else {
        if (w.want !== zone) { w.want = zone; w.wantSince = now; }
        const stable = now - w.wantSince >= quickToolSec * 1000;
        const stayed = now - w.arrivedAt >= minStaySec * 1000;
        if (stable && stayed && !w.walking) { w.goTo(this.freePoi(ZONE_POI[zone], undefined, w), zone); w.want = ""; }
      }
      // 머리 위 아이콘: 대기 중이면 "!", 이동 보류 중이면 하려는 일의 아이콘
      if (s.state === "waiting" || (w.zone === "ceo" && !w.walking)) w.setIcon("! 확인이 필요해요", "wait");
      else if (s.state === "working") w.setIcon(twoLines(friendly(s)), "work");
      else if (s.activity === "sleep" || w.zone === "nap") w.setIcon("Zzz…", "plain");
      else if (w.want) w.setIcon(ZONE_ICON[w.want] || "");
      else w.setIcon("");
      // 탕비실에서 쉬는 세션은 가끔 혼잣말
      if (s.state === "idle" && w.zone === "cafe" && !w.walking && Math.random() < 0.025) w.say(SOLO[Math.floor(Math.random() * SOLO.length)], 3000);
      // 이름표: 상태 색 배지
      w.tag.setBackgroundColor(s.state === "working" ? "#e8875a" : s.state === "waiting" ? "#ffd166" : "#5a4a44")
        .setColor(s.state === "idle" ? "#f6ead2" : "#2a1d1c").setStroke("#2a1d1c", s.state === "idle" ? 2 : 0).setPadding(3, 1, 3, 1);

      // 서브에이전트: 부모 옆자리의 주니어
      const want = Math.min(this.cfg.maxSubagentsShown, s.activeSubagents || 0);
      const juniors = [...this.walkers.values()].filter(j => j.junior && j.parentId === s.id && !j.leaving);
      for (let i = juniors.length; i < want; i++) {
        const j = this.spawn(`${s.id}#jr${i}`, `${s.project || s.id}#jr${i}`, true, s.id);

        juniors.push(j);
      }
      juniors.forEach((j, i) => {
        if (i >= want) { this.leave(j); return; }
        if (j.walking) return;
        const anchor = w!.target ?? w!;
        // 부모 자리와 같은 종류에서 가장 가까운 빈 자리 = 옆자리
        if (j.zone !== w!.zone || !j.target || j.target === this.entrance)
          j.goTo(this.freePoi(w!.target?.kind || ZONE_POI[w!.zone], anchor, j), w!.zone);
      });
      for (const j of juniors) alive.add(j.id);
    }
    // 끝난 세션·서브에이전트는 입구로 퇴근
    for (const w of this.walkers.values()) if (!w.npc && !alive.has(w.id) && !w.leaving) this.leave(w);
    this.ambient();
    this.chats();
    this.renameAll();

    const working = sessions.filter(s => s.state === "working").length, waiting = sessions.filter(s => s.state === "waiting").length;
    const jr = [...this.walkers.values()].filter(j => j.junior && !j.leaving).length;
    this.renderGuide(sessions);
    this.hud.innerHTML = `<b>직원 ${sessions.length}명</b> · 일하는 중 ${working} · 결재 대기 ${waiting}${jr ? ` · 인턴 ${jr}` : ""}` +
      `${this.inStandup() ? " · <b>스탠드업 중</b>" : ""} <span>· 스탠드업 ${this.cfg.standup.times.join(", ")} · 맵: ${this.hud.dataset.source}</span>`;
  }

  /** 말풍선 내용: 누가 · 어느 부서 · 지금 무엇을 */
  hover(w: Walker) {
    if (w.npc) {
      const moving = w.walking ? " <i>이동 중</i>" : "";
      showBubble(this, () => ({ x: w.sprite.x, y: w.sprite.y - FH - 2 }), `<b>${esc(w.name)}</b><span class="zone">배경 직원</span>${moving}<div>${esc(w.task)}</div><small>실제 Claude 세션이 아니에요</small>`);
      return;
    }
    const parent = w.junior ? this.walkers.get(w.parentId)?.session : null;
    const s = w.session ?? parent ?? null;
    const zone = ZONE_NAME[w.zone] || "";
    let doing: string;
    if (w.leaving) doing = "퇴근하는 중";
    else if (w.junior) doing = `서브에이전트 · "${esc(parent?.title || "")}" 일을 돕는 중`;
    else if (!s) doing = "-";
    else if (s.state === "waiting") doing = "내 승인·대답을 기다리는 중";
    else if (s.state === "idle") doing = s.activity === "sleep" ? "오래 쉬는 중 (잠)" : "작업 끝내고 쉬는 중";
    else doing = esc(friendly(s));
    const moving = w.walking && !w.leaving ? ` <i>→ ${esc(zone)}${ro(zone)} 이동 중</i>` : "";
    const title = w.junior ? "인턴" : rankOf(s?.toolCount).title;
    const role = ROLE[w.zone] || zone;
    const sub = w.junior ? `${esc(this.walkers.get(w.parentId)?.name || "")} 옆 서브에이전트` : esc(s?.title || "");
    showBubble(this, () => ({ x: w.sprite.x, y: w.sprite.y - FH * w.sprite.scaleY - 2 }),
      `<b>${esc(w.name)} ${title}</b><span class="zone">${esc(role)}</span>${moving}<div>${doing}</div>` +
      `<small>${sub}${s?.updated ? ` · ${ago(s.updated)}` : ""}${!w.junior && s?.toolCount != null ? ` · 도구 ${s.toolCount}회` : ""}</small>`);
  }

  /** 역할 별명 붙이기: 부서별 "개발이", 같은 부서에 여럿이면 개발이2… 인턴은 "꼬마" + 부모 별명 */
  renameAll() {
    const ws = [...this.walkers.values()].filter(w => !w.leaving && !w.npc).sort((a, b) => a.id.localeCompare(b.id));
    const seen: Record<string, number> = {};
    for (const w of ws.filter(x => !x.junior)) {
      const base = NICK[w.zone] || "직원", k = (seen[base] = (seen[base] || 0) + 1);
      w.name = k > 1 ? `${base}${k}` : base;
      w.tag.setText(`${w.name} ${rankOf(w.session?.toolCount).title}`);
    }
    for (const j of ws.filter(x => x.junior)) {
      j.name = `꼬마${this.walkers.get(j.parentId)?.name || "직원"}`;
      j.tag.setText(`${j.name} 인턴`);
    }
  }

  /** 승진 순간: 반짝이 + "승진!" */
  promote(w: Walker, title: string) {
    const x = w.sprite.x, y = w.sprite.y - FH - 4;
    const t = this.add.text(x, y, `${title} 승진!`, { fontFamily: "Galmuri11, ui-monospace, monospace", fontSize: "7px", color: "#2a1d1c", backgroundColor: "#ffd98a", padding: { x: 3, y: 1 } })
      .setOrigin(0.5, 1).setResolution(4).setDepth(DEPTH.icon + 1);
    this.tweens.add({ targets: t, y: y - 10, alpha: 0, delay: 1600, duration: 900, onComplete: () => t.destroy() });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, sp = this.add.rectangle(x, y + 8, 2, 2, i % 2 ? 0xffd98a : 0xf6ead2).setDepth(DEPTH.icon);
      this.tweens.add({ targets: sp, x: x + Math.cos(a) * 14, y: y + 8 + Math.sin(a) * 10, alpha: 0, duration: 900, onComplete: () => sp.destroy() });
    }
  }

  update(_t: number, dms: number) {
    placeBubble();
    for (const w of [...this.walkers.values()]) {
      w.update(dms / 1000);
      if (w.leaving && !w.walking && w.tx === this.entrance.tx && w.ty === this.entrance.ty) { w.destroy(); this.walkers.delete(w.id); }
    }
  }
}
