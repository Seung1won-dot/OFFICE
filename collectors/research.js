// 연구실 층(B1) collector: research-log 폴더(원본)를 읽기만 한다. 이 모듈은 어떤 외부 전송도 하지 않는다.
// 예외: "주간 초안 만들기"를 누르면 weekly/YYYY-Www.draft.md 하나를 쓴다 (최종본 .md 는 절대 건드리지 않음).
//  research-log/
//  ├── README.md          전체 타임라인
//  ├── projects/*.md      프로젝트별 기록 (파일 1개 = 방 1개, _ 로 시작하는 파일은 제외)
//  ├── weekly/YYYY-Www.md 주간 로그 (초안은 YYYY-Www.draft.md)
//  └── claude-usage.md
const fs = require("fs");
const path = require("path");
const os = require("os");

const { expandHome: expand, loadConfig } = require("../lib/config");

// ───────── 템플릿 ─────────
const PROJECT_TEMPLATE = `---
title: 프로젝트명
period: 2026.03 ~ 진행 중
status: active        # active | paused | done
claude_project_path:  # 이 프로젝트와 연결된 Claude Code 세션 경로 (선택)
---
## 1. 내가 맡은 역할

## 2. 사용한 방법과 도구

## 3. 시행착오와 문제 해결

## 4. 결과물
`;
const README = `# research-log

연구실 프로젝트 기록 모음. 이 폴더의 파일이 원본이고, Claude Office는 읽어서 보여주기만 한다.

- projects/  프로젝트별 기록 (projects/_TEMPLATE.md 를 복사해서 시작)
- weekly/    주간 로그 (YYYY-Www.md). Office의 "주간 초안 생성"은 YYYY-Www.draft.md 만 만든다.
- claude-usage.md  Claude 활용 기록

## 타임라인
`;
const USAGE = `# Claude 활용 기록\n\n`;

/** 폴더가 없으면 구조와 템플릿을 만든다. 이미 있으면 아무것도 건드리지 않는다. */
function ensureScaffold(root) {
  if (fs.existsSync(root)) return false;
  fs.mkdirSync(path.join(root, "projects"), { recursive: true });
  fs.mkdirSync(path.join(root, "weekly"), { recursive: true });
  fs.writeFileSync(path.join(root, "README.md"), README);
  fs.writeFileSync(path.join(root, "claude-usage.md"), USAGE);
  fs.writeFileSync(path.join(root, "projects", "_TEMPLATE.md"), PROJECT_TEMPLATE);
  return true;
}

