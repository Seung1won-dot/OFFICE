// 개발팀(Claude Code) collector
// ~/.claude/projects/*/*.jsonl 세션 기록을 읽어서 세션마다 상태를 판단한다 (읽기 전용).
// 훅을 등록했다면(npm run setup) 훅 이벤트로 "대기/작업 시작"을 더 빨리 반영한다.
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");
const { expandHome } = require("../lib/config");

const TAIL_BYTES = 256 * 1024;
const projectsDir = () => expandHome(process.env.CLAUDE_PROJECTS_DIR || path.join(os.homedir(), ".claude", "projects"));

function readTail(file) {
  const st = fs.statSync(file);
  const fd = fs.openSync(file, "r");
  const len = Math.min(st.size, TAIL_BYTES);
  const buf = Buffer.alloc(len);
  fs.readSync(fd, buf, 0, len, st.size - len);
  fs.closeSync(fd);
  let lines = buf.toString("utf8").split("\n");
  if (st.size > len) lines = lines.slice(1);   // 잘린 첫 줄 버림
  const out = [];
  for (const l of lines) { if (!l.trim()) continue; try { out.push(JSON.parse(l)); } catch {} }
  return out;
}

// 도구 이름 → 캐릭터 행동
function activityOf(tool) {
  if (!tool) return "think";
  if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool)) return "type";
  if (/^(Read|Grep|Glob|LS)$/.test(tool)) return "read";
  if (/^(Bash|Monitor|BashOutput|KillShell)$/.test(tool)) return "run";
  if (/Browser|chrome|WebFetch|WebSearch/i.test(tool)) return "browse";
  if (/^(Agent|Task|Workflow)$/.test(tool)) return "delegate";
  if (/AskUserQuestion|ExitPlanMode/.test(tool)) return "ask";
  if (/Artifact|show_widget|SendUserFile/.test(tool)) return "present";
  return "tool";
}
function shortTool(name) {
  if (!name) return "";
  const m = name.match(/^mcp__[^_]+(?:_[^_]+)*?__(.+)$/);
  return m ? m[1] : name;
}
function describeInput(input) {
  if (!input) return "";
  const p = input.file_path || input.path || input.notebook_path;
  if (p) return path.basename(p);
  if (input.command) return String(input.command).split("\n")[0].slice(0, 60);
  if (input.pattern) return String(input.pattern).slice(0, 40);
  if (input.url) return String(input.url).replace(/^https?:\/\//, "").slice(0, 40);
  if (input.query) return String(input.query).slice(0, 40);
  if (input.description) return String(input.description).slice(0, 40);
  return "";
}

// 누적 도구 호출 수 (직급 계산용): 처음 한 번 전체를 세고, 이후엔 늘어난 부분만
const toolTotals = new Map();
function totalToolCalls(file, size) {
  let c = toolTotals.get(file);
  if (!c || size < c.offset) c = { offset: 0, count: 0, rest: "" };
  if (size > c.offset) {
    const fd = fs.openSync(file, "r");
    const buf = Buffer.alloc(size - c.offset);
    fs.readSync(fd, buf, 0, buf.length, c.offset);
    fs.closeSync(fd);
    const text = c.rest + buf.toString("utf8");
    const cut = text.lastIndexOf("\n") + 1;
    for (const line of text.slice(0, cut).split("\n")) {
      if (!line.includes('"tool_use"')) continue;
      try {
        const o = JSON.parse(line);
        if (o.type === "assistant" && !o.isSidechain) c.count += (o.message?.content || []).filter(b => b.type === "tool_use").length;
      } catch {}
    }
    c.rest = text.slice(cut);
    c.offset = size;
  }
  toolTotals.set(file, c);
  return c.count;
}

// 세션 작업 폴더 → GitHub 저장소 이름 (git remote)
const remoteCache = new Map();
function repoOfCwd(cwd) {
  if (!cwd) return null;
  if (remoteCache.has(cwd)) return remoteCache.get(cwd);
  let repo = null;
  try {
    const url = execFileSync("git", ["-C", cwd, "config", "--get", "remote.origin.url"], { encoding: "utf8", timeout: 2000, stdio: ["ignore", "pipe", "ignore"] }).trim();
    const m = url.match(/github\.com[:/]([^/]+)\/(.+?)(\.git)?$/);
    if (m) repo = m[2];
  } catch {}
  remoteCache.set(cwd, repo);
  return repo;
}

// 훅 이벤트 (세션 id → 마지막 이벤트)
const hookEvents = new Map();

function summarize(file) {
  const st = fs.statSync(file);
  const ev = readTail(file);
  let title = null, cwd = null, model = null, lastPrompt = null;
  let last = null, toolCount = 0;
  const pending = new Map();   // 결과를 아직 못 받은 tool_use
  for (const o of ev) {
    if (o.type === "custom-title") title = o.customTitle;
    if (o.type === "agent-name" && !title) title = o.agentName;
    if (o.type === "last-prompt") lastPrompt = o.lastPrompt;
    if (o.cwd) cwd = o.cwd;
    if (o.isSidechain) continue;
    if (o.type === "assistant") {
      if (o.message?.model) model = o.message.model;
      for (const b of o.message?.content || []) {
        if (b.type === "tool_use") { toolCount++; pending.set(b.id, b); last = { kind: "tool", tool: b.name, input: b.input }; }
        else if (b.type === "text" && b.text?.trim()) last = { kind: "text", text: b.text };
        else if (b.type === "thinking") last = { kind: "thinking" };
      }
    } else if (o.type === "user") {
      const c = o.message?.content;
      if (typeof c === "string") { if (!c.startsWith("<")) last = { kind: "prompt", text: c }; }
      else if (Array.isArray(c)) {
        let res = false;
        for (const b of c) {
          if (b.type === "tool_result") { res = true; pending.delete(b.tool_use_id); }
          else if (b.type === "text" && !b.text.startsWith("<")) last = { kind: "prompt", text: b.text };
        }
        if (res && last?.kind === "tool") last = { ...last, kind: "toolDone" };
      }
    }
  }
  const id = path.basename(file, ".jsonl");
  const ageSec = (Date.now() - st.mtimeMs) / 1000;
  let state, activity, detail = "";
  const lastTool = last?.tool;
  if (last?.kind === "tool" && pending.size) {
    activity = activityOf(lastTool);
    state = ageSec > 90 && activity !== "run" ? "waiting" : "working";   // 오래 멈춘 도구 = 권한 승인 대기일 가능성
    if (/AskUserQuestion/.test(lastTool)) state = "waiting";
    detail = `${shortTool(lastTool)} ${describeInput(last.input)}`.trim();
  } else if (last?.kind === "prompt" || last?.kind === "toolDone" || last?.kind === "thinking") {
    activity = "think"; state = ageSec > 300 ? "idle" : "working";
    detail = last.kind === "prompt" ? "요청 받음: " + last.text.slice(0, 40) : "생각 중…";
  } else {
    activity = "done"; state = "idle";
    detail = last?.text ? last.text.replace(/\s+/g, " ").slice(0, 60) : "";
  }
  // 훅 이벤트가 더 최신이면 반영 (Notification = 내 승인/대답 대기, Stop = 턴 끝)
  const h = hookEvents.get(id);
  if (h && Date.now() - h.at < 120000 && h.at > st.mtimeMs - 2000) {
    if (h.event === "Notification") state = "waiting";
    else if (h.event === "Stop" || h.event === "SubagentStop") { state = "idle"; activity = "done"; }
    else if (h.event === "PreToolUse" && h.tool) { state = "working"; activity = activityOf(h.tool); detail = shortTool(h.tool); }
  }
  if (state === "idle" && ageSec > 1800) activity = "sleep";
  return {
    id,
    title: title || (lastPrompt ? lastPrompt.slice(0, 30) : "이름 없는 세션"),
    project: cwd ? path.basename(cwd) : path.basename(path.dirname(file)),
    repo: repoOfCwd(cwd),
    model: model ? model.replace(/^claude-/, "") : "",
    state, activity, detail,
    tool: shortTool(lastTool),
    toolFull: lastTool || "",
    activeSubagents: ageSec < 600 ? [...pending.values()].filter(b => /^(Agent|Task)$/.test(b.name)).length : 0,
    toolCount: Math.max(toolCount, totalToolCalls(file, st.size)),
    ageSec: Math.round(ageSec),
    updated: st.mtimeMs,
  };
}

function listSessions(cfg) {
  const hours = Number(cfg.sessionWindowHours) || 12, max = Number(cfg.maxSessions) || 12;
  const cutoff = Date.now() - hours * 3600 * 1000, root = projectsDir(), files = [];
  let dirs = [];
  try { dirs = fs.readdirSync(root); } catch { return []; }
  for (const d of dirs) {
    let ents; try { ents = fs.readdirSync(path.join(root, d)); } catch { continue; }
    for (const f of ents) {
      if (!f.endsWith(".jsonl")) continue;
      const fp = path.join(root, d, f);
      try { if (fs.statSync(fp).mtimeMs >= cutoff) files.push(fp); } catch {}
    }
  }
  const out = [];
  for (const f of files) { try { out.push(summarize(f)); } catch {} }
  return out.sort((a, b) => b.updated - a.updated).slice(0, max);
}

module.exports = {
  name: "claude",
  title: "개발팀 (Claude Code)",
  check() { return fs.existsSync(projectsDir()) ? { ok: true } : { ok: false, reason: `${projectsDir()} 없음` }; },
  start() {},
  routes: {
    "GET /api/sessions": (req, res, ctx) => ctx.send(res, 200, { now: Date.now(), host: os.hostname(), sessions: listSessions(ctx.config()) }),
    // 훅 스크립트(hooks/office-hook.js)가 보내는 이벤트. 내용은 메모리에만 두고 저장하지 않는다
    "POST /api/hook": async (req, res, ctx) => {
      const body = await ctx.readBody(req, 64 * 1024);
      try {
        const e = JSON.parse(body);
        if (e.session_id) hookEvents.set(e.session_id, { event: e.hook_event_name, tool: e.tool_name || null, at: Date.now() });
        if (hookEvents.size > 200) hookEvents.delete(hookEvents.keys().next().value);
      } catch {}
      ctx.send(res, 200, { ok: true });
    },
  },
};
