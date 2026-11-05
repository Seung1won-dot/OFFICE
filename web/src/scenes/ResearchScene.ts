// B1 연구실 층: research-log 의 프로젝트마다 방 하나, 연구원 한 명.
// 기록 파일은 서버가 읽기만 하고, 화면에는 이름·상태·숫자만 온다 (경로·본문 없음).
import Phaser from "phaser";
import { MAP_FONT, fontReady } from "../ui/font";
import { TILE } from "../map/defaultMap";
import { buildResearchMap } from "../map/researchMap";
import { makeTilesetCanvas } from "../gfx/tileset";
import { DIR_ROW, hash } from "../gfx/people";
import { MW as MFW, MH as MFH, MCOLS, monsterLook, makeMonsterSheet } from "../gfx/monsters";
const FH = 28;
import { ensureGlowTexture, addSunlight, addNight, lightFromMap, addRugs, addDeskProps, addLife, sign, glow, DEPTH } from "../gfx/ambience";
import { showBubble, hideBubble, placeBubble, esc, ago } from "../ui/bubble";
import { LAB_NICK } from "../ui/names";

export interface ResearchProject {
  id: string; name: string; status: string; state: "working" | "quiet" | "sleep" | "done";
  sections: string; filled: number; cases: number; updated: number; lastMentionWeek: string | null; period: string;
}
export interface ResearchData { week: string; weeklyWritten: boolean; draftExists: boolean; overdue: boolean; publicMode: boolean; projects: ResearchProject[]; error?: string }

export const STATE_TEXT: Record<string, string> = { working: "이번 주 진행 중", quiet: "이번 주 조용함", sleep: "2주 넘게 잠잠 (잠)", done: "완료" };
export const STATE_COLOR: Record<string, string> = { working: "#86c060", quiet: "#d6a748", sleep: "#8a86b0", done: "#e8b84a" };

export function isPublicMode() { try { return localStorage.getItem("office.public") === "1"; } catch { return false; } }

export class ResearchScene extends Phaser.Scene {
  data_: ResearchData | null = null;
  layoutKey = "";
  constructor() { super("research"); }

  async create() {
    (window as any).research = this;
    await fontReady;   // 픽셀 글꼴이 준비된 뒤 글씨를 그림
    this.data_ = await this.fetchData();
    this.build();
    this.time.addEvent({ delay: 15000, loop: true, callback: () => this.refresh() });
    if (!(this as any).bound) {   // restart 때 중복 등록 방지
      (this as any).bound = true;
      window.addEventListener("resize", () => this.fit());
      new ResizeObserver(() => this.fit()).observe(document.getElementById("stage")!);
    }
    this.events.on("wake", () => { this.refresh(); this.fit(); this.renderPanel(); });
  }

  async fetchData(): Promise<ResearchData | null> {
    try { return await (await fetch(`/api/research?public=${isPublicMode() ? 1 : 0}`)).json(); } catch { return null; }
  }
  async refresh() {
    const d = await this.fetchData();
    if (!d) return;
    const key = JSON.stringify(d);
    if (key === this.layoutKey) return;
    this.data_ = d;
    this.scene.restart();   // 방 수·상태가 바뀌면 층을 다시 그림 (가볍다)
  }

