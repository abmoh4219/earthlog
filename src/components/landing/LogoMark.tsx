// Earthlog's mark: a globe (outline, equator, meridian) with one story on it, in amber.
// The same drawing as src/app/icon.svg, without the tile, so it sits on any dark ground.
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="8 8 48 48" width={size} height={size} aria-hidden="true">
      <circle cx="32" cy="32" r="21" fill="none" stroke="#9ad9ff" strokeWidth="3.5" />
      <ellipse
        cx="32"
        cy="32"
        rx="9"
        ry="21"
        fill="none"
        stroke="#9ad9ff"
        strokeWidth="2.5"
        opacity="0.6"
      />
      <path d="M11 32h42" stroke="#9ad9ff" strokeWidth="2.5" opacity="0.6" />
      <circle cx="44" cy="20" r="5.5" fill="#f2b65a" stroke="#020409" strokeWidth="2.5" />
    </svg>
  );
}
