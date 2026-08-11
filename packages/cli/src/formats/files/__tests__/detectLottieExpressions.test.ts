import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';

import { lottieHasExpressions } from '../detectLottieExpressions.js';

// Build a base64 dotLottie ZIP from a map of entry name -> JSON value.
function dotLottie(entries: { [name: string]: unknown }): string {
  const files: { [name: string]: Uint8Array } = {};
  for (const [name, value] of Object.entries(entries)) {
    files[name] = strToU8(JSON.stringify(value));
  }
  return Buffer.from(zipSync(files)).toString('base64');
}

const manifest = { animations: [{ id: 'anim' }] };

describe('lottieHasExpressions', () => {
  it('flags a string-valued `x` expression on an animated property', () => {
    const anim = {
      layers: [{ ks: { p: { a: 0, k: [0, 0], x: 'wiggle(2,10)' } } }],
    };
    const b64 = dotLottie({
      'manifest.json': manifest,
      'animations/a.json': anim,
    });
    expect(lottieHasExpressions(b64)).toBe(true);
  });

  it('does NOT flag a split-dimension `x` (object, not a string)', () => {
    // Separated position: `x` and `y` are nested property OBJECTS, never code.
    const anim = {
      layers: [
        { ks: { p: { s: true, x: { a: 0, k: 0 }, y: { a: 0, k: 0 } } } },
      ],
    };
    const b64 = dotLottie({
      'manifest.json': manifest,
      'animations/a.json': anim,
    });
    expect(lottieHasExpressions(b64)).toBe(false);
  });

  it('does not flag an empty-string `x`', () => {
    const anim = { layers: [{ ks: { o: { a: 0, k: 100, x: '' } } }] };
    const b64 = dotLottie({ 'animations/a.json': anim });
    expect(lottieHasExpressions(b64)).toBe(false);
  });

  it('returns false for a clean animation', () => {
    const anim = { layers: [{ ks: { p: { a: 0, k: [10, 20] } } }] };
    const b64 = dotLottie({
      'manifest.json': manifest,
      'animations/a.json': anim,
    });
    expect(lottieHasExpressions(b64)).toBe(false);
  });

  it('detects expressions in a bare bodymovin JSON with a .lottie extension', () => {
    const bare = { layers: [{ ks: { r: { a: 0, k: 0, x: 'time*50' } } }] };
    const b64 = Buffer.from(JSON.stringify(bare)).toString('base64');
    expect(lottieHasExpressions(b64)).toBe(true);
  });

  it('returns false for non-Lottie / unreadable payloads', () => {
    // Fake ZIP magic that is not a valid archive — must not throw.
    const notAZip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff]).toString(
      'base64'
    );
    expect(lottieHasExpressions(notAZip)).toBe(false);
    expect(lottieHasExpressions('')).toBe(false);
  });
});
