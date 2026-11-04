// Claude Office 로컬 서버 — 의존성 없음.  npm start  →  http://localhost:4747
// 127.0.0.1 에만 열리고, 토큰은 서버 안에서만 쓴다. 수집한 데이터는 메모리에만 두고 외부로 보내지 않는다.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { ROOT, loadEnv, loadConfig, publicConfig } = require("./lib/config");
const { loadAll } = require("./collectors");

loadEnv();
const PORT = Number(process.env.PORT) || 4747;

const ctx = {
  config: loadConfig,
  send(res, code, obj) { res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); res.end(JSON.stringify(obj)); },
  readBody(req, limit = 1e6) {
    return new Promise((resolve) => { let b = ""; req.on("data", c => { b += c; if (b.length > limit) req.destroy(); }); req.on("end", () => resolve(b)); });
  },
};
const { status, routes } = loadAll(ctx);

// 공통 API
routes["GET /api/config"] = (req, res) => ctx.send(res, 200, publicConfig(loadConfig()));
routes["GET /api/collectors"] = (req, res) => ctx.send(res, 200, status);
// 화면 캡처 저장 (README 스크린샷용, 로컬 전용): data/screens/<name>.png
routes["POST /api/snapshot"] = async (req, res) => {
  const body = await ctx.readBody(req, 30e6);
  const name = (new URL(req.url, "http://x").searchParams.get("name") || "snapshot").replace(/[^\w-]/g, "");
  const m = body.match(/^data:image\/png;base64,(.+)$/);
  if (!m) return ctx.send(res, 400, { error: "bad data" });
  const dir = path.join(ROOT, "data", "screens"); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name + ".png"), Buffer.from(m[1], "base64"));
  ctx.send(res, 200, { saved: `data/screens/${name}.png` });
};

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".png": "image/png", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".tsj": "application/json", ".tmj": "application/json" };

function serveFile(res, root, urlPath) {
  const fp = path.join(root, path.normalize(urlPath).replace(/^(\.\.[/\\])+/, ""));
  if (!fp.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "content-type": TYPES[path.extname(fp)] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  const handler = routes[`${req.method} ${urlPath}`];
  if (handler) return handler(req, res, ctx);
  if (urlPath.startsWith("/api/")) return ctx.send(res, 404, { error: "없는 API 이거나 꺼진 부서예요" });
  // 재배포 불가 에셋(사용자가 직접 넣는 것): assets/third-party/ → /third-party/
  if (urlPath.startsWith("/third-party/")) return serveFile(res, path.join(ROOT, "assets", "third-party"), urlPath.slice("/third-party".length));
  // 화면: web/dist (npm run build 결과)
  const dist = path.join(ROOT, "web", "dist");
  if (!fs.existsSync(path.join(dist, "index.html"))) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end("<p style='font-family:sans-serif'>화면이 아직 빌드되지 않았어요. 터미널에서 <code>npm run build</code> 를 실행한 뒤 새로고침하세요.</p>");
  }
  serveFile(res, dist, urlPath.endsWith("/") ? urlPath + "index.html" : urlPath);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Claude Office → http://localhost:${PORT}`);
  for (const s of status) console.log(`  ${s.state === "on" ? "●" : "○"} ${s.title || s.name}: ${{ on: "켜짐", off: "꺼짐", absent: "부재중", error: "오류" }[s.state]}${s.reason ? ` (${s.reason})` : ""}`);
});
