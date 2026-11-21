import { inflateRawSync } from 'node:zlib';
import { GLOBE_FRAMES } from './frames.generated.js';

/** One frame: `rows * columns` brightness levels (0 empty, 1..255), row by row. */
export type GlobeFrame = Uint8Array;

export type GlobeFrameSet = {
  rows: number;
  columns: number;
  intro: GlobeFrame[];
  loop: GlobeFrame[];
  /** The resting logo; the intro and every loop end on it. */
  rest: GlobeFrame;
};

let decoded: GlobeFrameSet | undefined;

export function getGlobeFrames(): GlobeFrameSet {
  if (decoded) return decoded;
  const { rows, columns, introFrames, loopFrames, data } = GLOBE_FRAMES;
  const packed = inflateRawSync(Buffer.from(data, 'base64'));
  const size = rows * columns;
  const frames = Array.from({ length: introFrames + loopFrames }, (_, i) =>
    packed.subarray(i * size, (i + 1) * size)
  );
  decoded = {
    rows,
    columns,
    intro: frames.slice(0, introFrames),
    loop: frames.slice(introFrames),
    rest: frames[introFrames - 1],
  };
  return decoded;
}
