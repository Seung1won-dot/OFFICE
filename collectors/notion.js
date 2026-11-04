// 기획팀(Notion) collector
// .env 의 NOTION_TOKEN (Internal Integration 토큰, "읽기" 권한만 켜는 것을 권장).
// 주의: Notion 은 Integration 을 "연결"한 페이지만 보인다 → 보고 싶은 페이지마다 ··· > 연결 > 내 Integration 추가.
// 최근 수정된 페이지 수와 마지막 수정 시각만 화면으로 보낸다 (제목·본문은 보내지 않음).
const https = require("https");

let state = { status: "loading", editedToday: 0, editedWeek: 0, lastEditedAt: null, error: null };
let timer = null;

function search(token) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ sort: { direction: "descending", timestamp: "last_edited_time" }, page_size: 50 });
    const req = https.request({ hostname: "api.notion.com", path: "/v1/search", method: "POST",
      headers: { authorization: `Bearer ${token}`, "notion-version": "2022-06-28", "content-type": "application/json" } }, (res) => {
      let d = ""; res.on("data", c => d += c); res.on("end", () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    });
    req.on("error", reject); req.setTimeout(20000, () => req.destroy(new Error("timeout")));
    req.end(body);
  });
}

async function poll() {
  try {
    const j = await search(process.env.NOTION_TOKEN);
    if (j.object === "error") throw new Error(j.message);
    const times = (j.results || []).map(r => Date.parse(r.last_edited_time)).filter(Boolean);
    const day = new Date(); day.setHours(0, 0, 0, 0);
    state = { status: "ok", editedToday: times.filter(t => t >= day.getTime()).length, editedWeek: times.filter(t => t >= Date.now() - 7 * 864e5).length,
      lastEditedAt: times.length ? Math.max(...times) : null, error: null };
  } catch (e) { state = { ...state, status: "error", error: String(e.message).slice(0, 200) }; }
}

module.exports = {
  name: "notion",
  title: "기획팀 (Notion)",
  check() { return process.env.NOTION_TOKEN ? { ok: true } : { ok: false, reason: "NOTION_TOKEN 없음" }; },
  start(ctx) { poll(); timer = setInterval(poll, (Number(ctx.config().notionPollSec) || 120) * 1000); },
  stop() { clearInterval(timer); },
  routes: { "GET /api/notion": (req, res, ctx) => ctx.send(res, 200, state) },
};
