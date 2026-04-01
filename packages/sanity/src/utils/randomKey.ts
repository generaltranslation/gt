export function randomKey(): string {
  return Math.random().toString(36).slice(2, 10);
}
