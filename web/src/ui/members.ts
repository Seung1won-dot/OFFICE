// 메인 멤버 보드: 화면 위쪽에 주인공들 얼굴을 한 줄로 — 일하는 아이는 밝게(+상태), 쉬는 아이는 흐리게.
// 주인공 그림(skins/main)이 없으면 지금 일하는 세션 직원들을 보여 준다. 카드를 누르면 사원증.
// 얼굴 아래 HP 바 = 그 세션의 남은 컨텍스트(초록 → 노랑 → 빨강), 왼쪽 위 Lv = 누적 도구 호출 수로 오르는 레벨.

export interface Member {
  id: string; name: string;
  tex: CanvasImageSource | null;   // 스프라이트 시트 (첫 칸 32x32 = 정면)
  state: "work" | "wait" | "done" | "rest";
  text: string;
  hp?: number | null;   // 남은 컨텍스트 % (세션이 없거나 모르면 null)
  lv?: number | null;
  tip?: string;
  onClick: () => void;
}

const CSS = `
#members { position: absolute; top: 8px; left: 10px; right: 10px; z-index: 6; display: flex; flex-direction: column; align-items: center; pointer-events: none; }
#members .row { display: flex; flex-wrap: wrap; justify-content: center; gap: 5px; padding: 6px 8px; pointer-events: auto;
  background: rgba(251,243,226,.86); border: var(--pop-border); border-radius: var(--pop-radius); box-shadow: var(--pop-shadow); }
#members.closed .row { display: none; }
#members .m { width: 58px; display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 3px 2px 4px; border-radius: 8px; cursor: pointer;
  color: var(--pop-ink); font-size: 10px; line-height: 1.15; position: relative; transition: background .2s, opacity .3s, filter .3s; }
#members .m:hover { background: rgba(232,135,90,.16); }
#members .m canvas { width: 40px; height: 40px; image-rendering: pixelated; border-radius: 50%; background: #efe2c6; box-shadow: inset 0 0 0 2px #e6d8bd; }
#members .m b { font-weight: normal; max-width: 60px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#members .m small { color: var(--pop-muted); max-width: 60px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 9px; }
#members .m.rest { opacity: .5; filter: saturate(.5); }
#members .m.work canvas { box-shadow: inset 0 0 0 2px #ff9a5a, 0 0 0 2px rgba(255,154,90,.35); animation: mpulse 1.6s ease-in-out infinite; }
#members .m.wait canvas { box-shadow: inset 0 0 0 2px #ffd166, 0 0 0 3px rgba(255,209,102,.6); animation: mpulse .9s ease-in-out infinite; }
#members .m.done canvas { box-shadow: inset 0 0 0 2px #86c060; }
#members .m.work small { color: #b8582f; } #members .m.wait small { color: #9a6b00; font-weight: bold; } #members .m.done small { color: #4f8a35; }
#members .m .ic { position: absolute; top: 1px; right: 6px; font-style: normal; font-size: 11px; }
#members .m.wait .ic { animation: mhop .6s ease-in-out infinite; }
#members .m .lv { position: absolute; top: 0; left: 1px; font-style: normal; font-size: 8px; line-height: 1; padding: 2px 3px 1px; border-radius: 4px;
  background: #2a1d1c; color: #ffd98a; letter-spacing: -.2px; }
#members .m .lv:empty { display: none; }
#members .m .lv.up { animation: lvup 1.8s ease-out; }
#members .m .hp { display: flex; align-items: center; gap: 2px; height: 6px; margin: 1px 0 0; }
#members .m .hp em { font-style: normal; font-size: 7px; line-height: 1; color: #f2b84b; background: #2a1d1c; padding: 0 2px; border-radius: 2px; }
#members .m .hp span { width: 32px; height: 4px; background: #5a4a44; border: 1px solid #2a1d1c; border-radius: 3px; overflow: hidden; }
#members .m .hp span i { display: block; height: 100%; transition: width .6s, background .6s; }
#members .m .hp.none { visibility: hidden; }
#members .m .hp.low span i { animation: hpblink .9s steps(2) infinite; }
#members-toggle { pointer-events: auto; font: inherit; font-size: 10px; color: var(--pop-ink); background: var(--pop-bg); border: var(--pop-border); border-top: 0;
  border-radius: 0 0 8px 8px; padding: 0 8px; cursor: pointer; opacity: .75; }
#members.closed #members-toggle { border-top: var(--pop-border); border-radius: 8px; }
@keyframes mpulse { 50% { transform: scale(1.06); } }
@keyframes mhop { 50% { transform: translateY(-3px); } }
@keyframes hpblink { 50% { opacity: .3; } }
@keyframes lvup { 0% { transform: scale(1.7); background: #ffd166; color: #2a1d1c; } 60% { transform: scale(1.15); background: #ffd166; color: #2a1d1c; } 100% { transform: scale(1); } }
`;

