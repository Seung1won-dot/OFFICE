// 개인용 캐릭터 스킨: assets/third-party/skins/ 에 직접 넣은 그림으로 몬스터 대신 그린다.
// 이 폴더는 .gitignore 에 들어 있어 저장소에는 절대 올라가지 않는다 (공개판은 오리지널 몬스터만).
//
//   skins/*.png          → 세션 직원(실제 Claude 세션) + 부서 폴더가 없는 배경 직원
//   skins/<부서>/*.png    → 그 부서 배경 직원 (dev, gh, plan, research, obsidian)
//   skins/main/*.png      → 주인공: 실제 세션(일 시키는 직원)이 먼저 이 중에서 받고, 남는 주인공은 늘 사무실에 나와 있음
//
// 그림 형식 두 가지:
//   1) 256x96 시트 = 32x32 칸 8열 x 3행 (아래/위/오른쪽 보기, 열: 걷기0~3·앉기·앉아 일하기·서서 깜빡·앉아 깜빡) → 그대로 사용
//   2) 그 밖의 아무 크기 그림 1장(정면 서 있는 모습, 투명 배경) → 32x32 에 맞춰 줄이고, 걷기는 통통 튀기·앉기는 내려앉기로 자동 생성
import { MW, MH, MCOLS, Stage } from "./monsters";
import { hash } from "./people";

export interface SkinSet { all: HTMLImageElement[]; by: Record<string, HTMLImageElement[]>; crop: "bust" | "full" }
const KIND_DEPT: Record<string, string> = { seat_dev: "dev", repo_desk: "gh", plan_desk: "plan", research_desk: "research", obsidian_desk: "obsidian" };

export async function loadSkins(): Promise<SkinSet | null> {
  let list: { url: string; dept: string }[] = [], crop: SkinSet["crop"] = "bust";
  try { const r = await fetch("/api/skins"); if (!r.ok) return null; const j = await r.json(); list = j.files || []; if (j.crop === "full") crop = "full"; } catch { return null; }
  if (!list.length) return null;
  const set: SkinSet = { all: [], by: {}, crop };
  await Promise.all(list.map(f => new Promise<void>(res => {
    const img = new Image();
    let done = false;
    const fin = (ok: boolean) => { if (done) return; done = true; if (ok && img.naturalWidth) { if (f.dept) (set.by[f.dept] ||= []).push(img); else set.all.push(img); } res(); };
    img.onload = () => fin(true);
    img.onerror = () => fin(false);
    setTimeout(() => fin(false), 5000);   // 어떤 그림도 화면을 막지 않게
    img.src = f.url;
  })));
  // 정렬해 두어야 새로고침해도 같은 직원이 같은 그림을 받는다
  const key = (i: HTMLImageElement) => i.src;
  set.all.sort((a, b) => key(a) < key(b) ? -1 : 1);
  for (const k in set.by) set.by[k].sort((a, b) => key(a) < key(b) ? -1 : 1);
  return set.all.length || Object.keys(set.by).length ? set : null;
}

/** 주인공(skins/main/) 그림들 — 실제 세션이 먼저 받고, 남는 주인공은 배경 직원으로 늘 사무실에 있음 */
export const mainSkins = (set: SkinSet | null) => set?.by.main ?? [];
/** 파일 이름(확장자 뺀 것, '_' 로 시작해도 그대로) — main:<이름> 열쇠에 씀 */
export const fileKey = (img: HTMLImageElement) => decodeURIComponent(img.src.split("/").pop() || "").replace(/\.[a-z]+$/i, "");

/** 주인공이 아닌 그림들 (주인공이 모자랄 때 세션 직원이 받음): skins/*.png, 없으면 부서 폴더 그림 */
export const otherSkins = (set: SkinSet | null) => !set ? [] : set.all.length ? set.all : Object.entries(set.by).filter(([k]) => k !== "main").flatMap(([, v]) => v);

/** lookKey("main:<이름>", "skin:<이름>", "npc-3-repo_desk" 또는 프로젝트 이름)로 그림 하나를 고정적으로 고른다 */
export function pickSkin(set: SkinSet, lookKey: string): HTMLImageElement | null {
  if (lookKey.startsWith("main:")) { const n = lookKey.slice(5); const hit = mainSkins(set).find(i => fileKey(i) === n); if (hit) return hit; }
  if (lookKey.startsWith("skin:")) { const n = lookKey.slice(5); const hit = otherSkins(set).find(i => fileKey(i) === n); if (hit) return hit; }
  const kind = lookKey.match(/^npc-\d+-(\w+)/)?.[1];
  const others = set.all.length ? set.all : Object.entries(set.by).filter(([k]) => k !== "main").flatMap(([, v]) => v);
  const pool = (kind && set.by[KIND_DEPT[kind]]?.length ? set.by[KIND_DEPT[kind]] : null)
    || (others.length ? others : mainSkins(set));
  return pool.length ? pool[hash(lookKey) % pool.length] : null;
}

