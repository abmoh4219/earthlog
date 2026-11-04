/** Soft cinematic shading: keeps the HUD and captions legible over bright imagery. */
export function Vignette() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[5]">
      <div className="absolute inset-x-0 top-0 h-[34vh] bg-linear-to-b from-black/75 via-black/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-[42vh] bg-linear-to-t from-black/80 via-black/35 to-transparent" />
      <div className="absolute inset-0 [background:radial-gradient(ellipse_at_center,transparent_55%,rgb(0_0_0/0.55)_100%)]" />
    </div>
  );
}
