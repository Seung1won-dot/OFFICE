// 머리 옆 작은 상태 아이콘 (코드로 그린 픽셀): 확인 필요 ❗ · 생각 중 💭 · 방금 완료 ✨
import Phaser from "phaser";

const OUT = "#3a2a2a";
type Px = (x: number, y: number, c: string, w?: number, h?: number) => void;

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (px: Px) => void) {
  if (scene.textures.exists(key)) return;
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d")!;
  draw((x, y, c, ww = 1, hh = 1) => { ctx.fillStyle = c; ctx.fillRect(x, y, ww, hh); });
  scene.textures.addCanvas(key, cv);
}

export function ensureEmotes(scene: Phaser.Scene) {
  // ❗ 노란 느낌표 (외곽선)
  make(scene, "emo-alert", 5, 11, px => {
    px(1, 0, OUT, 3, 8); px(0, 1, OUT, 5, 6); px(1, 8, OUT, 3, 3);
    px(1, 1, "#ffd166", 3, 5); px(2, 6, "#ffd166"); px(2, 9, "#ffd166"); px(1, 1, "#fff2c2");
  });
  // 💭 생각 구름 — 점 세 개가 차례로 진해지는 3프레임
  for (let f = 0; f < 3; f++) make(scene, `emo-think-${f}`, 13, 11, px => {
    px(2, 0, OUT, 9, 1); px(1, 1, OUT, 1, 1); px(11, 1, OUT); px(0, 2, OUT, 1, 4); px(12, 2, OUT, 1, 4); px(1, 6, OUT); px(11, 6, OUT); px(2, 7, OUT, 9, 1);
    px(1, 2, "#ffffff", 11, 4); px(2, 1, "#ffffff", 9, 1); px(2, 6, "#ffffff", 9, 1);
    for (let k = 0; k < 3; k++) px(3 + k * 3, 4, k === f ? "#5a4a5a" : "#c9bcc9", 2, 1);
    px(2, 8, OUT, 2, 2); px(0, 10, OUT);   // 꼬리 방울
  });
  // ✨ 반짝이 — 크게/작게 2프레임
  make(scene, "emo-spark-0", 9, 9, px => {
    px(4, 0, "#fff2c2", 1, 9); px(0, 4, "#fff2c2", 9, 1); px(3, 3, "#ffd166", 3, 3); px(4, 4, "#ffffff");
    px(1, 1, "#ffd166"); px(7, 1, "#ffd166"); px(1, 7, "#ffd166"); px(7, 7, "#ffd166");
  });
  make(scene, "emo-spark-1", 9, 9, px => { px(4, 2, "#fff2c2", 1, 5); px(2, 4, "#fff2c2", 5, 1); px(4, 4, "#ffffff"); });
  // z z — 꾸벅꾸벅 (정원 벤치에서 졸 때). 작은 z 부터 하나씩 떠오르는 3프레임
  const z = (px: (x: number, y: number, c: string, w?: number, h?: number) => void, x: number, y: number, s: number) => {
    px(x - 1, y - 1, OUT, s + 2, s + 2);
    px(x, y, "#ffffff", s, 1); px(x, y + s - 1, "#ffffff", s, 1);           // 윗줄 · 아랫줄
    for (let k = 1; k < s - 1; k++) px(x + s - 1 - k, y + k, "#ffffff");      // 오른쪽 위 → 왼쪽 아래 사선
  };
  for (let f = 0; f < 3; f++) make(scene, `emo-zzz-${f}`, 16, 17, px => {
    z(px, 1, 11, 4);
    if (f >= 1) z(px, 5, 6, 4);
    if (f >= 2) z(px, 10, 1, 5);
  });
}

/** 우산 (비·눈 올 때 건물 밖에 있는 직원 머리 위). 색 5가지: umbrella-0 ~ umbrella-4 */
export const UMBRELLAS = 5;
export function ensureUmbrellas(scene: Phaser.Scene) {
  const COLORS: [string, string, string][] = [["#e8574a", "#f48a7a", "#b8403a"], ["#f2c84b", "#fbe28a", "#c99d2a"], ["#5aa0e6", "#8cc2f4", "#3d78b8"],
    ["#f29ab8", "#f9c4d6", "#c46a8c"], ["#6cc070", "#9ad99a", "#4a9050"]];
  const ROWS: [number, number][] = [[7, 7], [5, 9], [3, 11], [2, 12], [1, 13], [0, 14], [0, 14]];   // 줄마다 왼쪽·오른쪽 끝 (둥근 지붕)
  COLORS.forEach(([base, light, dark], i) => make(scene, `umbrella-${i}`, 15, 11, px => {
    ROWS.forEach(([x0, x1], r) => {
      for (let x = x0; x <= x1; x++) {
        const edge = x === x0 || x === x1 || r === 0;
        px(x, r, edge ? OUT : r === 6 ? (x % 2 ? dark : base) : Math.floor((x + 1) / 3) % 2 ? light : base);
      }
    });
    px(4, 2, "#ffffff");                                        // 반짝
    px(7, 7, OUT); px(7, 8, OUT); px(7, 9, OUT); px(6, 10, OUT); px(7, 10, OUT);   // 손잡이
  }));
}

export type Emote = "" | "alert" | "think" | "spark" | "zzz";

/** 지금 보여줄 아이콘과 프레임 텍스처 */
export function emoteFrame(e: Emote, now: number): string {
  if (e === "alert") return "emo-alert";
  if (e === "think") return `emo-think-${Math.floor(now / 380) % 3}`;
  if (e === "spark") return `emo-spark-${Math.floor(now / 300) % 2}`;
  if (e === "zzz") return `emo-zzz-${Math.floor(now / 700) % 3}`;
  return "";
}
