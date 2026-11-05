import Phaser from "phaser";
import "./ui/font";   // 픽셀 글꼴 미리 불러오기
import { OfficeScene } from "./scenes/OfficeScene";
import { ResearchScene, isPublicMode } from "./scenes/ResearchScene";
import { hideBubble } from "./ui/bubble";
import { settings, audio, enableDesktop } from "./ui/alerts";
import { initLog } from "./ui/eventlog";
import { phraseDetail } from "./scenes/OfficeScene";
import { rankOf } from "./ui/names";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#1c1517",
  pixelArt: true,          // nearest-neighbor
  roundPixels: true,
  fps: { target: 30, limit: 30 },   // 상시 표시 저전력
  scale: { mode: Phaser.Scale.NONE, width: 640, height: 480 },
  scene: [OfficeScene, ResearchScene],
});
(window as unknown as { __office: Phaser.Game }).__office = game;   // 성능 점검·디버깅용

// ── 층 전환 탭: 1F 사무실 / B1 연구실 ──
let floor: "office" | "research" = "office";
function go(next: "office" | "research") {
  if (next === floor) return;
  hideBubble();
  const sm = game.scene;
  sm.sleep(floor);
  if (sm.isSleeping(next)) sm.wake(next); else sm.start(next);
  floor = next;
  document.querySelectorAll<HTMLButtonElement>("#floors button").forEach(b => b.classList.toggle("on", b.dataset.floor === next));
  document.getElementById("zones-panel")!.hidden = next !== "office";
  document.getElementById("research-panel")!.hidden = next !== "research";
  try { localStorage.setItem("office.floor", next); } catch { /* 저장 안 돼도 됨 */ }
}
document.querySelectorAll<HTMLButtonElement>("#floors button").forEach(b => b.addEventListener("click", () => go(b.dataset.floor as any)));
window.addEventListener("keydown", (e) => { if (e.key === "Tab") { e.preventDefault(); go(floor === "office" ? "research" : "office"); } });

// ── 공개 모드 (프로젝트명 익명화) ──
const pub = document.getElementById("public-toggle") as HTMLInputElement;
pub.checked = isPublicMode();
pub.addEventListener("change", () => {
  try { localStorage.setItem("office.public", pub.checked ? "1" : "0"); } catch { /* */ }
  const r = game.scene.getScene("research") as ResearchScene;
  if (r.sys.settings.status) r.refresh();
});

// ── 주간 초안 생성 (수동) ──
const btn = document.getElementById("draft-btn") as HTMLButtonElement, out = document.getElementById("draft-out")!;
btn.addEventListener("click", async () => {
  btn.disabled = true; out.textContent = "만드는 중…";
  try {
    const r = await (await fetch("/api/research/draft", { method: "POST" })).json();
    out.textContent = r.error ? `실패: ${r.error}` : `${r.file} 저장 (프로젝트 ${r.projects}개 · 세션 ${r.sessions}개${r.unmatched ? ` · 미연결 ${r.unmatched}개` : ""})`;
  } catch (e) { out.textContent = "실패: 서버 연결 확인"; }
  btn.disabled = false;
});

// 처음 시작할 때 마지막으로 보던 층 (오피스가 먼저 준비된 뒤)
setTimeout(() => { try { if (localStorage.getItem("office.floor") === "research") go("research"); } catch { /* */ } }, 1500);

// ── 부서 연결 상태 (collector): 켜짐 / 부재중(토큰·경로 없음) / 꺼짐 ──
async function renderCollectors() {
  const el = document.getElementById("collectors");
  if (!el) return;
  try {
    const list: { name: string; title?: string; state: string; reason?: string }[] = await (await fetch("/api/collectors")).json();
    const extra: Record<string, string> = {};
    for (const n of ["notion", "obsidian"]) {
      if (!list.some(c => c.name === n && c.state === "on")) continue;
      try { const d = await (await fetch(`/api/${n}`)).json(); if (d.status === "ok") extra[n] = ` · 오늘 수정 ${d.editedToday}`; } catch { /* */ }
    }
    const label: Record<string, string> = { on: "●", off: "꺼짐", absent: "부재중", error: "오류" };
    el.innerHTML = "연결 상태: " + list.map(c => `<span class="c-${c.state}" title="${(c.reason || "").replace(/"/g, "")}">${(c.title || c.name).replace(/ \(.*\)/, "")} ${label[c.state] || c.state}${extra[c.name] || ""}</span>`).join(" · ");
  } catch { el.textContent = ""; }
}
renderCollectors(); setInterval(renderCollectors, 60000);

// ── 오른쪽 위 버튼: 알림(소리+데스크톱) / 타자 소리 ──
function bindToggle(id: string, key: "alerts" | "typing", onLabel: string, offLabel: string, onEnable?: () => void) {
  const b = document.getElementById(id) as HTMLButtonElement;
  const paint = () => { b.classList.toggle("on", settings[key]); b.textContent = settings[key] ? onLabel : offLabel; };
  b.addEventListener("click", () => { settings[key] = !settings[key]; if (settings[key]) { audio(); onEnable?.(); } paint(); });
  paint();
}
bindToggle("btn-alerts", "alerts", "🔔 알림 켬", "🔕 알림 끔", () => { enableDesktop(); });
bindToggle("btn-typing", "typing", "⌨ 타자 소리 켬", "⌨ 타자 소리 끔");
// 브라우저 정책: 아무 곳이나 한 번 누르면 소리 준비
window.addEventListener("pointerdown", () => audio(), { once: true });

