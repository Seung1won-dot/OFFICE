// 직원(세션) 기록: data/employees.json 에 저장 → 서버를 다시 켜도 유지
// 사원증 카드용: 입사일(첫 기록), 오늘 끝낸 작업 수, 최근 작업 5개. 이 컴퓨터에만 저장된다.
const fs = require("fs");
const path = require("path");
const { ROOT } = require("./config");

const FILE = path.join(ROOT, "data", "employees.json");
let db = {};
try { db = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { db = {}; }
let timer = null;

const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
function save() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(db)); } catch {}
  }, 2000);
}
function get(id) { return db[id]; }
function touch(id, info) {
  const e = db[id] || (db[id] = { firstSeen: info.firstSeen || Date.now(), recent: [], done: { date: today(), count: 0 } });
  if (info.firstSeen && info.firstSeen < e.firstSeen) e.firstSeen = info.firstSeen;
  e.project = info.project; e.title = info.title;
  return e;
}
function addRecent(id, text) {
  const e = db[id]; if (!e) return;
  if (e.recent[0]?.text === text) return;
  e.recent.unshift({ t: Date.now(), text }); e.recent.length = Math.min(e.recent.length, 5);
  save();
}
function addDone(id) {
  const e = db[id]; if (!e) return;
  if (e.done.date !== today()) e.done = { date: today(), count: 0 };
  e.done.count++; save();
}
function doneToday(id) { const e = db[id]; return e && e.done.date === today() ? e.done.count : 0; }
function totalDoneToday() { return Object.keys(db).reduce((a, id) => a + doneToday(id), 0); }

module.exports = { get, touch, addRecent, addDone, doneToday, totalDoneToday, today };
