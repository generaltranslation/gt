import chalk from 'chalk';
import type { GlobeFrame } from './frames.js';

// Brightness ramp, dim to bright, as in donut.c.
const RAMP = '.,-~:;=!*#$@';
type Rgb = [number, number, number];
const SHADOW: Rgb = [20, 70, 120];
const BASE: Rgb = [60, 190, 215];
const HIGHLIGHT: Rgb = [215, 252, 255];

const mix = (from: Rgb, to: Rgb, t: number): Rgb =>
  from.map((c, i) => Math.round(c + (to[i] - c) * t)) as Rgb;

// A cell is 0 when empty, otherwise 1 + char * SUBLEVELS + sub: char indexes
// RAMP exactly, and sub places the brightness within that character's band
// (scripts/globe/render.mjs encodes it).
const SUBLEVELS = 21;

function charOf(cell: number): string {
  return RAMP[Math.floor((cell - 1) / SUBLEVELS)];
}

function levelOf(cell: number): number {
  const char = Math.floor((cell - 1) / SUBLEVELS);
  const sub = (cell - 1) % SUBLEVELS;
  const level = (char - 0.5 + (sub + 0.5) / SUBLEVELS) / (RAMP.length - 1);
  return Math.min(1, Math.max(0, level));
}

function colorOf(cell: number): Rgb {
  const level = levelOf(cell);
  return level < 0.5
    ? mix(SHADOW, BASE, level / 0.5)
    : mix(BASE, HIGHLIGHT, (level - 0.5) / 0.5);
}

/**
 * Turns a frame into terminal lines. Colors go through chalk, so they follow
 * the terminal's color depth (truecolor, 256 or 16 colors) and NO_COLOR.
 */
export function paintFrame(
  frame: GlobeFrame,
  columns: number,
  color: boolean
): string[] {
  const lines: string[] = [];
  for (let start = 0; start < frame.length; start += columns) {
    let line = '';
    let run = '';
    let runCell = -1;
    const flush = () => {
      if (!run) return;
      line += color && runCell > 0 ? chalk.rgb(...colorOf(runCell))(run) : run;
      run = '';
    };
    for (let i = start; i < start + columns; i++) {
      const cell = frame[i];
      if (cell !== runCell) {
        flush();
        runCell = cell;
      }
      run += cell === 0 ? ' ' : charOf(cell);
    }
    flush();
    lines.push(line.trimEnd());
  }
  return lines;
}
