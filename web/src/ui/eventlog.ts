// 화면 아래 이벤트 로그 바: "14:02 개발이 과장 · 파일 고치는 중: server.js"
import { esc } from "./bubble";
import { settings } from "./alerts";

export interface OfficeEvent { t: number; id: string; kind: "join" | "tool" | "wait" | "done"; text: string; title: string }
type Namer = (id: string, title: string) => string;
type Phraser = (detail: string) => string;

let since = 0;
const items: OfficeEvent[] = [];

export function initLog(nameOf: Namer, phrase: Phraser) {
  const root = document.getElementById("log")!, list = root.querySelector("ul")!, btn = document.getElementById("log-toggle")!;
  const apply = () => { root.classList.toggle("open", settings.log); btn.textContent = settings.log ? "로그 접기 ▾" : "로그 ▸"; };
  btn.addEventListener("click", () => { settings.log = !settings.log; apply(); });
  apply();
  const ICON: Record<string, string> = { join: "🚪", tool: "·", wait: "!", done: "✓" };
  const render = () => {
    list.innerHTML = items.slice(-4).reverse().map(e => {
      const time = new Date(e.t).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
      const text = e.kind === "tool" ? phrase(e.text) : e.text;
      return `<li class="k-${e.kind}"><time>${time}</time><b>${esc(nameOf(e.id, e.title))}</b><i>${ICON[e.kind]}</i>${esc(text)}</li>`;
    }).join("") || `<li class="empty">아직 기록이 없어요. 세션이 일을 시작하면 여기에 흘러가요.</li>`;
  };
  const poll = async () => {
    try {
      const ev: OfficeEvent[] = await (await fetch(`/api/events?since=${since}`)).json();
      if (ev.length) { items.push(...ev); since = ev[ev.length - 1].t; if (items.length > 100) items.splice(0, items.length - 100); }
    } catch { /* 서버 꺼짐 */ }
    render();
  };
  poll(); setInterval(poll, 2000);
}
