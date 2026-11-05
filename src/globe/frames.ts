// Each rendered globe frame, for whoever needs the pixels (the clip recorder). The engine
// publishes from Cesium's postRender, when the WebGL drawing buffer is still valid, so a
// subscriber can drawImage() the canvas without preserveDrawingBuffer.
/** `tilesLoaded`: every imagery and terrain tile for this view is in (a sharp frame). */
type Listener = (canvas: HTMLCanvasElement, tilesLoaded: boolean) => void;
const listeners = new Set<Listener>();

export function onGlobeFrame(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function publishGlobeFrame(canvas: HTMLCanvasElement, tilesLoaded = true): void {
  for (const l of listeners) l(canvas, tilesLoaded);
}
