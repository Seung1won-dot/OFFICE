// collector(부서 데이터 수집기) 등록소.
// 새 부서를 추가하려면 이 폴더에 파일을 하나 만들고 아래 목록에 넣으면 된다 (CONTRIBUTING.md 참고).
// 꺼져 있거나(config.collectors.<이름> = false) 토큰·경로가 없으면 그 부서만 "부재중"이고 나머지는 정상 동작한다.
const LIST = ["claude", "github", "research", "notion", "obsidian", "weather"];

function loadAll(ctx) {
  const cfg = ctx.config();
  const status = [], routes = {};
  for (const name of LIST) {
    let mod;
    try { mod = require("./" + name); } catch (e) { status.push({ name, state: "error", reason: e.message }); continue; }
    const on = cfg.collectors?.[name] !== false;
    if (!on) { status.push({ name, title: mod.title, state: "off" }); continue; }
    const c = mod.check ? mod.check(ctx) : { ok: true };
    if (!c.ok) { status.push({ name, title: mod.title, state: "absent", reason: c.reason }); continue; }
    try { mod.start?.(ctx); } catch (e) { status.push({ name, title: mod.title, state: "error", reason: e.message }); continue; }
    Object.assign(routes, mod.routes || {});
    status.push({ name, title: mod.title, state: "on" });
  }
  return { status, routes };
}

module.exports = { LIST, loadAll };
