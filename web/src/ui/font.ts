// 글꼴: 한글이 잘 보이는 무료 픽셀 폰트 Galmuri (SIL OFL 1.1, 글꼴 파일은 빌드에 포함)
//  - 캔버스(맵 위) 글씨: Galmuri7 — 7px 로 그려진 글꼴이라 2배 확대에서 선명
//  - HTML(상단 바·툴팁·사원증): Galmuri11
// 크기는 3단계만: 맵 7px, UI 11px / 13px
import g7 from "galmuri/dist/Galmuri7.woff2?url";
import g11 from "galmuri/dist/Galmuri11.woff2?url";
import g11b from "galmuri/dist/Galmuri11-Bold.woff2?url";

export const MAP_FONT = "Galmuri7, Galmuri11, monospace";
export const fontReady: Promise<void> = Promise.all([
  new FontFace("Galmuri7", `url(${g7})`),
  new FontFace("Galmuri11", `url(${g11})`),
  new FontFace("Galmuri11", `url(${g11b})`, { weight: "bold" }),
].map(f => f.load().then(ff => { (document.fonts as unknown as { add(f: FontFace): void }).add(ff); }).catch(() => { /* 실패해도 기본 글꼴로 */ }))).then(() => undefined);