  build() {
    const d = this.data_;
    this.layoutKey = JSON.stringify(d);
    const projects = d?.projects ?? [];
    if (!this.textures.exists("office-tiles")) this.textures.addCanvas("office-tiles", makeTilesetCanvas(null));
    const slots = Math.max(3, Math.ceil(projects.length / 3) * 3);   // 줄을 채우도록 빈 연구실 포함
    const key = "research-map-" + slots;
    if (!this.cache.tilemap.exists(key)) this.cache.tilemap.add(key, { format: Phaser.Tilemaps.Formats.TILED_JSON, data: buildResearchMap(slots) });
    const map = this.make.tilemap({ key });
    const ts = map.addTilesetImage("office", "office-tiles")!;
    map.createLayer("floor", ts)!.setDepth(0);
    map.createLayer("walls", ts)!.setDepth(1);
    const furn = map.createLayer("furniture", ts)!.setDepth(2);
    map.createLayer("furniture-top", ts)!.setDepth(9000);
    (this as any).map = map;

    const prop = (o: any, k: string) => o.properties?.find((p: any) => p.name === k)?.value;
    const pois = (map.getObjectLayer("objects")?.objects ?? []).map(o => ({ name: o.name!, kind: o.name!.replace(/_\d+$/, ""),
      tx: Math.floor(o.x! / TILE), ty: Math.floor(o.y! / TILE), dir: prop(o, "dir") || "down", pose: prop(o, "pose") || "stand" }));
    const rooms = (map.getObjectLayer("rooms")?.objects ?? []).map(o => ({ key: o.name!, x: o.x!, y: o.y!, w: o.width!, h: o.height! }));

    ensureGlowTexture(this);
    const rugColors: Record<string, string> = {};
    projects.forEach((p, i) => { rugColors[`lab_${i}`] = STATE_COLOR[p.state]; });
    addRugs(this, rooms, rugColors);
    addDeskProps(this, pois, ["lab_seat"]);
    lightFromMap(this, map, rooms);
    addSunlight(this, map);
    addLife(this, map);

    // 라운지 간판 + 주간 로그 게시판
    sign(this, 1 * TILE + 3, 1 * TILE + 2, "B1 연구실", "#7fd1c7");
    this.weeklyBoard(27 * TILE, 2 * TILE);

    if (!projects.length) {
      this.add.text(map.widthInPixels / 2, 11 * TILE, d?.error ? `research-log 읽기 실패: ${d.error}` : "research-log/projects/ 에 기록(.md)을 추가하면 방이 생겨요",
        { fontFamily: MAP_FONT, fontSize: "7px", color: "#f6ead2", stroke: "#2a1d1c", strokeThickness: 3 }).setOrigin(0.5).setResolution(4).setDepth(DEPTH.tag);
    }
    projects.forEach((p, i) => this.buildRoom(p, i, rooms.find(r => r.key === `lab_${i}`)!, pois));
    // 완료가 아니면 트로피 숨김
    for (let i = 0; i < slots; i++) {
      const p = projects[i];
      if (p?.state !== "done") { const t = pois.find(q => q.name === `lab_trophy_${i}`)!; furn.removeTileAt(t.tx + 1, t.ty - 1); }
      if (!p) {   // 빈 연구실
        const r = rooms.find(rr => rr.key === `lab_${i}`)!;
        sign(this, r.x + 3, r.y + 2, "빈 연구실", "#7d6c60");
        this.add.text(r.x + r.w / 2, r.y + r.h / 2 + 10, "새 프로젝트 자리", { fontFamily: MAP_FONT, fontSize: "7px", color: "#c9b8a4", stroke: "#2a1d1c", strokeThickness: 3 })
          .setOrigin(0.5).setResolution(4).setDepth(DEPTH.sign);
        this.add.rectangle(r.x, r.y, r.w, r.h, 0x120a10, 0.35).setOrigin(0).setDepth(DEPTH.night - 1);
      }
    }
    this.fit();
    this.renderPanel();
  }

  weeklyBoard(x: number, y: number) {
    const d = this.data_;
    if (!d) return;
    const ok = d.weeklyWritten, over = d.overdue;
    const text = ok ? `${d.week} 주간 로그 작성 ✓` : over ? `${d.week} 주간 로그 미작성!` : `${d.week} 주간 로그 아직`;
    const color = ok ? "#86c060" : over ? "#ff6b5a" : "#d6a748";
    const t = this.add.text(x + 32, y + 4, text, { fontFamily: MAP_FONT, fontSize: "7px", color: "#2a1d1c" }).setOrigin(0.5, 0).setResolution(4).setDepth(DEPTH.sign + 1);
    const g = this.add.graphics().setDepth(DEPTH.sign);
    g.fillStyle(Phaser.Display.Color.HexStringToColor(color).color, 1).fillRoundedRect(x + 32 - t.width / 2 - 5, y + 2, t.width + 10, 11, 3);
    if (over) this.tweens.add({ targets: [g, t], alpha: 0.45, duration: 700, yoyo: true, repeat: -1 });
    if (!ok) glow(this, x + 32, y + 8, color, 30, 0.35, 0.4);
  }

