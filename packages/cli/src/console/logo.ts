// GT logo monogram — generated from assets/no-bg-gt-logo-light.png via jp2a
// jp2a gt-logo.jpg --width=50 --chars='@#%+=- '
export const LOGO_LINES = [
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

export const FRAME_COUNT = 48;

/**
 * Horizontally scale a line of text by a factor (0..1).
 * At scale=1, the full line is shown. At scale=0, it collapses to center.
 * This simulates a Y-axis rotation effect.
 */
export function scaleLineHorizontally(line: string, scale: number): string {
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
 * Generate all rotation frames for the logo animation.
 */
export function generateFrames(): string[][] {
  const frames: string[][] = [];
  for (let i = 0; i < FRAME_COUNT; i++) {
    const angle = (i / FRAME_COUNT) * 2 * Math.PI;
    const scale = Math.abs(Math.cos(angle));
    frames.push(LOGO_LINES.map((line) => scaleLineHorizontally(line, scale)));
  }
  return frames;
}
