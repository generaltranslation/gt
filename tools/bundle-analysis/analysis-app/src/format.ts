/** Byte sizes in kB (1000 bytes), matching the output of Vite and Next. */
export function formatBytes(bytes: number): string {
  if (Math.abs(bytes) < 1000) return `${bytes} B`;
  const kb = bytes / 1000;
  if (Math.abs(kb) < 1000) return `${kb.toFixed(kb < 100 ? 1 : 0)} kB`;
  return `${(kb / 1000).toFixed(2)} MB`;
}

/** A signed size change, or null when nothing changed. */
export function formatDelta(delta: number): string | null {
  if (delta === 0) return null;
  const sign = delta > 0 ? '+' : '−';
  return `${sign}${formatBytes(Math.abs(delta))}`;
}

export function formatPercent(part: number, whole: number): string {
  if (whole === 0) return '0%';
  const value = (part / whole) * 100;
  return `${value < 1 ? value.toFixed(2) : value.toFixed(1)}%`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}
