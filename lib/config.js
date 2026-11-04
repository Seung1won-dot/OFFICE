// 설정 로딩: config.json (없으면 config.example.json) + .env (토큰·경로)
// 토큰은 서버 안에서만 쓰고, 브라우저로 보내는 설정(publicConfig)에서는 빠진다.
const fs = require("fs");
const path = require("path");
const os = require("os");

const ROOT = path.join(__dirname, "..");

/** 아주 단순한 .env 파서 (의존성 없음). 이미 있는 환경변수는 덮어쓰지 않는다 */
function loadEnv(file = path.join(ROOT, ".env")) {
  let text = "";
  try { text = fs.readFileSync(file, "utf8"); } catch { return; }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    const v = m[2].replace(/^["']|["']$/g, "");
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

function readJson(file) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; } }

/** 매번 새로 읽는다 (config.json 을 고치면 서버 재시작 없이 반영) */
function loadConfig() {
  const cfg = readJson(path.join(ROOT, "config.json")) || readJson(path.join(ROOT, "config.example.json")) || {};
  cfg.collectors = { claude: true, github: true, research: true, notion: false, obsidian: false, ...(cfg.collectors || {}) };
  return cfg;
}

/** 브라우저로 보내도 되는 설정만 (토큰·경로 제외) */
function publicConfig(cfg) {
  const { research, ...rest } = cfg;
  return { ...rest, research: research ? { publicMode: !!research.publicMode, floorRotateSec: research.floorRotateSec || 0 } : undefined };
}

const expandHome = (p) => String(p || "").replace(/^~(?=$|[\\/])/, os.homedir());

module.exports = { ROOT, loadEnv, loadConfig, publicConfig, expandHome };
