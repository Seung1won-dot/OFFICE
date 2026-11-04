// 아늑한 픽셀아트 느낌의 핵심: 불투명한 픽셀 덩어리 둘레에 진한 외곽선 1px
export const OUTLINE = "#2a1d1c";

/** (x0,y0,w,h) 영역 안에서, 불투명 픽셀과 맞닿은 투명 픽셀을 외곽선 색으로 칠한다 */
export function outlineRegion(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, color = OUTLINE) {
  const img = ctx.getImageData(x0, y0, w, h), d = img.data;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 140;
  const n = parseInt(color.slice(1), 16), cr = n >> 16, cg = (n >> 8) & 255, cb = n & 255;
  const mark: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (solid(x, y)) continue;
    if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) mark.push((y * w + x) * 4);
  }
  for (const i of mark) { d[i] = cr; d[i + 1] = cg; d[i + 2] = cb; d[i + 3] = 255; }
  ctx.putImageData(img, x0, y0);
}