// ── 이벤트 로그: 세션 id → 지금 별명 + 직급 ──
initLog((id, title) => {
  const o = game.scene.getScene("office") as OfficeScene;
  const w = o?.walkers?.get(id);
  return w ? `${w.name} ${rankOf(w.session?.toolCount).title}` : title;
}, phraseDetail);

// ── 층 자동 전환 (config.json research.floorRotateSec, 0 이면 끔). 최근 30초 안에 화면을 만졌으면 쉬기 ──
let touchedAt = 0;
window.addEventListener("pointermove", () => { touchedAt = Date.now(); });
(async () => {
  let sec = 0;
  try { sec = Number((await (await fetch("/api/config")).json()).research?.floorRotateSec) || 0; } catch { /* */ }
  if (sec > 0) setInterval(() => { if (Date.now() - touchedAt > 30000) go(floor === "office" ? "research" : "office"); }, sec * 1000);
})();

// ── 개발용: /?export-map → 코드로 만든 맵을 Tiled 파일(web/public/maps/office.tmj + 타일셋 png)로 저장 ──
if (new URLSearchParams(location.search).has("export-map")) {
  (async () => {
    const { buildDefaultMap } = await import("./map/defaultMap");
    const { makeTilesetCanvas } = await import("./gfx/tileset");
    const r = await fetch("/api/export-map", { method: "POST", body: JSON.stringify({ tmj: buildDefaultMap(), png: makeTilesetCanvas(null).toDataURL("image/png") }) });
    const j = await r.json();
    document.getElementById("hud")!.textContent = j.saved ? `Tiled 맵 저장: ${j.saved.join(", ")}` : `저장 실패: ${j.error}`;
  })();
}

// ── 개발용: /?monster-sheet → 몬스터 직원 미리보기 시트를 data/screens/monster-sheet.png 로 저장 ──
if (new URLSearchParams(location.search).has("monster-sheet")) {
  (async () => {
    const { makePreviewSheet } = await import("./gfx/monsters");
    const url = makePreviewSheet().toDataURL("image/png");
    const r = await fetch("/api/snapshot?name=monster-sheet", { method: "POST", body: url });
    document.getElementById("hud")!.textContent = `미리보기 저장: ${(await r.json()).saved}`;
  })();
}

// ── 부서 안내 창: 상단 버튼 또는 H 키로 열고 닫기 ──
const guide = document.getElementById("guide")!, gbtn = document.getElementById("btn-guide")!;
function toggleGuide(open = !guide.classList.contains("open")) { guide.classList.toggle("open", open); gbtn.classList.toggle("on", open); }
gbtn.addEventListener("click", () => toggleGuide());
document.getElementById("guide-close")!.addEventListener("click", () => toggleGuide(false));
window.addEventListener("keydown", (e) => { if ((e.key === "h" || e.key === "H" || e.key === "ㅗ") && !(e.target instanceof HTMLInputElement)) toggleGuide(); });

// ── /?skin-preview → 개인용 스킨 그림이 배경 지우기 후 어떻게 보이는지 한 화면에 (원본 · 다듬은 그림 · 32px 실제 크기) ──
if (new URLSearchParams(location.search).has("skin-preview")) {
  import("./gfx/skins").then(async ({ loadSkins, prepare, skinName }) => {
    const set = await loadSkins();
    const imgs = set ? [...set.all, ...Object.values(set.by).flat()] : [];
    const box = document.createElement("div");
    box.style.cssText = "position:fixed;inset:0;z-index:99;overflow:auto;background:#d8c9a8;display:flex;flex-wrap:wrap;gap:8px;padding:12px;font:11px Galmuri11,sans-serif";
    for (const im of imgs) {
      const c = prepare(im, set!.crop), s = Math.min(96 / c.width, 96 / c.height), t = Math.min(30 / c.width, 30 / c.height);
      const cell = document.createElement("div"); cell.style.cssText = "background:#8f94a8;padding:4px;text-align:center;width:150px";
      const big = document.createElement("canvas"); big.width = Math.round(c.width * s); big.height = Math.round(c.height * s);
      big.getContext("2d")!.drawImage(c, 0, 0, big.width, big.height);
      const small = document.createElement("canvas"); small.width = 32; small.height = 32; small.style.cssText = "width:64px;height:64px;image-rendering:pixelated";
      small.getContext("2d")!.drawImage(c, (32 - c.width * t) / 2, 31 - c.height * t, c.width * t, c.height * t);
      cell.append(big, small, Object.assign(document.createElement("div"), { textContent: skinName(im) || "(이름 없음)" }));
      box.append(cell);
    }
    if (!imgs.length) box.textContent = "skins 폴더에 그림이 없어요";
    document.body.append(box);
  });
}
