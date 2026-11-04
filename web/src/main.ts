import Phaser from "phaser";
import { OfficeScene } from "./scenes/OfficeScene";
import { ResearchScene, isPublicMode } from "./scenes/ResearchScene";
import { hideBubble } from "./ui/bubble";

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
