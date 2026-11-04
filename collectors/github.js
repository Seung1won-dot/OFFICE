// GitHub 개발본부 collector
// 인증: .env 의 GITHUB_TOKEN(읽기 전용 Fine-grained PAT 권장)이 있으면 그것, 없으면 로그인된 gh CLI.
// 토큰은 서버 안에서만 쓰고 브라우저로 보내지 않는다. GitHub 로는 읽기(GraphQL 조회)만 한다.
const fs = require("fs");
const path = require("path");
const https = require("https");
const { execFile, execFileSync } = require("child_process");

const QUERY = fs.readFileSync(path.join(__dirname, "github.graphql"), "utf8");
let state = { status: "loading", repos: [], user: null, fetchedAt: 0, error: null };
let timer = null;

function hasGh() { try { execFileSync("gh", ["auth", "status"], { stdio: "ignore", timeout: 5000 }); return true; } catch { return false; } }

function viaToken(token, since) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: QUERY, variables: { since } });
    const req = https.request({ hostname: "api.github.com", path: "/graphql", method: "POST",
      headers: { authorization: `bearer ${token}`, "content-type": "application/json", "user-agent": "claude-office" } }, (res) => {
      let d = ""; res.on("data", c => d += c); res.on("end", () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    });
    req.on("error", reject); req.setTimeout(30000, () => req.destroy(new Error("timeout")));
    req.end(body);
  });
}
function viaGh(since) {
  return new Promise((resolve, reject) => execFile("gh", ["api", "graphql", "-F", "query=@" + path.join(__dirname, "github.graphql"), "-f", "since=" + since],
    { timeout: 30000, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => err ? reject(new Error((stderr || err.message).trim())) : resolve(JSON.parse(stdout))));
}

async function poll() {
  const since = new Date(Date.now() - 7 * 864e5).toISOString().replace(/\.\d+Z$/, "Z");
  try {
    const j = process.env.GITHUB_TOKEN ? await viaToken(process.env.GITHUB_TOKEN, since) : await viaGh(since);
    if (j.errors) throw new Error(j.errors[0]?.message || "GraphQL 오류");
    const v = j.data.viewer;
    const repos = v.repositories.nodes.filter(r => !r.isFork).map(r => {
      const c = r.defaultBranchRef?.target || {};
      return {
        name: r.name, description: r.description || "", url: r.url, private: r.isPrivate, archived: r.isArchived,
        stars: r.stargazerCount, language: r.primaryLanguage?.name || null, langColor: r.primaryLanguage?.color || null,
        pushedAt: r.pushedAt, lastCommit: c.messageHeadline || null, lastCommitAt: c.committedDate || null,
        ci: c.statusCheckRollup?.state || null, commits7d: c.recent?.totalCount ?? 0, commitsTotal: c.total?.totalCount ?? 0,
        openPRs: r.openPRs.totalCount, openIssues: r.openIssues.totalCount, lastMerged: r.merged.nodes[0] || null,
      };
    });
    state = { status: "ok", user: { login: v.login }, repos, fetchedAt: Date.now(), error: null };
  } catch (e) { state = { ...state, status: "error", error: String(e.message).slice(0, 200) }; }
}

module.exports = {
  name: "github",
  title: "GitHub 개발본부",
  check() { return process.env.GITHUB_TOKEN || hasGh() ? { ok: true } : { ok: false, reason: "GITHUB_TOKEN 또는 gh 로그인 필요" }; },
  start(ctx) {
    poll();
    timer = setInterval(poll, (Number(ctx.config().githubPollSec) || 60) * 1000);
  },
  stop() { clearInterval(timer); },
  routes: { "GET /api/github": (req, res, ctx) => ctx.send(res, 200, state) },
};