// ───────── 파싱 ─────────
function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const fm = {};
  if (!m) return { fm, body: text };
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].replace(/\s+#.*$/, "").trim();
  }
  return { fm, body: text.slice(m[0].length) };
}
/** "## 1." ~ "## 4." 섹션 중 내용이 있는 수, 3번 섹션의 ### 사례 수 */
function analyzeSections(body) {
  const parts = body.split(/^##\s+(?!#)/m).slice(1);
  let filled = 0, cases = 0;
  for (const p of parts) {
    const nl = p.indexOf("\n");
    const head = (nl < 0 ? p : p.slice(0, nl)).trim();
    const content = (nl < 0 ? "" : p.slice(nl + 1)).replace(/<!--[\s\S]*?-->/g, "").trim();
    const num = head.match(/^(\d)\./)?.[1];
    if (!num || +num < 1 || +num > 4) continue;
    if (content) filled++;
    if (num === "3") cases = (content.match(/^###\s+\S/gm) || []).length;
  }
  return { filled, cases };
}

// ───────── 주차 (ISO 8601, 월요일 시작) ─────────
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return { year: y, week: w, key: `${y}-W${String(w).padStart(2, "0")}`, index: y * 53 + w };
}
function weekRange(d = new Date()) {
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  const next = new Date(mon); next.setDate(mon.getDate() + 7);
  return { start: mon, end: next };
}

// ───────── 스캔 ─────────
function scan(cfg = {}) {
  const root = expand(cfg.path || "~/research-log");
  const created = ensureScaffold(root);
  const now = new Date(), cur = isoWeek(now);
  const weeklyDir = path.join(root, "weekly"), projDir = path.join(root, "projects");

  // 주간 로그들 (초안 제외)
  const weeklies = [];
  for (const f of safeList(weeklyDir)) {
    const m = f.match(/^(\d{4})-W(\d{2})\.md$/);
    if (!m) continue;
    weeklies.push({ index: +m[1] * 53 + +m[2], key: `${m[1]}-W${m[2]}`, text: read(path.join(weeklyDir, f)).toLowerCase() });
  }
  const thisWeek = weeklies.find(w => w.key === cur.key);
  const draftExists = fs.existsSync(path.join(weeklyDir, `${cur.key}.draft.md`));
  const dow = now.getDay();                           // 0=일
  const overdue = !thisWeek && (dow === 0 || dow >= 5);   // 금요일 이후까지 미작성

  const projects = [];
  for (const f of safeList(projDir).filter(f => f.endsWith(".md") && !f.startsWith("_")).sort()) {
    const fp = path.join(projDir, f), text = read(fp), st = fs.statSync(fp);
    const { fm, body } = parseFrontmatter(text);
    const slug = f.replace(/\.md$/, "");
    const title = fm.title || slug;
    const { filled, cases } = analyzeSections(body);
    const needles = [title.toLowerCase(), slug.toLowerCase()];
    const mentioned = weeklies.filter(w => needles.some(n => n && w.text.includes(n))).map(w => w.index);
    const last = mentioned.length ? Math.max(...mentioned) : null;
    const status = (fm.status || "active").toLowerCase();
    let state;
    if (status === "done") state = "done";
    else if (last === cur.index) state = "working";
    else if (last == null ? (now - st.mtimeMs) > 14 * 864e5 : cur.index - last >= 2) state = "sleep";
    else state = "quiet";
    projects.push({ file: f, title, status, state, filled, cases, updated: st.mtimeMs,
      lastMentionWeek: last == null ? null : weeklies.find(w => w.index === last).key,
      period: fm.period || "", claudePath: fm.claude_project_path || "" });
  }
  return { root, created, week: cur.key, weeklyWritten: !!thisWeek, draftExists, overdue, projects };
}

/** 화면으로 보낼 데이터: 경로·본문·연결 경로는 빼고, 공개 모드면 이름을 익명화 */
function publicView(data, publicMode) {
  return {
    week: data.week, weeklyWritten: data.weeklyWritten, draftExists: data.draftExists, overdue: data.overdue,
    created: data.created, publicMode: !!publicMode,
    projects: data.projects.map((p, i) => ({
      id: "p" + i,
      name: publicMode ? `연구 프로젝트 ${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) : ""}` : p.title,
      status: p.status, state: p.state, sections: `${p.filled}/4`, filled: p.filled, cases: p.cases,
      updated: p.updated, lastMentionWeek: p.lastMentionWeek, period: publicMode ? "" : p.period,
    })),
  };
}

// ───────── 주간 초안 생성 (수동 실행) ─────────
/** 이번 주 Claude 세션을 claude_project_path 로 묶어 weekly/YYYY-Www.draft.md 를 쓴다. 최종본(.md)은 절대 건드리지 않는다. */
function writeWeeklyDraft(cfg = {}, claudeRoot = path.join(os.homedir(), ".claude", "projects")) {
  const data = scan(cfg);
  const { start, end } = weekRange();
  const groups = new Map(data.projects.map(p => [p.file, { p, sessions: [] }]));
  const unmatched = [];
  for (const d of safeList(claudeRoot)) {
    const dir = path.join(claudeRoot, d);
    for (const f of safeList(dir).filter(f => f.endsWith(".jsonl"))) {
      const fp = path.join(dir, f);
      let st; try { st = fs.statSync(fp); } catch { continue; }
      if (st.mtimeMs < start.getTime()) continue;
      const s = summarizeSession(fp, start, end);
      if (!s || !s.turns) continue;
      const g = data.projects.find(p => p.claudePath && s.cwd && s.cwd.startsWith(expand(p.claudePath).replace(/\/$/, "")));
      if (g) groups.get(g.file).sessions.push(s); else unmatched.push(s);
    }
  }
  const lines = [`# ${data.week} 주간 로그 (초안)`, "",
    `> 자동 생성 초안 (${new Date().toLocaleString("ko-KR")}). 검토 후 ${data.week}.md 로 직접 정리하세요.`, ""];
  for (const { p, sessions } of groups.values()) {
    lines.push(`## [${p.title}]`);
    const titles = [...new Set(sessions.map(s => s.title).filter(Boolean))];
    const files = [...new Set(sessions.flatMap(s => s.files))].slice(0, 12);
    const tools = mergeCounts(sessions.map(s => s.tools));
    lines.push(`- 한 일: Claude 세션 ${sessions.length}개${titles.length ? ` — ${titles.join(", ")}` : ""}`);
    if (files.length) lines.push(`  - 다룬 파일: ${files.join(", ")}`);
    if (Object.keys(tools).length) lines.push(`  - 사용한 도구: ${Object.entries(tools).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v}회`).join(", ")}`);
    lines.push("- 막혔던 것 / 원인 / 시도한 것 / 결과:", "- 새로 배운 도구·개념:", "- 만든 결과물:", "- 다음 주 할 일:", "");
  }
  if (unmatched.length) {
    lines.push("## (프로젝트에 연결되지 않은 세션)", `- 세션 ${unmatched.length}개: ${[...new Set(unmatched.map(s => s.title).filter(Boolean))].slice(0, 10).join(", ")}`,
      "  - projects/*.md 의 claude_project_path 를 채우면 해당 프로젝트로 묶여요.", "");
  }
  const out = path.join(data.root, "weekly", `${data.week}.draft.md`);
  fs.writeFileSync(out, lines.join("\n"));
  return { file: `weekly/${data.week}.draft.md`, projects: groups.size, sessions: [...groups.values()].reduce((a, g) => a + g.sessions.length, 0), unmatched: unmatched.length };
}

function summarizeSession(fp, start, end) {
  let title = null, cwd = null, turns = 0;
  const files = new Set(), tools = {};
  for (const line of read(fp).split("\n")) {
    if (!line) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }
    if (o.type === "custom-title") title = o.customTitle;
    if (o.type === "agent-name" && !title) title = o.agentName;
    if (o.cwd) cwd = o.cwd;
    const t = o.timestamp ? Date.parse(o.timestamp) : NaN;
    if (!(t >= start.getTime() && t < end.getTime())) continue;
    if (o.type === "user" && typeof o.message?.content === "string") turns++;
    if (o.type === "assistant") for (const b of o.message?.content || []) {
      if (b.type !== "tool_use") continue;
      const name = b.name.replace(/^mcp__[^_]+(?:_[^_]+)*?__/, "");
      tools[name] = (tools[name] || 0) + 1;
      const p = b.input?.file_path || b.input?.notebook_path;
      if (p && /^(Edit|Write|MultiEdit|NotebookEdit)$/.test(b.name)) files.add(path.basename(p));
      turns = Math.max(turns, 1);
    }
  }
  return { title, cwd, turns, files: [...files], tools };
}
const mergeCounts = (arr) => arr.reduce((a, o) => { for (const [k, v] of Object.entries(o)) a[k] = (a[k] || 0) + v; return a; }, {});
function safeList(d) { try { return fs.readdirSync(d); } catch { return []; } }
function read(f) { try { return fs.readFileSync(f, "utf8"); } catch { return ""; } }

module.exports = {
  name: "research",
  title: "B1 연구실 (research-log)",
  check(ctx) { return { ok: true, note: expand(ctx.config().research?.path || "~/research-log") }; },
  start() {},
  routes: {
    "GET /api/research": (req, res, ctx) => {
      const cfg = ctx.config().research || {};
      const q = new URL(req.url, "http://x").searchParams;
      const pub = q.has("public") ? q.get("public") === "1" : !!cfg.publicMode;
      try { ctx.send(res, 200, publicView(scan(cfg), pub)); } catch (e) { ctx.send(res, 500, { error: e.message }); }
    },
    "POST /api/research/draft": (req, res, ctx) => {
      try { ctx.send(res, 200, writeWeeklyDraft(ctx.config().research || {})); } catch (e) { ctx.send(res, 500, { error: e.message }); }
    },
  },
  scan, publicView, writeWeeklyDraft, ensureScaffold, isoWeek, PROJECT_TEMPLATE,
};

// CLI: node collectors/research.js draft  → 이번 주 초안 생성
if (require.main === module) {
  const cfg = loadConfig().research || {};
  if (process.argv[2] === "draft") console.log(writeWeeklyDraft(cfg));
  else console.log(JSON.stringify(publicView(scan(cfg), false), null, 1));
}
