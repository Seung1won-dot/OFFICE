// npm run setup — 대화형 설정
// 1) 쓸 부서 고르기  2) 토큰·경로 입력(.env)  3) config.json 만들기  4) Claude Code 훅 등록(선택, 백업 후 병합)  5) 화면 빌드
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { execSync, execFileSync } = require("child_process");
const { ROOT } = require("../lib/config");
const hooks = require("../lib/hooks");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q, def = "") => new Promise(r => rl.question(def ? `${q} [${def}] ` : `${q} `, a => r(a.trim() || def)));
const yes = async (q, def = true) => /^y/i.test(await ask(`${q} (y/n)`, def ? "y" : "n"));

function readEnv() {
  const p = path.join(ROOT, ".env"), out = {};
  if (fs.existsSync(p)) for (const l of fs.readFileSync(p, "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) out[m[1]] = m[2]; }
  return out;
}
function hasGh() { try { execFileSync("gh", ["auth", "status"], { stdio: "ignore" }); return true; } catch { return false; } }

(async () => {
  console.log("\n🏢 Claude Office 설정\n모든 값은 이 컴퓨터에만 저장돼요 (.env, config.json — 둘 다 깃에 올라가지 않아요).\n");
  const env = readEnv();
  const cfgPath = path.join(ROOT, "config.json");
  const cfg = JSON.parse(fs.readFileSync(fs.existsSync(cfgPath) ? cfgPath : path.join(ROOT, "config.example.json"), "utf8"));
  cfg.collectors = cfg.collectors || {};

  // ── 부서 ──
  console.log("── 1. 쓸 부서 고르기 ──");
  cfg.collectors.claude = true;
  cfg.collectors.github = await yes("GitHub 개발본부를 켤까요?", cfg.collectors.github !== false);
  if (cfg.collectors.github) {
    if (hasGh()) console.log("  gh CLI 로그인이 확인돼서 토큰 없이도 동작해요.");
    const t = await ask("  GitHub 토큰 (읽기 전용 Fine-grained PAT, 비우면 gh CLI 사용):", env.GITHUB_TOKEN ? "(기존 값 유지)" : "");
    if (t && t !== "(기존 값 유지)") env.GITHUB_TOKEN = t;
  }
  cfg.collectors.notion = await yes("기획팀(Notion)을 켤까요?", !!cfg.collectors.notion);
  if (cfg.collectors.notion) {
    console.log("  Notion: https://www.notion.so/profile/integrations 에서 Internal Integration 을 만들고 '콘텐츠 읽기'만 허용하세요.");
    console.log("  그리고 보고 싶은 페이지마다 ··· > 연결 > 만든 Integration 을 추가해야 보여요.");
    const t = await ask("  Notion 토큰:", env.NOTION_TOKEN ? "(기존 값 유지)" : "");
    if (t && t !== "(기존 값 유지)") env.NOTION_TOKEN = t;
  }
  cfg.collectors.obsidian = await yes("연구팀(Obsidian)을 켤까요?", !!cfg.collectors.obsidian);
  if (cfg.collectors.obsidian) env.OBSIDIAN_VAULT_PATH = await ask("  Obsidian 볼트 폴더 경로:", env.OBSIDIAN_VAULT_PATH || "~/Documents/MyVault");
  cfg.collectors.research = await yes("B1 연구실(research-log 기록)을 켤까요?", cfg.collectors.research !== false);
  if (cfg.collectors.research) {
    cfg.research = cfg.research || {};
    cfg.research.path = await ask("  research-log 폴더 (없으면 템플릿과 함께 만들어져요):", cfg.research.path || "~/research-log");
  }
  cfg.ambientStaff = Number(await ask("배경 직원 수 (사무실을 채우는 가상 직원, 0이면 끔):", String(cfg.ambientStaff ?? 16))) || 0;

  // ── 저장 ──
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
  const envText = Object.entries(env).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => `${k}=${v}`).join("\n") + "\n";
  fs.writeFileSync(path.join(ROOT, ".env"), envText, { mode: 0o600 });
  console.log("\n✓ config.json, .env 저장");

  // ── 훅 ──
  console.log("\n── 2. Claude Code 훅 (선택) ──");
  console.log("훅을 등록하면 '내 승인 대기', '작업 시작' 같은 상태가 더 빨리 반영돼요. 없어도 세션 기록만으로 동작해요.");
  console.log("~/.claude/settings.json 을 백업한 뒤 기존 설정은 그대로 두고 Claude Office 항목만 추가해요. (지우기: npm run uninstall-hooks)");
  if (await yes("훅을 등록할까요?", false)) {
    try {
      const r = hooks.install(path.join(ROOT, "hooks", "office-hook.js"));
      console.log(`✓ 훅 ${r.events}개 이벤트 등록 (${r.settings})${r.backup ? `\n  백업: ${r.backup}` : ""}`);
    } catch (e) { console.log("✗ settings.json 을 읽지 못해서 훅은 건너뛰었어요:", e.message); }
  }

  // ── 빌드 ──
  if (!fs.existsSync(path.join(ROOT, "web", "dist", "index.html")) && await yes("\n화면을 지금 빌드할까요? (npm install + build, 1~2분)", true)) {
    execSync("npm run build", { cwd: ROOT, stdio: "inherit" });
  }
  console.log("\n완료! 실행: npm start  →  http://localhost:" + (env.PORT || 4747) + "\n");
  rl.close();
})().catch(e => { console.error(e); rl.close(); process.exit(1); });
