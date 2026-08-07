import { discoverVueProject } from './scopes.js';

/**
 * Returns whether a project root owns or contains a declared gt-vue app.
 *
 * Detection is read-only, synchronous, and fail-safe. It loads no Vue compiler
 * or source parser, making it safe for a host CLI to call before selecting a
 * framework-specific command surface.
 */
export function detectVueProject(cwd: string = process.cwd()): boolean {
  try {
    return discoverVueProject(cwd).scopes.length > 0;
  } catch {
    return false;
  }
}