  buildRoom(p: ResearchProject, i: number, r: { x: number; y: number; w: number; h: number }, pois: { name: string; tx: number; ty: number; dir: string; pose: string }[]) {
    const accent = STATE_COLOR[p.state];
    const label = p.name.length > 16 ? p.name.slice(0, 15) + "…" : p.name;
    const s = sign(this, r.x + 3, r.y + 2, label, accent);
    // 방 정보: 섹션 n/4 · 사례 n · 수정일
    const info = `섹션 ${p.sections} · 사례 ${p.cases} · ${new Date(p.updated).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })}`;
    this.add.text(r.x + 3 + s.w + 4, r.y + 3.5, info, { fontFamily: MAP_FONT, fontSize: "7px", color: "#f6ead2", stroke: "#2a1d1c", strokeThickness: 3 })
      .setResolution(4).setDepth(DEPTH.sign);
    // 연구원 (흰 가운 + 안경). 상태에 따라 자리
    const kind = p.state === "sleep" ? "lab_sofa" : p.state === "done" ? "lab_trophy" : "lab_seat";
    const spot = pois.find(q => q.name === `${kind}_${i}`)!;
    const stage = p.state === "done" ? 2 : 1;
    const key = `labmon-${stage}-${hash(p.name)}`;
    if (!this.textures.exists(key)) {
      const tex = this.textures.addCanvas(key, makeMonsterSheet(monsterLook(p.name, "sprout", stage)))!;
      for (let rr = 0; rr < 3; rr++) for (let c = 0; c < MCOLS; c++) tex.add(rr * MCOLS + c, 0, c * MFW, rr * MFH, MFW, MFH);
    }
    const dirRow = DIR_ROW[(spot.dir === "left" ? "right" : spot.dir) as "down" | "up" | "right"];
    const sit = spot.pose !== "stand";
    const spr = this.add.sprite(spot.tx * TILE + TILE / 2, spot.ty * TILE + TILE - 1, key, dirRow * MCOLS + (sit ? 4 : 0)).setOrigin(0.5, 31 / 32);
    spr.setDepth(10 + spr.y).setFlipX(spot.dir === "left");
    if (spot.pose === "lie") spr.setAngle(-90).setPosition(spr.x + 4, spr.y - 4);
    if (p.state === "working") this.time.addEvent({ delay: 260, loop: true, callback: () => spr.setFrame(dirRow * MCOLS + (spr.frame.name === String(dirRow * MCOLS + 4) ? 5 : 4)) });   // 타자 치는 모션
    if (p.state === "done") {
      for (let k = 0; k < 3; k++) {
        const sp = this.add.rectangle(spot.tx * TILE + 22 + k * 3, spot.ty * TILE - 10 + k * 2, 1, 1, 0xfff2b0).setDepth(DEPTH.glow);
        this.tweens.add({ targets: sp, alpha: 0, duration: 600, yoyo: true, repeat: -1, delay: k * 300 });
      }
      glow(this, (spot.tx + 1) * TILE + 8, (spot.ty - 1) * TILE + 6, "#ffd98a", 18, 0.5, 0.3);
    }
    const icon = p.state === "sleep" ? "z" : p.state === "quiet" ? "…" : "";
    if (icon) {
      const t = this.add.text(spr.x, spr.y - (spot.pose === "lie" ? 14 : FH + 1), icon, { fontFamily: MAP_FONT, fontSize: "7px", color: "#2a1d1c", backgroundColor: "#f6ead2", padding: { x: 3, y: 1 } })
        .setOrigin(0.5, 1).setResolution(4).setDepth(DEPTH.icon);
      this.tweens.add({ targets: t, y: t.y - 2, duration: 1200, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    }
    // 연구원 이름표 (공개 모드에서도 가명이라 그대로 표시)
    const who = LAB_NICK[p.state] + (this.data_!.projects.filter((q, k) => k < i && q.state === p.state).length + 1 > 1
      ? this.data_!.projects.filter((q, k) => k < i && q.state === p.state).length + 1 : "");
    const rankT = p.state === "done" ? "수석연구원" : "연구원";
    this.add.text(spr.x, spr.y + 1 + (spot.pose === "lie" ? -6 : 0), `${who} ${rankT}`, { fontFamily: MAP_FONT, fontSize: "7px", color: "#f6ead2", stroke: "#2a1d1c", strokeThickness: 3 })
      .setOrigin(0.5, 0).setResolution(4).setDepth(DEPTH.tag);
    // 말풍선: 연구원 또는 방에 커서
    const html = () => {
      const pub = this.data_?.publicMode;
      return `<b>${esc(who)} ${rankT}</b><span class="zone" style="color:${accent}">${STATE_TEXT[p.state]}</span><div>${esc(p.name)} 담당</div>` +
        (pub ? "" : `<div>섹션 ${p.sections} 채움 · 시행착오 사례 ${p.cases}개</div><small>마지막 수정 ${ago(p.updated)}${p.lastMentionWeek ? ` · 주간 로그 ${p.lastMentionWeek}` : " · 주간 로그 언급 없음"}</small>`);
    };
    const pos = () => ({ x: spr.x, y: spr.y - FH - 2 });
    spr.setInteractive({ useHandCursor: true }).on("pointerover", () => showBubble(this, pos, html())).on("pointerout", () => hideBubble(this));
    const zone = this.add.zone(r.x, r.y, r.w, r.h).setOrigin(0).setInteractive().setDepth(1);
    zone.on("pointerover", () => showBubble(this, pos, html())).on("pointerout", () => hideBubble(this));
  }

  fit() {
    const map = (this as any).map as Phaser.Tilemaps.Tilemap | undefined;
    if (!map || !this.sys.isActive()) return;
    const W = map.widthInPixels, H = map.heightInPixels;
    const sb = document.getElementById("stage")!.getBoundingClientRect(), box = { width: sb.width - 16, height: sb.height - 16 };
    let z = Math.min(box.width / W, box.height / H);
    z = Math.max(0.5, Math.floor(z * 8) / 8);   // 화면을 최대한 채우기 (1/8 단위)
    this.scale.resize(Math.round(W * z), Math.round(H * z));
    this.cameras.main.setZoom(z).centerOn(W / 2, H / 2).setRoundPixels(true);
  }

  /** 부서 안내 자리에 연구실 목록 + 공개 모드 + 초안 버튼 */
  renderPanel() {
    const el = document.getElementById("research-panel");
    const d = this.data_;
    if (!el || !d) return;
    const hud = document.getElementById("hud");
    if (hud && this.sys.isActive()) hud.innerHTML = `<b>B1 연구실</b> · 프로젝트 ${d.projects.length}개 · ` +
      `${d.weeklyWritten ? "이번 주 로그 작성됨" : d.overdue ? "<em class=\"warn\">이번 주 로그 미작성!</em>" : "이번 주 로그 아직"} <span>· ${d.week}</span>`;
    el.querySelector("#research-list")!.innerHTML = d.projects.map(p =>
      `<div class="z"><i style="background:${STATE_COLOR[p.state]}"></i><div><b>${esc(p.name)}</b><span>${STATE_TEXT[p.state]}${d.publicMode ? "" : ` · 섹션 ${p.sections} · 사례 ${p.cases}`}</span></div><em class="${p.state === "working" ? "on" : ""}">${p.state === "done" ? "★" : p.state === "working" ? "ON" : "·"}</em></div>`).join("")
      || `<div class="z"><i></i><div><b>프로젝트 없음</b><span>research-log/projects/ 에 기록을 추가하세요</span></div><em>0</em></div>`;
  }

  update() { placeBubble(); }
}
