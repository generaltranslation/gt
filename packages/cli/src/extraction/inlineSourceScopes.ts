import path from 'node:path';
import fg from 'fast-glob';
import {
  DEFAULT_SRC_PATTERNS,
  DEFAULT_VUE_SRC_PATTERNS,
} from '../config/generateSettings.js';
import {
  declaresJavaScriptDependency,
  readDeclaredWorkspacePackages,
  readJavaScriptPackageManifest,
} from '../fs/determineFramework/workspacePackages.js';
import { Libraries, type InlineLibrary } from '../types/libraries.js';

/** One project boundary whose source files share framework configuration. */
export type InlineSourceScope = {
  /** Absolute package directory. */
  directory: string;
  /** Project-root-relative package directory, or an empty string for root. */
  relativeDirectory: string;
};

/**
 * Returns the root project and declared workspaces that own one inline library.
 *
 * Workspace directories come from the same realpath-validated traversal used
 * by library detection, keeping package selection and source discovery aligned.
 */
export function readInlineSourceScopes(
  projectRoot: string,
  library: InlineLibrary
): InlineSourceScope[] {
  const rootScope: InlineSourceScope = {
    directory: projectRoot,
    relativeDirectory: '',
  };
  const rootManifest = readJavaScriptPackageManifest(
    path.join(projectRoot, 'package.json')
  );
  if (!rootManifest) return [rootScope];

  const workspaceScopes = readDeclaredWorkspacePackages(
    projectRoot,
    rootManifest
  )
    .filter(({ manifest }) => declaresJavaScriptDependency(manifest, library))
    .map(({ directory }) => ({
      directory,
      relativeDirectory: toPosixPath(path.relative(projectRoot, directory)),
    }))
    .filter(
      ({ relativeDirectory }) =>
        relativeDirectory !== '' &&
        relativeDirectory !== '..' &&
        !relativeDirectory.startsWith('../')
    );

  return [rootScope, ...workspaceScopes];
}

/**
 * Builds safe default globs for the root and every workspace owning a library.
 *
 * Package-directory prefixes are escaped as literal paths so legal names such
 * as `vue[1]` cannot select a different workspace through glob semantics.
 */
export function readDefaultInlineSourcePatterns(
  projectRoot: string,
  library: InlineLibrary
): string[] {
  const sourcePatterns =
    library === Libraries.GT_VUE
      ? DEFAULT_VUE_SRC_PATTERNS
      : DEFAULT_SRC_PATTERNS;
  const workspacePatterns = readInlineSourceScopes(projectRoot, library)
    .slice(1)
    .flatMap(({ relativeDirectory }) => {
      const literalDirectory = fg.escapePath(relativeDirectory);
      return sourcePatterns.map((pattern) => `${literalDirectory}/${pattern}`);
    });

  return [...new Set([...sourcePatterns, ...workspacePatterns])];
}

/** Selects the deepest declared package scope containing a source file. */
export function findInlineSourceScope(
  file: string,
  scopes: readonly InlineSourceScope[]
): InlineSourceScope {
  const orderedScopes = [...scopes].sort(
    (left, right) => right.directory.length - left.directory.length
  );
  return (
    orderedScopes.find(({ directory }) => isWithin(directory, file)) ??
    scopes[0]
  );
}

function isWithin(directory: string, file: string): boolean {
  const relative = path.relative(path.resolve(directory), path.resolve(file));
  return (
    relative !== '' &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function toPosixPath(filepath: string): string {
  return filepath.split(path.sep).join(path.posix.sep);
}
