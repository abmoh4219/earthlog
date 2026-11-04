// Label decluttering: which labels to show so none overlap on screen. Pure, so it is tested
// without Cesium; the globe calls it every frame with each label's screen box.

export interface LabelBox {
  /** Screen box, in pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Higher goes first (primary places, then the order the lens gave). */
  priority: number;
}

/** Greedy: the most important label wins, then each next one shows only if it fits. */
export function declutter(boxes: readonly LabelBox[], gap = 4): boolean[] {
  const order = boxes
    .map((_, i) => i)
    .sort((a, b) => (boxes[b]?.priority ?? 0) - (boxes[a]?.priority ?? 0));
  const kept: LabelBox[] = [];
  const show = boxes.map(() => false);
  for (const i of order) {
    const b = boxes[i];
    if (!b) continue;
    const clash = kept.some(
      (k) =>
        b.x < k.x + k.w + gap &&
        k.x < b.x + b.w + gap &&
        b.y < k.y + k.h + gap &&
        k.y < b.y + b.h + gap,
    );
    if (!clash) {
      kept.push(b);
      show[i] = true;
    }
  }
  return show;
}
