// 개발팀(Claude Code) collector
// ~/.claude/projects/*/*.jsonl 세션 기록을 읽어서 세션마다 상태를 판단한다 (읽기 전용).
// 훅을 등록했다면(npm run setup) 훅 이벤트로 "대기/작업 시작"을 더 빨리 반영한다.
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");
const { expandHome } = require("../lib/config");
const store = require("../lib/store");

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

// 파일 전체 통계 (처음 한 번 다 읽고, 이후엔 늘어난 부분만): 누적 도구 호출 수(직급), 날짜별 토큰, 마지막 비용, 첫 기록 시각(입사일)
const fileStats = new Map();
const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
function statsOf(file, size) {
  let c = fileStats.get(file);
  if (!c || size < c.offset) c = { offset: 0, rest: "", tools: 0, tokensByDay: {}, tokensByHour: {}, cost: null, firstAt: null, seen: new Set(), context: 0, contextMax: 200000, limit: null };
  if (size > c.offset) {
    const fd = fs.openSync(file, "r");
    const buf = Buffer.alloc(size - c.offset);
    fs.readSync(fd, buf, 0, buf.length, c.offset);
    fs.closeSync(fd);
    const text = c.rest + buf.toString("utf8");
    const cut = text.lastIndexOf("\n") + 1;
    for (const line of text.slice(0, cut).split("\n")) {
      if (!line) continue;
      const isAsst = line.includes('"type":"assistant"'), isCost = line.includes('"cost-state"');
      if (!isAsst && !isCost && c.firstAt) continue;
      if (line.includes('"rateLimitType"')) {   // 요금제 한도에 걸린 기록 (그때만 남음)
        try { const o = JSON.parse(line); if (o.rateLimitType || o.error === "rate_limit") c.limit = { type: o.rateLimitType || null, resetsAt: (o.resetsAt || 0) * 1000, text: o.message?.content?.[0]?.text || "" }; } catch {}
      }
      let o; try { o = JSON.parse(line); } catch { continue; }
      if (!c.firstAt && o.timestamp) c.firstAt = Date.parse(o.timestamp);
      if (o.type === "cost-state" && typeof o.totalCostUSD === "number" && o.totalCostUSD > 0) c.cost = o.totalCostUSD;
      if (o.type !== "assistant" || o.isSidechain) continue;
      c.tools += (o.message?.content || []).filter(b => b.type === "tool_use").length;
      const u = o.message?.usage, mid = o.message?.id;
      if (u && mid && !c.seen.has(mid) && o.message?.model !== "<synthetic>") {   // 한 응답이 여러 줄로 기록돼도 한 번만
        c.seen.add(mid);
        const n = (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
        const t = o.timestamp ? Date.parse(o.timestamp) : Date.now();
        c.tokensByDay[dayKey(t)] = (c.tokensByDay[dayKey(t)] || 0) + n;
        const hk = Math.floor(t / 3600000);
        c.tokensByHour[hk] = (c.tokensByHour[hk] || 0) + n;
        // 지금 대화가 차지하는 컨텍스트 = 마지막 응답의 입력 토큰 합
        c.context = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
        if (/\[1m\]|-1m/.test(o.message?.model || "") || c.context > 200000) c.contextMax = 1000000;
      }
    }
    c.rest = text.slice(cut);
    c.offset = size;
  }
  fileStats.set(file, c);
  return c;
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
  let errAt = null;            // 마지막 도구 결과가 에러였던 시각
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
      // 내가 Esc 로 멈춘 기록("[Request interrupted by user…]")은 새 요청이 아니라 "멈춤"
      const said = (text) => /^\[Request interrupted/.test(text) ? { kind: "stop" } : { kind: "prompt", text };
      if (typeof c === "string") { if (!c.startsWith("<")) last = said(c); }
      else if (Array.isArray(c)) {
        let res = false;
        for (const b of c) {
          if (b.type === "tool_result") { res = true; pending.delete(b.tool_use_id); errAt = b.is_error ? Date.parse(o.timestamp) || Date.now() : null; }
          else if (b.type === "text" && !b.text.startsWith("<")) last = said(b.text);
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
  } else if (last?.kind === "stop") {
    activity = "stop"; state = "idle"; detail = "내가 멈춤";   // 완료 축하 없이 쉬러 감
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
  const fsx = statsOf(file, st.size);
  return {
    id,
    title: title || (lastPrompt ? lastPrompt.slice(0, 30) : "이름 없는 세션"),
    project: cwd ? path.basename(cwd) : path.basename(path.dirname(file)),
    repo: repoOfCwd(cwd),
    model: model ? model.replace(/^claude-/, "") : "",
    state, activity, detail,
    tool: shortTool(lastTool),
    toolFull: lastTool || "",
    error: !!errAt && Date.now() - errAt < 90000 && state === "working",   // 방금 도구가 에러를 냄 → 땀방울
    activeSubagents: ageSec < 600 ? [...pending.values()].filter(b => /^(Agent|Task)$/.test(b.name)).length : 0,
    toolCount: Math.max(toolCount, fsx.tools),
    tokensToday: fsx.tokensByDay[dayKey(Date.now())] || 0,
    tokens5h: Object.entries(fsx.tokensByHour).filter(([h]) => +h > Math.floor(Date.now() / 3600000) - 5).reduce((a, [, v]) => a + v, 0),
    contextLeft: fsx.context ? Math.max(0, Math.round(100 - (fsx.context / fsx.contextMax) * 100)) : null,
    limit: fsx.limit && fsx.limit.resetsAt > Date.now() ? fsx.limit : null,
    cost: fsx.cost,
    firstAt: fsx.firstAt,
    ageSec: Math.round(ageSec),
    updated: st.mtimeMs,
  };
}

// ── 이벤트 (출근 / 작업 / 확인 필요 / 완료) ──
const events = [];            // 최근 300개, 메모리에만
const prev = new Map();       // 세션 id → 이전 상태
let primed = false;
function pushEvent(s, kind, text) {
  events.push({ t: Date.now(), id: s.id, kind, text, title: s.title });
  if (events.length > 300) events.shift();
}
function detect(list) {
  for (const s of list) {
    store.touch(s.id, { firstSeen: s.firstAt, project: s.project, title: s.title });
    const p = prev.get(s.id), key = `${s.state}|${s.detail}`;
    if (primed) {
      if (!p) { if (s.ageSec < 120) pushEvent(s, "join", "출근"); }
      else if (p.key !== key) {
        if (s.state === "waiting" && p.state !== "waiting") pushEvent(s, "wait", "확인이 필요해요");
        else if (s.state === "working" && s.detail && s.activity !== "think") { pushEvent(s, "tool", s.detail); store.addRecent(s.id, s.detail); }
        else if (s.state === "idle" && p.state !== "idle" && s.activity === "done") { pushEvent(s, "done", "작업 완료"); store.addDone(s.id); store.addRecent(s.id, "✓ 작업 완료"); }
      }
    }
    prev.set(s.id, { state: s.state, key });
  }
  primed = true;
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
  out.sort((a, b) => b.updated - a.updated);
  detect(out);
  return out.slice(0, max);
}

/** 활동 잔디용: 오늘 시간대별(0~23시) 토큰, 최근 14일 날짜별 토큰 (읽어 둔 세션 기록 전체 기준) */
function activity() {
  const hours = new Array(24).fill(0), days = {};
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const h0 = Math.floor(today.getTime() / 3600000), dayAgo = Date.now() - 14 * 864e5;
  for (const c of fileStats.values()) {
    for (const [hk, v] of Object.entries(c.tokensByHour)) { const i = +hk - h0; if (i >= 0 && i < 24) hours[i] += v; }
    for (const [dk, v] of Object.entries(c.tokensByDay)) { const [y, m, d] = dk.split("-").map(Number); if (new Date(y, m - 1, d).getTime() >= dayAgo) days[dk] = (days[dk] || 0) + v; }
  }
  return { hours, days };
}

module.exports = {
  name: "claude",
  title: "개발팀 (Claude Code)",
  check() { return fs.existsSync(projectsDir()) ? { ok: true } : { ok: false, reason: `${projectsDir()} 없음` }; },
  start() {},
  routes: {
    "GET /api/sessions": (req, res, ctx) => {
      const sessions = listSessions(ctx.config());
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const stats = {
        doneToday: store.totalDoneToday(),
        tokensToday: sessions.reduce((a, s) => a + (s.tokensToday || 0), 0),
        costToday: sessions.filter(s => s.updated >= today.getTime() && s.cost).reduce((a, s) => a + s.cost, 0),
        tokens5h: sessions.reduce((a, s) => a + (s.tokens5h || 0), 0),
        budget5h: Number(ctx.config().tokenBudget5h) || 0,
        limit: sessions.map(s => s.limit).filter(Boolean).sort((a, b) => b.resetsAt - a.resetsAt)[0] || null,
        ...activity(),
      };
      ctx.send(res, 200, { now: Date.now(), host: os.hostname(), sessions: sessions.map(({ firstAt, ...s }) => ({ ...s, doneToday: store.doneToday(s.id) })), stats });
    },
    "GET /api/events": (req, res, ctx) => {
      const since = Number(new URL(req.url, "http://x").searchParams.get("since")) || 0;
      ctx.send(res, 200, events.filter(e => e.t > since).slice(-50));
    },
    // 사원증 카드
    "GET /api/employee": (req, res, ctx) => {
      const id = new URL(req.url, "http://x").searchParams.get("id") || "";
      const e = store.get(id);
      if (!e) return ctx.send(res, 404, { error: "기록 없음" });
      ctx.send(res, 200, { firstSeen: e.firstSeen, project: e.project, title: e.title, doneToday: store.doneToday(id), recent: e.recent });
    },
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
