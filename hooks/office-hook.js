#!/usr/bin/env node
// Claude Code 훅 → 로컬 Claude Office 서버로 이벤트 전달 (claude-office-hook)
// 세션 id, 이벤트 이름, 도구 이름만 보낸다. 프롬프트·파일 내용은 보내지 않는다.
// 서버가 꺼져 있어도 Claude Code 작업을 절대 방해하지 않도록 항상 조용히 0 으로 끝난다.
const http = require("http");

let input = "";
process.stdin.on("data", c => { input += c; if (input.length > 2e6) process.exit(0); });
process.stdin.on("end", () => {
  let e = {};
  try { e = JSON.parse(input); } catch { process.exit(0); }
  const body = JSON.stringify({ session_id: e.session_id, hook_event_name: e.hook_event_name, tool_name: e.tool_name || null });
  const req = http.request({ host: "127.0.0.1", port: Number(process.env.CLAUDE_OFFICE_PORT) || 4747, path: "/api/hook", method: "POST",
    headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) }, timeout: 800 }, (res) => { res.resume(); res.on("end", () => process.exit(0)); });
  req.on("error", () => process.exit(0));
  req.on("timeout", () => { req.destroy(); process.exit(0); });
  req.end(body);
});
setTimeout(() => process.exit(0), 1500);
