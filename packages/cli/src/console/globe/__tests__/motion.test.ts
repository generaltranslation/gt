import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { decideBanner } from '../motion.js';
import type { BannerStream } from '../motion.js';

// Each case gets its own config home, so the user's real settings never apply.
const configHome = mkdtempSync(path.join(tmpdir(), 'gt-banner-'));
const optedOutHome = path.join(configHome, 'opted-out');
mkdirSync(path.join(optedOutHome, 'gt'), { recursive: true });
writeFileSync(
  path.join(optedOutHome, 'gt', 'config.json'),
  '{ "animation": false }'
);
afterAll(() => rmSync(configHome, { recursive: true, force: true }));

const terminal: BannerStream = { isTTY: true, rows: 48, columns: 100 };

describe('decideBanner', () => {
  it.each<
    [
      string,
      {
        stream?: BannerStream;
        env?: NodeJS.ProcessEnv;
        animationFlag?: boolean;
        reducesMotion?: boolean;
      },
      ReturnType<typeof decideBanner>,
    ]
  >([
    [
      'animates in a roomy interactive terminal',
      {},
      { mode: 'animate', motion: true, reason: null },
    ],
    [
      'animates with 31 rows',
      { stream: { ...terminal, rows: 31 } },
      { mode: 'animate', motion: true, reason: null },
    ],
    [
      'stays still with 30 rows',
      { stream: { ...terminal, rows: 30 } },
      { mode: 'static', motion: true, reason: 'window is 30 rows or fewer' },
    ],
    [
      'shows only the text header when narrower than the globe',
      { stream: { ...terminal, columns: 51 } },
      {
        mode: 'text',
        motion: true,
        reason: 'window is narrower than 52 columns',
      },
    ],
    [
      'stays still when output is not a terminal',
      { stream: { isTTY: false } },
      { mode: 'static', motion: false, reason: 'output is not a terminal' },
    ],
    [
      'stays still on a dumb terminal',
      { env: { TERM: 'dumb' } },
      { mode: 'static', motion: false, reason: 'TERM is dumb' },
    ],
    [
      'stays still in CI',
      { env: { CI: 'true' } },
      { mode: 'static', motion: false, reason: 'CI is set' },
    ],
    [
      'animates when CI is false',
      { env: { CI: 'false' } },
      { mode: 'animate', motion: true, reason: null },
    ],
    [
      'stays still with --no-animation',
      { animationFlag: false },
      { mode: 'static', motion: false, reason: '--no-animation' },
    ],
    [
      'stays still with GT_NO_ANIMATION',
      { env: { GT_NO_ANIMATION: '1' } },
      { mode: 'static', motion: false, reason: 'GT_NO_ANIMATION is set' },
    ],
    [
      'animates when GT_NO_ANIMATION is 0',
      { env: { GT_NO_ANIMATION: '0' } },
      { mode: 'animate', motion: true, reason: null },
    ],
    [
      'stays still with REDUCE_MOTION',
      { env: { REDUCE_MOTION: 'true' } },
      { mode: 'static', motion: false, reason: 'REDUCE_MOTION is set' },
    ],
    [
      'stays still with NO_COLOR',
      { env: { NO_COLOR: '1' } },
      { mode: 'static', motion: false, reason: 'NO_COLOR is set' },
    ],
    [
      'stays still when the user config turns animation off',
      { env: { XDG_CONFIG_HOME: optedOutHome } },
      {
        mode: 'static',
        motion: false,
        reason: `"animation": false in ${path.join(optedOutHome, 'gt', 'config.json')}`,
      },
    ],
    [
      'stays still when the system reduces motion',
      { reducesMotion: true },
      {
        mode: 'static',
        motion: false,
        reason: 'the system Reduce Motion setting is on',
      },
    ],
  ])('%s', (_name, input, expected) => {
    expect(
      decideBanner({
        stream: input.stream ?? terminal,
        animationFlag: input.animationFlag,
        env: { XDG_CONFIG_HOME: configHome, ...input.env },
        reducesMotion: () => input.reducesMotion ?? false,
      })
    ).toEqual(expected);
  });
});
