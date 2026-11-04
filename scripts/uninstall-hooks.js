// npm run uninstall-hooks — ~/.claude/settings.json 에서 Claude Office 훅만 지운다 (백업 후)
const { uninstall } = require("../lib/hooks");
try {
  const r = uninstall();
  console.log(r.removed ? `훅 ${r.removed}개를 지웠어요.` : "등록된 Claude Office 훅이 없어요.");
  if (r.backup) console.log(`백업: ${r.backup}`);
} catch (e) {
  console.error("settings.json 을 읽지 못해서 아무것도 바꾸지 않았어요:", e.message);
  process.exit(1);
}
