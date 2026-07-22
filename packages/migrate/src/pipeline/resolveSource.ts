import fs from 'node:fs';
import path from 'node:path';
import { getAdapter } from '../adapters/index.js';
import { createMigrateDiagnostic } from './diagnostics.js';

/**
 * `determineLibrary` collapses every i18next-family dependency (react-i18next,
 * next-i18next, bare i18next) to the single value `'i18next'`, so the migrate
 * command cannot tell them apart from the detected library alone. This resolves
 * that ambiguity from package.json + the project layout, returning the concrete
 * adapter id to use or an actionable error for the unsupported flavors.
 *
 * The driver passes every --from value through here; a concrete supported
 * source (next-intl, react-intl, react-i18next) passes straight through, so
 * `--from react-i18next` remains the documented escape hatch the refusal
 * messages below point at.
 */
export type SourceResolution =
  | { kind: 'resolved'; id: string }
  | { kind: 'error'; message: string };

export function resolveMigrationSource(
  from: string,
  cwd: string
): SourceResolution {
  // next-i18next is accepted only to emit the scoped skip.
  if (from === 'next-i18next') {
    return { kind: 'error', message: nextI18nextMessage() };
  }
  // Anything that is not the ambiguous bare-i18next value passes through to
  // the registry. A known source is still gated on the App Router (every
  // adapter rewrites app/ layouts; running against a Pages Router project
  // would scaffold gt-next into an app that cannot use it). An unknown --from
  // passes through so the registry can name it in its own error.
  if (from !== 'i18next') {
    if (getAdapter(from)) {
      return requireAppRouter(from, cwd);
    }
    return { kind: 'resolved', id: from };
  }

  const deps = readDeps(cwd);
  const nextI18nextConfig =
    fs.existsSync(path.join(cwd, 'next-i18next.config.js')) ||
    fs.existsSync(path.join(cwd, 'next-i18next.config.ts'));

  if (deps['next-i18next'] || nextI18nextConfig) {
    return { kind: 'error', message: nextI18nextMessage() };
  }
  if (!deps['react-i18next']) {
    return { kind: 'error', message: bareI18nextMessage() };
  }
  return requireAppRouter('react-i18next', cwd);
}

/**
 * Every supported source migrates App Router wiring (layouts, providers,
 * middleware under app/), so a project with no app/ directory is refused
 * before anything runs rather than mis-migrated.
 */
function requireAppRouter(id: string, cwd: string): SourceResolution {
  const appRouter =
    fs.existsSync(path.join(cwd, 'app')) ||
    fs.existsSync(path.join(cwd, 'src/app'));
  if (!appRouter) {
    return { kind: 'error', message: pagesRouterMessage(id) };
  }
  return { kind: 'resolved', id };
}

export function readDeps(cwd: string): Record<string, string> {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')
    );
    return { ...pkg.dependencies, ...pkg.devDependencies };
  } catch {
    return {};
  }
}

/** True when `name` is a dependency or devDependency in cwd's package.json. */
export function hasDependency(cwd: string, name: string): boolean {
  return Boolean(readDeps(cwd)[name]);
}

function nextI18nextMessage(): string {
  return createMigrateDiagnostic({
    severity: 'Error',
    whatHappened: 'gt migrate does not support next-i18next / Pages Router yet',
    why: "next-i18next's serverSideTranslations and appWithTranslation are Pages-Router APIs with no direct gt-next equivalent (gt-next targets the App Router)",
    reassurance: 'Nothing was changed.',
    fix: 'move the routes to the App Router first, or migrate manually following the gt-next quickstart',
    wayOut:
      'if this project is actually App Router react-i18next, re-run with --from react-i18next',
  });
}

function bareI18nextMessage(): string {
  return createMigrateDiagnostic({
    severity: 'Error',
    whatHappened: 'gt migrate found bare i18next (no react-i18next)',
    why: 'gt migrate targets react-i18next component usage in a Next.js App Router app, and bare i18next is typically a Node or vanilla-JS setup with no React hooks to convert',
    reassurance: 'Nothing was changed.',
    fix: 'if this is a React app, add react-i18next and re-run',
    wayOut:
      'or re-run with --from react-i18next to force the react-i18next path',
  });
}

function pagesRouterMessage(id: string): string {
  return createMigrateDiagnostic({
    severity: 'Error',
    whatHappened: `gt migrate found ${id} but no App Router (no app/ or src/app/ directory)`,
    why: 'gt-next targets the Next.js App Router; a Pages Router app has no gt-next equivalent for its i18n wiring',
    reassurance: 'Nothing was changed.',
    fix: 'move to the App Router first, or migrate manually following the gt-next quickstart',
    wayOut:
      'if your App Router lives somewhere else, run gt migrate from the directory that contains app/',
  });
}
