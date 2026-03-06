import chalk from 'chalk';

// GT logo monogram — generated from assets/no-bg-gt-logo-light.png via jp2a
// jp2a gt-logo.jpg --width=50 --chars='@#%+=- '
const LOGO_LINES = [
  '               -============================      ',
  '          -=%#@#%%%%%%%%%%%%%%#@#%%%%%%%%%%%      ',
  '        -%@#+--=++++++++++++++%@+ =+++++++++      ',
  '       +@#--+##%+=============%@+ %@+=======      ',
  '      +@% =@#=                +@+ %@-             ',
  '      @@ -@#                  +@+ %@-             ',
  '     -@# =@+       #@@@@@@@#  +@+ %@-             ',
  '      @@ -@#       -====- @@  +@+ %@-             ',
  '      =@% =@#=     %###@+ @@  +@+ %@-             ',
  '       =@#--+##%+==+%#@@+ @@  +@+ %@-             ',
  '        -%@#+--=++++=-+@+ #=  +@+ %@-             ',
  '           =%#@#%%%%###%=     +@+ %@-             ',
  '               --===--        -=- -=              ',
];

const FRAME_COUNT = 48;

/**
 * Horizontally scale a line of text by a factor (0..1).
 * At scale=1, the full line is shown. At scale=0, it collapses to center.
 * This simulates a Y-axis rotation effect.
 */
function scaleLineHorizontally(line: string, scale: number): string {
  if (scale <= 0.05) return '';
  const fullWidth = line.length;
  if (fullWidth === 0) return '';
  const targetWidth = Math.max(1, Math.round(fullWidth * scale));
  const result: string[] = [];
  for (let i = 0; i < targetWidth; i++) {
    const srcIndex = Math.min(
      Math.round((i / targetWidth) * fullWidth),
      fullWidth - 1
    );
    result.push(line[srcIndex] || ' ');
  }
  const pad = Math.max(0, Math.floor((fullWidth - targetWidth) / 2));
  return ' '.repeat(pad) + result.join('');
}

/**
 * Generate rotation frames. Each frame is the logo scaled horizontally
 * by cos(angle) to simulate spinning around the Y axis.
 */
function generateFrames(): string[][] {
  const frames: string[][] = [];
  for (let i = 0; i < FRAME_COUNT; i++) {
    const angle = (i / FRAME_COUNT) * 2 * Math.PI;
    const scale = Math.abs(Math.cos(angle));
    frames.push(LOGO_LINES.map((line) => scaleLineHorizontally(line, scale)));
  }
  return frames;
}

/**
 * Render a single frame of the animation.
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
 * Interactive art command — loops until user presses q/Escape.
 * Used by `gt art`.
 */
export async function handleArt(): Promise<void> {
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
      await new Promise((resolve) => setTimeout(resolve, 80));
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
 * Falls back to a static logo if not running in a TTY.
 */
export async function playIntroAnimation(
  rotations: number = 2
): Promise<void> {
  if (!process.stdout.isTTY) {
    // Non-TTY: just print the static logo
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
    renderFrame(
      frames[i % frames.length],
      lineCount,
      i === 0,
      chalk.white
    );
    await new Promise((resolve) => setTimeout(resolve, 80));
  }

  // Clear the animation and show cursor
  process.stdout.write(`\x1B[${lineCount}A`);
  for (let i = 0; i < lineCount; i++) {
    process.stdout.write('\x1B[2K\n');
  }
  process.stdout.write(`\x1B[${lineCount}A`);
  process.stdout.write('\x1B[?25h');
}
