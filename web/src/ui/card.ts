import { phraseDetail } from "../scenes/OfficeScene";   // 명령어 대신 읽기 쉬운 말
// 사원증 카드: 직원을 클릭하면 뜬다 (별명·직급·입사일·오늘 끝낸 작업·최근 작업 5개)
import { esc, ago } from "./bubble";
import { hpColor } from "./members";

export interface CardInfo { id: string; name: string; rank: string; role: string; dept: string; color: string; spriteKey: string; scene: Phaser.Scene; title: string; hp?: number | null; lv?: number | null; friend?: string }

export async function showCard(info: CardInfo) {
  const root = document.getElementById("card")!;
  let data: { firstSeen?: number; project?: string; doneToday?: number; recent?: { t: number; text: string }[] } = {};
  try { const r = await fetch(`/api/employee?id=${encodeURIComponent(info.id)}`); if (r.ok) data = await r.json(); } catch { /* */ }
  const since = data.firstSeen ? new Date(data.firstSeen).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" }) : "-";
  root.innerHTML = `
    <div class="badge" style="--c:${info.color}">
      <div class="strap"></div>
      <div class="top"><span>CLAUDE OFFICE</span><span>${esc(info.dept)}</span></div>
      <div class="body">
        <canvas width="64" height="96"></canvas>
        <div class="who"><b>${esc(info.name)}</b><em>${esc(info.rank)}</em>${info.lv != null ? `<em class="lv">Lv.${info.lv}</em>` : ""}<span>${esc(info.role)}</span></div>
      </div>
      ${info.hp != null ? `<div class="hprow" title="HP = 이 세션의 남은 컨텍스트(대화 공간). 빨갛게 되면 새 세션을 여는 게 좋아요">
        <b>HP</b><span><i style="width:${Math.max(3, info.hp)}%;background:${hpColor(info.hp)}"></i></span><small>${info.hp}%${info.hp <= 20 ? " · 새 세션 권장" : ""}</small></div>` : ""}
      <dl>
        <dt>담당</dt><dd>${esc(info.title)}</dd>
        <dt>입사일</dt><dd>${since}</dd>
        <dt>오늘 끝낸 작업</dt><dd><strong>${data.doneToday ?? 0}</strong>건</dd>
        ${info.friend ? `<dt>친한 동료</dt><dd>${esc(info.friend)}</dd>` : ""}
      </dl>
      <h4>최근 작업</h4>
      <ol>${(data.recent || []).map(r => `<li><span>${esc(phraseDetail(r.text))}</span><small>${ago(r.t)}</small></li>`).join("") || "<li><span>아직 기록이 없어요</span></li>"}</ol>
      <div class="foot">ID ${esc(info.id.slice(0, 8))} · 클릭하거나 Esc 로 닫기</div>
    </div>`;
  // 사원증 사진: 그 직원 스프라이트의 정면 프레임을 4배로
  const cv = root.querySelector("canvas")!, ctx = cv.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const src = info.scene.textures.get(info.spriteKey).getSourceImage() as HTMLCanvasElement;
  ctx.fillStyle = "#efe2c6"; ctx.fillRect(0, 0, 64, 96);
  ctx.drawImage(src, 0, 0, 32, 32, 0, 24, 64, 64);
  root.hidden = false;
  const close = () => { root.hidden = true; window.removeEventListener("keydown", onKey); };
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
  root.onclick = close;
  window.addEventListener("keydown", onKey);
}
