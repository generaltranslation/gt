import chalk from 'chalk';

// GT logo monogram — matches the General Translation brand mark
// Three concentric strokes on the G, shared top bar, parallel T stems
const LOGO_LINES = [
  '    ############################  ################',
  '   ###                      ###  #### #### #### ',
  '   ###  ##################  ###  #### #### #### ',
  '   ###  ###            ###  ###  #### #### #### ',
  '   ###  ###  ########  ###  ###       ####      ',
  '   ###  ###  ####      ####  ################   ',
  '   ###  ###  ####       ######################  ',
  '   ###  ###  ###########              ####      ',
  '   ###  #################             ####      ',
  '   ###########################        ####      ',
  '',
  '        G E N E R A L   T R A N S L A T I O N   ',
];

const COLORS = [
  chalk.cyan,
  chalk.blue,
  chalk.magenta,
  chalk.red,
  chalk.yellow,
  chalk.green,
];

/**
 * Horizontally scale a line of text by a factor (0..1).
 * At scale=1, the full line is shown. At scale=0, it collapses to center.
 * This simulates a Y-axis rotation effect.
 */
function scaleLineHorizontally(line: string, scale: number): string {
  if (scale <= 0.05) return '';
  const fullWidth = line.length;
  const targetWidth = Math.max(1, Math.round(fullWidth * scale));
  const result: string[] = [];
  for (let i = 0; i < targetWidth; i++) {
    const srcIndex = Math.round((i / targetWidth) * fullWidth);
    result.push(line[Math.min(srcIndex, fullWidth - 1)] || ' ');
  }
  const pad = Math.floor((fullWidth - targetWidth) / 2);
  return ' '.repeat(pad) + result.join('');
}

/**
 * Generate rotation frames. Each frame is the logo scaled horizontally
 * by cos(angle) to simulate spinning around the Y axis.
 */
function generateFrames(): string[][] {
  const frameCount = 48;
  const frames: string[][] = [];
  for (let i = 0; i < frameCount; i++) {
    const angle = (i / frameCount) * 2 * Math.PI;
    const scale = Math.abs(Math.cos(angle));
    frames.push(LOGO_LINES.map((line) => scaleLineHorizontally(line, scale)));
  }
  return frames;
}

export async function handleArt(): Promise<void> {
  // Require interactive terminal to avoid infinite loop in non-TTY contexts
  if (!process.stdin.isTTY) {
    console.log(chalk.yellow('  gt art requires an interactive terminal (TTY).'));
    return;
  }

  const frames = generateFrames();
  let frameIndex = 0;
  let colorIndex = 0;
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

  // Hide cursor
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

  // Ensure cleanup runs on unexpected termination
  const sigHandler = () => {
    cleanup();
    process.exit();
  };
  process.once('SIGTERM', sigHandler);
  process.once('SIGINT', sigHandler);

  try {
    while (running) {
      const color = COLORS[colorIndex % COLORS.length];
      const frame = frames[frameIndex % frames.length];

      if (frameIndex > 0) {
        process.stdout.write(`\x1B[${lineCount}A`);
      }

      for (const line of frame) {
        process.stdout.write(`\x1B[2K${color(line)}\n`);
      }

      frameIndex++;
      if (frameIndex % frames.length === 0) {
        colorIndex++;
      }

      await new Promise((resolve) => setTimeout(resolve, 80));
    }
  } finally {
    cleanup();
    process.off('SIGTERM', sigHandler);
    process.off('SIGINT', sigHandler);
  }

  console.log(chalk.green('  ✨ General Translation'));
}
