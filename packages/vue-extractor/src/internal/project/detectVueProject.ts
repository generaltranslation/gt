import path from 'node:path';
import {
  declaresAvailableJavaScriptDependency,
  GT_VUE_PACKAGE,
  readJavaScriptPackageManifest,
} from './manifest.js';

/**
 * Returns whether the current package directly owns a declared gt-vue app.
 *
 * Workspace descendants cannot change the root CLI mode. Detection is
 * read-only, synchronous, and fail-safe, and it loads no Vue compiler, source
 * parser, workspace globber, or project configuration.
 */
export function detectVueProject(cwd: string = process.cwd()): boolean {
  try {
    const manifest = readJavaScriptPackageManifest(
      path.join(path.resolve(cwd), 'package.json')
    );
    return Boolean(
      manifest &&
      declaresAvailableJavaScriptDependency(
        manifest,
        GT_VUE_PACKAGE,
        path.resolve(cwd)
      )
    );
  } catch {
    return false;
  }
}
