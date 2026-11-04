// ~/.claude/settings.json 에 Claude Office 훅을 넣고 빼는 도구.
// 항상 먼저 settings.json 을 백업하고, 기존 설정은 그대로 둔 채 우리 항목만 더하거나 지운다.
const fs = require("fs");
const path = require("path");
const os = require("os");

const MARK = "claude-office-hook";   // 우리 훅을 알아보는 표식 (명령 문자열에 포함)
const EVENTS = ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "Notification", "Stop", "SubagentStop"];
const TOOL_EVENTS = new Set(["PreToolUse", "PostToolUse"]);
const settingsPath = () => path.join(os.homedir(), ".claude", "settings.json");

function readSettings() {
  const p = settingsPath();
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, "utf8"));   // 깨진 JSON 이면 여기서 에러 → 아무것도 안 건드림
}
function backup() {
  const p = settingsPath();
  if (!fs.existsSync(p)) return null;
  const b = `${p}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  fs.copyFileSync(p, b);
  return b;
}
function write(s) {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(s, null, 2) + "\n");
}
const ours = (h) => (h.hooks || []).some(x => String(x.command || "").includes(MARK));

/** 훅 등록 (이미 있으면 갱신) */
function install(hookScript) {
  const s = readSettings();
  const b = backup();
  s.hooks = s.hooks || {};
  const command = `node "${hookScript}" # ${MARK}`;
  for (const ev of EVENTS) {
    const list = (s.hooks[ev] || []).filter(h => !ours(h));
    const entry = { hooks: [{ type: "command", command, timeout: 3 }] };
    if (TOOL_EVENTS.has(ev)) entry.matcher = "*";
    list.push(entry);
    s.hooks[ev] = list;
  }
  write(s);
  return { backup: b, events: EVENTS.length, settings: settingsPath() };
}

/** 훅 제거 (우리 항목만) */
function uninstall() {
  const s = readSettings();
  if (!s.hooks) return { removed: 0, settings: settingsPath() };
  const b = backup();
  let removed = 0;
  for (const ev of Object.keys(s.hooks)) {
    const before = s.hooks[ev].length;
    s.hooks[ev] = s.hooks[ev].filter(h => !ours(h));
    removed += before - s.hooks[ev].length;
    if (!s.hooks[ev].length) delete s.hooks[ev];
  }
  if (!Object.keys(s.hooks).length) delete s.hooks;
  write(s);
  return { removed, backup: b, settings: settingsPath() };
}

module.exports = { install, uninstall, EVENTS, MARK };
