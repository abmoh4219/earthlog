// Pure chart geometry shared by panels (and testable without a browser).

/** Seat positions in a unit half circle (x −1…1, y 0…1), ordered left to right. */
export function parliamentSeats(total: number): { dots: { x: number; y: number }[]; r: number } {
  const rows = total <= 30 ? 3 : total <= 100 ? 5 : total <= 200 ? 7 : total <= 350 ? 9 : 11;
  const inner = 0.38;
  const radii = Array.from(
    { length: rows },
    (_, i) => inner + (i * (1 - inner)) / Math.max(1, rows - 1),
  );
  const sum = radii.reduce((a, b) => a + b, 0);
  const counts = radii.map((r) => Math.round((total * r) / sum));
  counts[rows - 1] = (counts[rows - 1] ?? 0) + total - counts.reduce((a, b) => a + b, 0);
  const dots: { x: number; y: number; a: number }[] = [];
  radii.forEach((r, i) => {
    const n = counts[i] ?? 0;
    for (let k = 0; k < n; k++) {
      const a = Math.PI - (n === 1 ? Math.PI / 2 : (k * Math.PI) / (n - 1));
      dots.push({ x: r * Math.cos(a), y: r * Math.sin(a), a });
    }
  });
  dots.sort((p, q) => q.a - p.a);
  const gap = (1 - inner) / Math.max(1, rows - 1);
  return { dots: dots.map(({ x, y }) => ({ x, y })), r: gap * 0.42 };
}
