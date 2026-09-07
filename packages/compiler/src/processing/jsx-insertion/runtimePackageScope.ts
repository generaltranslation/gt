/** Match only verified package roots supplied by the framework adapter. */
export function isAutoJsxRuntimeResource(
  filename: string | null | undefined,
  roots: readonly string[]
): boolean {
  if (typeof filename !== 'string') return false;
  const file = filename.replace(/\\/g, '/');
  return roots.some((value) => {
    const root = value.replace(/\\/g, '/').replace(/\/+$/, '');
    if (!root || (file !== root && !file.startsWith(`${root}/`))) return false;
    const relative = file.slice(root.length).split(/[?#]/, 1)[0];
    // A nested dependency is a separate package unless the adapter independently
    // verified its own root. Query values are not filesystem path segments.
    return !relative.split('/').includes('node_modules');
  });
}
