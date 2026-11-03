import { FINISHES, type FinishKey } from "../studio/spec";

export type NormalField = { size: number; x: Float32Array; y: Float32Array; z: Float32Array };
export type Light = { u: number; v: number };

const GAMMA = new Uint8ClampedArray(1024).map((_, index) => Math.round(255 * Math.pow(index / 1023, 1 / 2.2)));
const encode = (value: number) => GAMMA[Math.max(0, Math.min(1023, (value * 1023) | 0))]!;

export function hexToLinear(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (byte: number) => Math.pow(byte / 255, 2.2);
  return [channel((value >> 16) & 255), channel((value >> 8) & 255), channel(value & 255)];
}

export function decodeNormals(pixels: Uint8ClampedArray, size: number): NormalField {
  const count = size * size;
  const field = { size, x: new Float32Array(count), y: new Float32Array(count), z: new Float32Array(count) };
  for (let index = 0; index < count; index++) {
    const nx = pixels[index * 4]! / 127.5 - 1;
    const ny = pixels[index * 4 + 1]! / 127.5 - 1;
    const nz = pixels[index * 4 + 2]! / 127.5 - 1;
    const length = Math.hypot(nx, ny, nz) || 1;
    field.x[index] = nx / length;
    field.y[index] = ny / length;
    field.z[index] = nz / length;
  }
  return field;
}

export function finishLook(finish: FinishKey) {
  const { roughness, clearcoat, sheen } = FINISHES[finish];
  return { shine: Math.max(2, 2 / Math.pow(roughness, 3.2)), gloss: 0.05 + clearcoat * 0.9, sheen: sheen * 0.35 };
}

export function relight(out: Uint8ClampedArray, width: number, field: NormalField, zoom: number, base: [number, number, number], finish: FinishKey, light: Light) {
  const { shine, gloss, sheen } = finishLook(finish);
  const height = out.length / 4 / width;
  const step = (field.size * zoom) / width;
  const lift = 0.55;
  for (let row = 0; row < height; row++) {
    const v = row / height;
    const texelRow = ((row * step) | 0) % field.size;
    for (let column = 0; column < width; column++) {
      const u = column / width;
      const texel = texelRow * field.size + (((column * step) | 0) % field.size);
      const nx = field.x[texel]!;
      const ny = field.y[texel]!;
      const nz = field.z[texel]!;
      let lx = light.u - u;
      let ly = v - light.v;
      const distance = lx * lx + ly * ly;
      const inverse = 1 / Math.sqrt(distance + lift * lift);
      lx *= inverse;
      ly *= inverse;
      const lz = lift * inverse;
      const diffuse = Math.max(0, nx * lx + ny * ly + nz * lz);
      const hz = lz + 1;
      const half = 1 / Math.sqrt(lx * lx + ly * ly + hz * hz);
      const facing = Math.max(0, (nx * lx + ny * ly + nz * hz) * half);
      const falloff = 1 / (1 + distance * 1.6);
      const highlight = gloss * Math.pow(facing, shine) * falloff;
      const rim = sheen * (1 - nz) * 2;
      const shade = 0.16 + 1.05 * diffuse * falloff;
      const index = (row * width + column) * 4;
      out[index] = encode(base[0] * shade + highlight + rim * base[0]);
      out[index + 1] = encode(base[1] * shade + highlight + rim * base[1]);
      out[index + 2] = encode(base[2] * shade + highlight + rim * base[2]);
      out[index + 3] = 255;
    }
  }
}