/** RPG식 HP 색: 절반 넘으면 초록, 5분의 1 넘으면 노랑, 그 아래는 빨강 */
export const hpColor = (hp: number) => (hp > 50 ? "#58c46a" : hp > 20 ? "#f2c84b" : "#e8574a");

const ICON: Record<Member["state"], string> = { work: "", wait: "❗", done: "✨", rest: "" };
type Card = { el: HTMLElement; cv: HTMLCanvasElement; name: HTMLElement; text: HTMLElement; icon: HTMLElement; lv: HTMLElement; hp: HTMLElement; bar: HTMLElement; tex: CanvasImageSource | null; lvNum: number | null };
let root: HTMLElement | null = null, row: HTMLElement | null = null, lastSig = "";
const cards = new Map<string, Card>();

function ensure() {
  if (root) return;
  const st = document.createElement("style"); st.textContent = CSS; document.head.append(st);
  root = document.createElement("div"); root.id = "members";
  row = document.createElement("div"); row.className = "row";
  const tg = document.createElement("button"); tg.id = "members-toggle";
  const closed = (() => { try { return localStorage.getItem("office.members") === "0"; } catch { return false; } })();
  const sync = () => { tg.textContent = root!.classList.contains("closed") ? "멤버 보기 ▾" : "접기 ▴"; };
  if (closed) root.classList.add("closed");
  tg.onclick = () => { root!.classList.toggle("closed"); sync(); try { localStorage.setItem("office.members", root!.classList.contains("closed") ? "0" : "1"); } catch { /* */ } };
  sync();
  root.append(row, tg);
  document.getElementById("stage")!.append(root);
  if (onResize) new ResizeObserver(() => onResize?.()).observe(root);
}

/** 지도 위쪽에서 비워 둘 높이 (보드가 접혀 있거나 없으면 접기 버튼만큼) */
export function membersHeight() { return root && root.style.display !== "none" && root.style.visibility !== "hidden" ? root.offsetHeight + 6 : 0; }
let onResize: (() => void) | null = null;
export function onMembersResize(f: () => void) { onResize = f; if (root) new ResizeObserver(() => onResize?.()).observe(root); }

export function hideMembers(hidden: boolean) { if (root) root.style.display = hidden ? "none" : ""; }

function make(): Card {
  const el = document.createElement("div"); el.className = "m";
  const cv = document.createElement("canvas"); cv.width = 32; cv.height = 32;
  const name = document.createElement("b"), text = document.createElement("small"), icon = document.createElement("i");
  icon.className = "ic";
  const lv = document.createElement("em"); lv.className = "lv";
  const hp = document.createElement("div"); hp.className = "hp none";
  const label = document.createElement("em"); label.textContent = "HP";
  const track = document.createElement("span"), bar = document.createElement("i");
  track.append(bar); hp.append(label, track);
  el.append(cv, hp, name, text, icon, lv);
  return { el, cv, name, text, icon, lv, hp, bar, tex: null, lvNum: null };
}

export function renderMembers(list: Member[]) {
  ensure();
  root!.style.visibility = list.length ? "" : "hidden";
  const sig = list.map(m => m.id).join("|");
  if (sig !== lastSig) {   // 구성이 바뀌었을 때만 카드를 다시 배치
    lastSig = sig;
    row!.textContent = "";
    for (const m of list) {
      let c = cards.get(m.id);
      if (!c) { c = make(); cards.set(m.id, c); }
      row!.append(c.el);
    }
  }
  for (const m of list) {
    const c = cards.get(m.id)!;
    c.el.className = `m ${m.state}`;
    c.el.onclick = m.onClick;
    c.el.title = m.tip || `${m.name} · ${m.text}`;
    c.name.textContent = m.name;
    c.text.textContent = m.text.replace("곰곰이 생각하는 중", "생각 중");
    c.icon.textContent = ICON[m.state];
    // 레벨: 오르는 순간 한 번 반짝
    const lv = m.lv ?? null;
    c.lv.textContent = lv != null ? `Lv.${lv}` : "";
    if (lv != null && c.lvNum != null && lv > c.lvNum) { c.lv.classList.remove("up"); void c.lv.offsetWidth; c.lv.classList.add("up"); }
    c.lvNum = lv;
    // HP 바
    const hp = m.hp ?? null;
    c.hp.className = `hp${hp == null ? " none" : hp <= 20 ? " low" : ""}`;
    if (hp != null) { c.bar.style.width = `${Math.max(3, Math.min(100, hp))}%`; c.bar.style.background = hpColor(hp); }
    if (m.tex && m.tex !== c.tex) {   // 얼굴: 시트 첫 칸(정면 서 있는 모습)
      c.tex = m.tex;
      const g = c.cv.getContext("2d")!; g.imageSmoothingEnabled = false; g.clearRect(0, 0, 32, 32);
      g.drawImage(m.tex, 0, 0, 32, 32, 0, 2, 32, 32);
    }
  }
}
