// npm run check-secrets — 공개 전 점검: 토큰 패턴, 개인 절대 경로, 이메일을 찾는다.
// 깃 저장소면 커밋될 파일(git ls-files + 새 파일)만, 아니면 폴더 전체(무시 목록 제외)를 본다.
// 오탐이면 그 줄에 "check-secrets:ignore" 를 적어 두면 건너뛴다.
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const ROOT = path.join(__dirname, "..");

const RULES = [
  ["GitHub 토큰", /\b(gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ["Notion 토큰", /\b(secret_[A-Za-z0-9]{40,}|ntn_[A-Za-z0-9]{40,})\b/],
  ["API 키", /\b(sk-[A-Za-z0-9_-]{30,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35})\b/],
  ["개인 키", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["개인 절대 경로", /(\/Users\/(?!<|\$|you\b|me\b|name\b|username\b)[A-Za-z0-9._-]+\/|\/home\/(?!<|\$|you\b|user\b)[A-Za-z0-9._-]+\/|[A-Z]:\\Users\\[A-Za-z0-9._-]+\\)/],
  ["이메일", /\b[A-Za-z0-9._%+-]+@(?!example\.(com|org)|users\.noreply\.github\.com|anthropic\.com)[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/],
];
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "data", "logs", "third-party", "_downloads", "bundled", "previews", "_tools", "_unused", "screens"]);
const SKIP_FILES = new Set([".env", "config.json", "package-lock.json"]);
const TEXT = /\.(js|ts|json|md|html|css|graphql|txt|yml|yaml|example|gitignore|tsj|tmj|sh)$|^\.env\.example$|^LICENSE$/;

function files() {
  try {
    const out = execSync("git ls-files --cached --others --exclude-standard", { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return out.split("\n").filter(Boolean).filter(f => !SKIP_FILES.has(path.basename(f)));
  } catch {
    const out = [];
    (function walk(d) {
      for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
        const rel = path.join(d, e.name);
        if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(rel); }
        else if (!SKIP_FILES.has(e.name)) out.push(rel);
      }
    })("");
    return out;
  }
}

let hits = 0;
for (const f of files()) {
  if (!TEXT.test(path.basename(f))) continue;
  let text; try { text = fs.readFileSync(path.join(ROOT, f), "utf8"); } catch { continue; }
  text.split("\n").forEach((line, i) => {
    if (line.includes("check-secrets:ignore")) return;
    for (const [what, re] of RULES) {
      const m = line.match(re);
      if (m) { hits++; console.log(`✗ ${what}  ${f}:${i + 1}  →  ${m[0].slice(0, 60)}`); }
    }
  });
}
if (hits) { console.log(`\n${hits}건 발견. 공개 전에 지우거나 설정(.env/config.json)으로 옮기세요.`); process.exit(1); }
console.log("✓ 토큰·개인 경로·이메일이 보이지 않아요.");
