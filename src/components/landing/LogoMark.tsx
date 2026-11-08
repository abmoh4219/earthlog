// Earthlog's mark: a globe (outline, equator, meridian) in moonlight with one story on it, in
// sodium amber. The same drawing as src/app/icon.svg, without the tile.
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="8 8 48 48" width={size} height={size} aria-hidden="true">
      <circle cx="32" cy="32" r="21" fill="none" stroke="#f1ebdf" strokeWidth="3.5" />
      <ellipse
        cx="32"
        cy="32"
        rx="9"
        ry="21"
        fill="none"
        stroke="#f1ebdf"
        strokeWidth="2.5"
        opacity="0.5"
      />
      <path d="M11 32h42" stroke="#f1ebdf" strokeWidth="2.5" opacity="0.5" />
      <circle cx="44" cy="20" r="5.5" fill="#ffb547" stroke="#07090f" strokeWidth="2.5" />
    </svg>
  );
}
