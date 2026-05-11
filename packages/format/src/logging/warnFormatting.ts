export function warnFormatting(message: string): void {
  if (typeof process !== 'undefined' && process.env?._GT_LOG_LEVEL === 'off') {
    return;
  }
  console.warn(message);
}
