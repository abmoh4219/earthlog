// A minimal PNG decoder for terrain tiles: 8-bit RGB or RGBA, not interlaced (what the
// AWS Terrain Tiles serve). Node's zlib does the inflating, so no dependency is needed.
// Spec: https://www.w3.org/TR/png/ (chunks, filter types 0–4, Paeth predictor).
import { inflateSync } from "node:zlib";

export interface Image {
  width: number;
  height: number;
  channels: number;
  data: Uint8Array;
}

export function decodePng(buf: Uint8Array): Image {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat: Uint8Array[] = [];
  for (let i = 8; i < buf.length; ) {
    const len = view.getUint32(i);
    const type = String.fromCharCode(...buf.subarray(i + 4, i + 8));
    const body = buf.subarray(i + 8, i + 8 + len);
    if (type === "IHDR") {
      const v = new DataView(body.buffer, body.byteOffset, body.byteLength);
      width = v.getUint32(0);
      height = v.getUint32(4);
      const depth = body[8];
      const colour = body[9];
      if (depth !== 8 || (colour !== 2 && colour !== 6) || body[12] !== 0)
        throw new Error(
          `unsupported PNG (depth ${depth}, colour ${colour}, interlace ${body[12]})`,
        );
      channels = colour === 2 ? 3 : 4;
    } else if (type === "IDAT") idat.push(body);
    else if (type === "IEND") break;
    i += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const row = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? (out[row + x - channels] ?? 0) : 0;
      const b = y > 0 ? (out[row - stride + x] ?? 0) : 0;
      const c = x >= channels && y > 0 ? (out[row - stride + x - channels] ?? 0) : 0;
      const v = raw[src + x] ?? 0;
      let p = 0;
      if (filter === 1) p = a;
      else if (filter === 2) p = b;
      else if (filter === 3) p = (a + b) >> 1;
      else if (filter === 4) {
        const pa = Math.abs(b - c);
        const pb = Math.abs(a - c);
        const pc = Math.abs(a + b - 2 * c);
        p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[row + x] = (v + p) & 0xff;
    }
  }
  return { width, height, channels, data: out };
}
