// 터미널 명령을 사람이 읽는 말로: "cd /tmp/x && npm run build" → "빌드하는 중"
// 말풍선·이벤트 로그에 명령어·경로가 그대로 보이지 않게. "제목: 대상" 형태면 말풍선이 두 줄로 나눠 보여 줌.

const base = (p: string) => p.replace(/["']/g, "").replace(/\/+$/, "").split("/").pop() || p;

/** 명령 줄 하나에서 의미 있는 부분(앞의 cd·export·환경변수 등을 뺀 첫 명령)을 고른다 */
function mainPart(cmd: string): string[] {
  const parts = cmd.split(/\s*(?:&&|\|\||;|\|)\s*/).map(s => s.trim()).filter(Boolean);
  for (const p of parts) {
    const w = p.replace(/^(?:[A-Z_][A-Z0-9_]*=\S*\s+)+/, "").split(/\s+/);   // FOO=1 npm test → npm test
    if (!w[0] || /^(cd|export|set|source|\.|echo|printf|true|clear|pushd|popd)$/.test(w[0])) continue;
    return w;
  }
  return [];
}

export function describeCommand(cmd: string): string {
  const w = mainPart(cmd.trim());
  if (!w.length) return "폴더 이동 중";
  let [c, a = "", b = ""] = w.map(x => x.replace(/^["']|["']$/g, ""));
  c = base(c);
  const sub = (s: string) => s.toLowerCase();
  if (c === "sudo") return describeCommand(w.slice(1).join(" "));
  if (/^(npm|pnpm|yarn|bun)$/.test(c)) {
    const s = sub(a === "run" ? b : a);
    if (/^(i|install|add|ci)$/.test(s)) return "패키지 설치 중";
    if (/test/.test(s)) return "테스트 돌리는 중";
    if (/build/.test(s)) return "빌드하는 중";
    if (/^(dev|start|serve|preview)$/.test(s)) return "서버 켜는 중";
    if (/lint|format|check/.test(s)) return "코드 점검 중";
    return s ? `npm 작업 중: ${s}` : "npm 작업 중";
  }
  if (c === "npx" || c === "bunx") {
    const t = base(a);
    if (/^tsc$/.test(t)) return "타입 검사 중";
    if (/vite|next|astro/.test(t)) return /build/.test(b) ? "빌드하는 중" : "개발 서버 켜는 중";
    if (/playwright|cypress/.test(t)) return "브라우저 테스트 중";
    if (/jest|vitest|mocha/.test(t)) return "테스트 돌리는 중";
    if (/eslint|prettier|biome/.test(t)) return "코드 점검 중";
    return `${t} 실행 중`;
  }
  if (/^(tsc)$/.test(c)) return "타입 검사 중";
  if (/^(node|deno|tsx|ts-node)$/.test(c)) return a && !a.startsWith("-") ? `스크립트 실행 중: ${base(a)}` : "자바스크립트 실행 중";
  if (/^python\d?(\.\d+)?$/.test(c)) {
    const f = w.slice(1).find(x => /\.py$/.test(x));
    if (w.includes("-m") && /pytest/.test(w.join(" "))) return "테스트 돌리는 중";
    if (w.includes("-m") && /pip/.test(w.join(" "))) return "파이썬 패키지 설치 중";
    return f ? `파이썬 실행 중: ${base(f)}` : "파이썬 코드 실행 중";
  }
  if (/^(pytest|jest|vitest|mocha)$/.test(c)) return "테스트 돌리는 중";
  if (/^pip\d?$/.test(c) || c === "uv") return "파이썬 패키지 설치 중";
  if (c === "git") {
    const s = sub(a);
    if (/^(status|log|diff|show|blame|branch|remote|ls-files|ls-tree|rev-parse|rev-list)$/.test(s)) return "Git 기록 살펴보는 중";
    if (s === "commit") return "커밋하는 중";
    if (s === "push") return "깃허브에 올리는 중";
    if (/^(pull|fetch|clone)$/.test(s)) return "깃허브에서 받아오는 중";
    if (s === "add") return "변경 사항 담는 중";
    if (/^(checkout|switch|merge|rebase|reset|stash|restore)$/.test(s)) return "브랜치 정리 중";
    return "Git 작업 중";
  }
  if (c === "gh") return /pr/.test(a) ? "PR 살펴보는 중" : "GitHub 작업 중";
  if (/^(curl|wget|http)$/.test(c)) return /127\.0\.0\.1|localhost/.test(cmd) ? "내 서버 응답 확인 중" : "인터넷 주소 확인 중";
  if (/^(ls|find|tree|du|fd|stat|file)$/.test(c)) return "폴더 둘러보는 중";
  if (/^(cat|head|tail|less|more|wc|bat)$/.test(c)) return a && !a.startsWith("-") ? `파일 내용 보는 중: ${base(a)}` : "파일 내용 보는 중";
  if (c === "sed") return /-i/.test(a) ? "파일 고치는 중" : "파일 내용 보는 중";
  if (/^(grep|rg|ag|awk)$/.test(c)) return "코드 찾아보는 중";
  if (c === "mkdir") return "폴더 만드는 중";
  if (/^(mv|cp|rsync|ln)$/.test(c)) return "파일 옮기는 중";
  if (/^(rm|rmdir|trash)$/.test(c)) return "파일 정리 중";
  if (/^(touch|chmod|chown)$/.test(c)) return "파일 설정 중";
  if (/^(sleep|until|while|for|wait|watch)$/.test(c)) return "잠깐 기다리는 중";
  if (/^(kill|pkill|killall)$/.test(c)) return "프로그램 끄는 중";
  if (/^(ps|pgrep|lsof|top|htop)$/.test(c)) return "실행 중인 프로그램 확인 중";
  if (c === "open") return "앱 여는 중";
  if (c === "osascript") return "맥 앱 조작 중";
  if (c === "launchctl") return "백그라운드 서비스 설정 중";
  if (/^(brew|port|apt|apt-get)$/.test(c)) return "프로그램 설치 중";
  if (/^(docker|docker-compose|podman)$/.test(c)) return "도커 작업 중";
  if (/^(make|cargo|go|gradle|mvn|xcodebuild|swift)$/.test(c)) return /test/.test(a) ? "테스트 돌리는 중" : "빌드하는 중";
  if (/^(sips|convert|magick|ffmpeg)$/.test(c)) return "이미지·영상 다루는 중";
  if (/^(plutil|defaults|which|whoami|uname|sw_vers|env|printenv|date|id)$/.test(c)) return "환경 확인 중";
  if (/^(zip|unzip|tar|gzip)$/.test(c)) return "압축 다루는 중";
  if (/^(ssh|scp)$/.test(c)) return "다른 컴퓨터에 접속 중";
  if (/^(bash|sh|zsh)$/.test(c)) return a && /\.sh$/.test(a) ? `스크립트 실행 중: ${base(a)}` : "셸 명령 실행 중";
  if (/^\.?\//.test(w[0]) || /\.sh$/.test(c)) return `스크립트 실행 중: ${c}`;
  return "터미널 명령 실행 중";
}
