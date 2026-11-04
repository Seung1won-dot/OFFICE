// 사무실 고양이 스프라이트 (코드로 그림): 0 앉기, 1·2 걷기, 3 둥글게 자기
import { outlineRegion } from "./outline";

export const CAT_W = 16, CAT_H = 12;
export function makeCatSheet(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = CAT_W * 4; c.height = CAT_H;
  const ctx = c.getContext("2d")!;
  const body = "#e0a050", stripe = "#b0703a", light = "#f4d8a8", eye = "#2a1d1c", pink = "#e88a8a";
  const frame = (i: number, draw: (p: (x: number, y: number, w: number, h: number, col: string) => void) => void) => {
    const p = (x: number, y: number, w: number, h: number, col: string) => { ctx.fillStyle = col; ctx.fillRect(i * CAT_W + x, y, w, h); };
    p(3, 11, 10, 1, "rgba(40,20,10,0.25)");   // 그림자
    draw(p);
    outlineRegion(ctx, i * CAT_W, 0, CAT_W, CAT_H);
  };
  // 앉기 (오른쪽 보기)
  frame(0, (p) => {
    p(4, 5, 6, 6, body); p(5, 6, 1, 4, stripe); p(7, 6, 1, 4, stripe); p(5, 9, 4, 2, light);
    p(8, 2, 5, 4, body); p(8, 1, 1, 1, body); p(12, 1, 1, 1, body); p(11, 3, 1, 1, eye); p(9, 3, 1, 1, eye); p(10, 4, 1, 1, pink);
    p(2, 8, 2, 1, body); p(1, 6, 1, 2, body);   // 꼬리
  });
  // 걷기 1, 2
  for (const k of [1, 2]) frame(k, (p) => {
    p(3, 5, 8, 4, body); p(5, 5, 1, 3, stripe); p(7, 5, 1, 3, stripe); p(9, 5, 1, 3, stripe); p(4, 8, 6, 1, light);
    p(10, 3, 4, 4, body); p(10, 2, 1, 1, body); p(13, 2, 1, 1, body); p(12, 4, 1, 1, eye); p(13, 5, 1, 1, pink);
    const a = k === 1;
    p(a ? 4 : 5, 9, 1, 2, body); p(a ? 9 : 8, 9, 1, 2, body); p(a ? 6 : 7, 9, 1, 2, stripe);
    p(1, a ? 3 : 4, 2, 1, body); p(2, 4, 1, 2, body);
  });
  // 둥글게 자기
  frame(3, (p) => {
    p(3, 6, 10, 5, body); p(4, 5, 8, 1, body); p(5, 7, 1, 3, stripe); p(8, 7, 1, 3, stripe); p(11, 7, 1, 3, stripe);
    p(9, 7, 3, 3, body); p(10, 8, 1, 1, eye); p(11, 8, 1, 1, eye);   // 감은 눈
    p(3, 10, 7, 1, light); p(2, 9, 2, 2, body);
  });
  return c;
}
