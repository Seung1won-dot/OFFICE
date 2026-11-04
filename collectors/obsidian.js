// 연구팀(Obsidian) collector
// API 없이 로컬 볼트 폴더(.env 의 OBSIDIAN_VAULT_PATH)를 읽기만 한다. .obsidian 폴더와 임시 파일은 무시.
// 화면에는 오늘/이번 주 수정된 노트 수와 마지막 수정 시각만 보낸다 (노트 이름·내용은 보내지 않음).
const fs = require("fs");
const path = require("path");
const { expandHome } = require("../lib/config");

let state = { status: "loading", editedToday: 0, editedWeek: 0, notes: 0, lastEditedAt: null, error: null };
let timer = null;
const vault = () => expandHome(process.env.OBSIDIAN_VAULT_PATH || "");

function walk(dir, out, depth = 0) {
  if (depth > 8) return;
  let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    if (e.name.startsWith(".") || e.name.endsWith("~") || e.name.endsWith(".tmp")) continue;   // .obsidian, .trash, 임시 파일
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out, depth + 1);
    else if (e.name.endsWith(".md")) { try { out.push(fs.statSync(p).mtimeMs); } catch {} }
  }
}
function poll() {
  try {
    const times = []; walk(vault(), times);
    const day = new Date(); day.setHours(0, 0, 0, 0);
    state = { status: "ok", notes: times.length, editedToday: times.filter(t => t >= day.getTime()).length,
      editedWeek: times.filter(t => t >= Date.now() - 7 * 864e5).length, lastEditedAt: times.length ? Math.max(...times) : null, error: null };
  } catch (e) { state = { ...state, status: "error", error: e.message }; }
}

module.exports = {
  name: "obsidian",
  title: "연구팀 (Obsidian)",
  check() { return vault() && fs.existsSync(vault()) ? { ok: true } : { ok: false, reason: "OBSIDIAN_VAULT_PATH 없음" }; },
  start(ctx) { poll(); timer = setInterval(poll, (Number(ctx.config().obsidianPollSec) || 30) * 1000); },
  stop() { clearInterval(timer); },
  routes: { "GET /api/obsidian": (req, res, ctx) => ctx.send(res, 200, state) },
};