/** 파일 이름 = 머리 위 이름표 ("민지.png" → "민지") */
export function skinName(img: HTMLImageElement): string {
  const f = decodeURIComponent(img.src.split("/").pop() || "").replace(/\.[a-z]+$/i, "");
  return f.startsWith("_") ? "" : f;
}

/** 배경 지우기 + 빈 테두리 잘라내기 (+ 세로로 긴 그림은 상반신만).
 *  네 모서리 색이 비슷한 불투명 배경이면 가장자리에서부터 그 색과 비슷한 픽셀을 투명하게 만든다. */
const prepared = new WeakMap<HTMLImageElement, HTMLCanvasElement>();
export function prepare(img: HTMLImageElement, crop: SkinSet["crop"]): HTMLCanvasElement {
  const hit = prepared.get(img); if (hit) return hit;
  const W = img.naturalWidth, H = img.naturalHeight;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const im = ctx.getImageData(0, 0, W, H), d = im.data;
  const at = (x: number, y: number) => (y * W + x) * 4;
  const near = (i: number, c: number[], tol: number) => Math.abs(d[i] - c[0]) + Math.abs(d[i + 1] - c[1]) + Math.abs(d[i + 2] - c[2]) <= tol;
  const nb = (p: number, f: (q: number) => void) => { const x = p % W; if (x > 0) f(p - 1); if (x < W - 1) f(p + 1); if (p >= W) f(p - W); if (p < W * (H - 1)) f(p + W); };
  // 1) 배경색 = 테두리에서 가장 많은 불투명 색 (시트에서 잘라낸 그림은 모서리에 검은 줄·옆 캐릭터 조각이 있어도 됨)
  const border: number[] = [];
  for (let x = 0; x < W; x++) border.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) border.push(y * W, y * W + W - 1);
  const votes = new Map<number, number>();
  let opaqueBorder = 0;
  for (const p of border) { const i = p * 4; if (d[i + 3] < 250) continue; opaqueBorder++; const k = (d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | d[i + 2] >> 4; votes.set(k, (votes.get(k) || 0) + 1); }
  if (opaqueBorder > border.length * 0.5) {
    const top = [...votes.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const c = [(top >> 8) * 16 + 8, ((top >> 4) & 15) * 16 + 8, (top & 15) * 16 + 8];
    // 2) 테두리에서부터 배경색과 비슷한 픽셀을 지움 (외곽선에서 멈춤).
    //    외곽선의 1~2px 틈으로 캐릭터 안쪽 흰 부분(배·얼굴)까지 새지 않게, 외곽선을 2px 두껍게 본 '벽'을 넘지 않는다
    const isBg = new Uint8Array(W * H);
    for (let p = 0; p < W * H; p++) isBg[p] = near(p * 4, c, 90) ? 1 : 0;
    const wall = new Uint8Array(W * H), R = 2;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (isBg[y * W + x]) continue;
      for (let yy = Math.max(0, y - R); yy <= Math.min(H - 1, y + R); yy++) for (let xx = Math.max(0, x - R); xx <= Math.min(W - 1, x + R); xx++) wall[yy * W + xx] = 1;
    }
    const gone = new Uint8Array(W * H), stack = border.filter(p => isBg[p] && !wall[p]);
    while (stack.length) {
      const p = stack.pop()!;
      if (gone[p] || !isBg[p] || wall[p]) continue;
      gone[p] = 1;
      nb(p, q => { if (!gone[q]) stack.push(q); });
    }
    // 벽 때문에 외곽선 바깥에 남은 2px 흰 띠를 마저 지움 (지운 곳에서 R 칸까지만 → 틈으로 새 들어가지 않음)
    for (let k = 0; k < R; k++) {
      const add: number[] = [];
      for (let p = 0; p < W * H; p++) if (gone[p]) nb(p, q => { if (!gone[q] && isBg[q]) add.push(q); });
      for (const q of add) gone[q] = 1;
    }
    for (let p = 0; p < W * H; p++) if (gone[p]) d[p * 4 + 3] = 0;
    // 배경과 맞닿은 흐린 가장자리(안티에일리어싱 띠)는 반투명으로
    for (let p = 0; p < W * H; p++) if (d[p * 4 + 3] && near(p * 4, c, 200)) { let edge = false; nb(p, q => { if (!d[q * 4 + 3]) edge = true; }); if (edge) d[p * 4 + 3] = 110; }
  }
  // 3) 가장 큰 덩어리(주인공)만 남기고, 테두리의 검은 줄·옆 캐릭터 조각 같은 작은 덩어리는 지움
  {
    const lab = new Int32Array(W * H).fill(-1), sizes: number[] = [], touches: boolean[] = [];
    for (let s = 0; s < W * H; s++) {
      if (lab[s] >= 0 || d[s * 4 + 3] <= 20) continue;
      const id = sizes.length, st = [s]; lab[s] = id; let n = 0, edge = false;
      while (st.length) {
        const p = st.pop()!; n++;
        const x = p % W; if (x === 0 || x === W - 1 || p < W || p >= W * (H - 1)) edge = true;
        nb(p, q => { if (lab[q] < 0 && d[q * 4 + 3] > 20) { lab[q] = id; st.push(q); } });
      }
      sizes.push(n); touches.push(edge);
    }
    if (sizes.length > 1) {
      const main = sizes.indexOf(Math.max(...sizes));
      // 주인공 말고는: 테두리에 닿은 조각은 모두, 안쪽 조각은 아주 작을 때만 지움 (떨어진 불꽃·눈물 같은 장식은 남김)
      const drop = sizes.map((n, k) => k !== main && (touches[k] || n < sizes[main] * 0.004));
      for (let p = 0; p < W * H; p++) if (lab[p] >= 0 && drop[lab[p]]) d[p * 4 + 3] = 0;
    }
  }
  ctx.putImageData(im, 0, 0);
  // 내용이 있는 영역만
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[at(x, y) + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) { prepared.set(img, cv); return cv; }
  let cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  // 32px 안에서 얼굴이 보이도록 아주 길쭉한(사람 전신 같은) 그림만, 동글동글한 캐릭터는 전신 그대로. 위쪽(상반신)만, 가로는 가운데 정사각형 근처로
  if (crop === "bust" && ch > cw * 1.6) { ch = Math.round(Math.min(ch, Math.max(cw * 1.05, ch * 0.42))); const nw = Math.min(cw, Math.round(ch * 1.0)); x0 += Math.round((cw - nw) / 2); cw = nw; }
  const out = document.createElement("canvas"); out.width = cw; out.height = ch;
  out.getContext("2d")!.drawImage(cv, x0, y0, cw, ch, 0, 0, cw, ch);
  prepared.set(img, out);
  return out;
}

