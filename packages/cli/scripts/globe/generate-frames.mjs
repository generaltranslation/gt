// Renders the CLI banner's globe animation and writes the frames to
// src/console/globe/frames.generated.ts. Rerun after changing render.mjs:
//   pnpm --filter gt generate-globe-frames
import { writeFileSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';

import { cycle, frame, H, timeline } from './render.mjs';

const OUTPUT = new URL(
  '../../src/console/globe/frames.generated.ts',
  import.meta.url
);

const toLevels = (cells) => Uint8Array.from(cells.flat());
const intro = timeline().map((pose) => toLevels(frame(pose)));
const loop = cycle().map((pose) => toLevels(frame(pose)));
const rest = toLevels(frame());

const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
if (!same(intro.at(-1), rest) || !same(loop.at(-1), rest)) {
  throw new Error('The intro and the loop must both end on the resting logo');
}

const frames = [...intro, ...loop];
const columns = frames[0].length / H;
const packed = Buffer.concat(frames.map((f) => Buffer.from(f)));
const data = deflateRawSync(packed, { level: 9 }).toString('base64');

writeFileSync(
  OUTPUT,
  `/* Written by scripts/globe/generate-frames.mjs from scripts/globe/render.mjs. Do not edit by hand. */

/**
 * The banner globe's frames: ${intro.length} intro frames, then ${loop.length} loop frames.
 * Both end on the resting logo. Each frame is ${H} rows by ${columns} columns of
 * cells (0 empty, otherwise 1 + ramp character * 21 + brightness within
 * it), packed row by row, raw-deflated and base64 encoded.
 */
export const GLOBE_FRAMES = {
  rows: ${H},
  columns: ${columns},
  introFrames: ${intro.length},
  loopFrames: ${loop.length},
  data: '${data}',
} as const;
`
);
process.stdout.write(
  `${frames.length} frames, ${packed.length} bytes raw, ${data.length} bytes encoded` +
    '\n'
);
