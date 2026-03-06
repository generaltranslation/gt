import chalk from 'chalk';
import { LOGO_LINES, FRAME_COUNT, generateFrames } from './logo.js';

const FRAME_INTERVAL_MS = 80;

/**
 * Render a single frame of the animation to stdout.
 */
function renderFrame(
  frame: string[],
  lineCount: number,
  isFirst: boolean,
  color: (s: string) => string
): void {
  if (!isFirst) {
    process.stdout.write(`\x1B[${lineCount}A`);
  }
  for (const line of frame) {
    process.stdout.write(`\x1B[2K${color(line)}\n`);
  }
}

/**
 * Interactive animation — loops until user presses q/Escape.
 * Used by `gt art`.
 */
export async function runInteractiveAnimation(): Promise<void> {
  if (!process.stdin.isTTY) {
    console.log(chalk.yellow('  gt art requires an interactive terminal (TTY).'));
    return;
  }

  const frames = generateFrames();
  let frameIndex = 0;
  let running = true;

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  const onKey = (key: string) => {
    if (key === 'q' || key === 'Q' || key === '\u001b' || key === '\u0003') {
      running = false;
    }
  };

  process.stdin.on('data', onKey);
  process.stdout.write('\x1B[?25l');
  console.log(chalk.dim('\n  Press q or Escape to exit\n'));

  const lineCount = LOGO_LINES.length;

  const cleanup = () => {
    process.stdout.write('\x1B[?25h');
    process.stdin.setRawMode(false);
    process.stdin.removeListener('data', onKey);
    process.stdin.pause();
    console.log();
  };

  const sigHandler = () => {
    cleanup();
    process.exit();
  };
  process.once('SIGTERM', sigHandler);
  process.once('SIGINT', sigHandler);

  try {
    while (running) {
      renderFrame(
        frames[frameIndex % frames.length],
        lineCount,
        frameIndex === 0,
        chalk.white
      );
      frameIndex++;
      await new Promise((resolve) => setTimeout(resolve, FRAME_INTERVAL_MS));
    }
  } finally {
    cleanup();
    process.off('SIGTERM', sigHandler);
    process.off('SIGINT', sigHandler);
  }

  console.log(chalk.white('  ✨ General Translation'));
}

/**
 * Brief intro animation — plays a fixed number of rotations then stops.
 * Used by `gt init` to greet users in interactive mode.
 * Falls back to a static logo if stdout is not a TTY.
 */
export async function playIntroAnimation(
  rotations: number = 2
): Promise<void> {
  if (!process.stdout.isTTY) {
    console.log();
    for (const line of LOGO_LINES) {
      console.log(chalk.white(line));
    }
    console.log();
    return;
  }

  const frames = generateFrames();
  const totalFrames = FRAME_COUNT * rotations;
  const lineCount = LOGO_LINES.length;

  process.stdout.write('\x1B[?25l');
  console.log();

  for (let i = 0; i < totalFrames; i++) {
    renderFrame(frames[i % frames.length], lineCount, i === 0, chalk.white);
    await new Promise((resolve) => setTimeout(resolve, FRAME_INTERVAL_MS));
  }

  // Clear animation area and restore cursor
  process.stdout.write(`\x1B[${lineCount}A`);
  for (let i = 0; i < lineCount; i++) {
    process.stdout.write('\x1B[2K\n');
  }
  process.stdout.write(`\x1B[${lineCount}A`);
  process.stdout.write('\x1B[?25h');
}