/** 그림 → 몬스터 시트와 같은 배치(8열 x 3행, 32x32). 인턴(0단계)은 조금 작게 */
export function makeSkinSheet(raw: HTMLImageElement, stage: Stage, crop: SkinSet["crop"] = "bust"): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = MW * MCOLS; cv.height = MH * 3;
  const ctx = cv.getContext("2d")!;
  if (raw.naturalWidth === MW * MCOLS && raw.naturalHeight === MH * 3) { ctx.drawImage(raw, 0, 0); return cv; }
  const img = prepare(raw, crop), iw = img.width, ih = img.height;
  const maxW = MW - 2, maxH = MH - 2;
  let s = Math.min(maxW / iw, maxH / ih) * (stage === 0 ? 0.75 : 1);
  if (s > 1) s = Math.floor(s);   // 작은 도트는 정수배로만 키움
  const w = Math.max(1, Math.round(iw * s)), h = Math.max(1, Math.round(ih * s));
  ctx.imageSmoothingEnabled = s < 1;   // 큰 그림을 줄일 땐 부드럽게, 도트를 키울 땐 또렷하게
  ctx.imageSmoothingQuality = "high";
  const BOB = [0, -1, 0, -1];
  for (let r = 0; r < 3; r++) for (let c = 0; c < MCOLS; c++) {
    const sit = c === 4 || c === 5 || c === 7;
    const dy = c < 4 ? BOB[c] : sit ? 4 + (c === 5 ? -1 : 0) : 0;
    const ox = c * MW + Math.round((MW - w) / 2), oy = r * MH + (MH - 1 - h) + dy;
    ctx.save();
    ctx.beginPath(); ctx.rect(c * MW, r * MH, MW, MH); ctx.clip();   // 앉으면 아래가 의자에 가려진 듯 잘림
    ctx.drawImage(img, ox, oy, w, h);
    ctx.restore();
  }
  return cv;
}
