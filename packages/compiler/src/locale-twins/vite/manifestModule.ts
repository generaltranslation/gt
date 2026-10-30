/**
 * `virtual:gt-locale-twins-manifest`: the client build's twin manifest as a
 * module, so a server build can bundle it (no file system access at request
 * time; works on edge runtimes). It exports `manifest`, the parsed
 * {@link LocaleTwinManifest}, or `null` when there is none to serve (dev, or
 * locale twins off).
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  LOCALE_TWIN_MANIFEST_FILE,
  parseLocaleTwinManifest,
  type LocaleTwinManifest,
} from 'generaltranslation/internal';
import { createMissingLocaleTwinManifestDiagnostic } from '../buildDiagnostics';

export const LOCALE_TWIN_MANIFEST_MODULE_ID =
  'virtual:gt-locale-twins-manifest';
export const RESOLVED_LOCALE_TWIN_MANIFEST_MODULE_ID = `\0${LOCALE_TWIN_MANIFEST_MODULE_ID}`;

/** The parts of a resolved Vite (environment) config used here. */
export type ManifestModuleConfig = {
  root: string;
  command: 'build' | 'serve';
  build: { outDir: string };
  environments?: Record<string, { build?: { outDir?: string } } | undefined>;
};

/** Absolute path of the client build's manifest file. */
export function getClientManifestPath(config: ManifestModuleConfig): string {
  const outDir =
    config.environments?.client?.build?.outDir ?? config.build.outDir;
  return path.resolve(config.root, outDir, LOCALE_TWIN_MANIFEST_FILE);
}

function manifestModule(manifest: LocaleTwinManifest | null): string {
  return `export const manifest = ${JSON.stringify(manifest)};\n`;
}

/**
 * Source of the virtual module. Only server environments of a build read the
 * manifest: a client build would see the previous build's file (its own
 * manifest is written after its modules load), and `vite dev` serves no
 * twins, so a manifest left in the outDir by an earlier build is stale. In a
 * server build with locale twins on, a missing manifest is an error (the
 * client environment must be built first).
 */
export function loadManifestModule(options: {
  enabled: boolean;
  config: ManifestModuleConfig;
  consumer: 'client' | 'server';
}): { code: string; manifestPath?: string } {
  if (
    !options.enabled ||
    options.consumer !== 'server' ||
    options.config.command !== 'build'
  ) {
    return { code: manifestModule(null) };
  }
  const manifestPath = getClientManifestPath(options.config);
  let text: string;
  try {
    text = fs.readFileSync(manifestPath, 'utf8');
  } catch {
    throw new Error(createMissingLocaleTwinManifestDiagnostic(manifestPath));
  }
  return {
    code: manifestModule(parseLocaleTwinManifest(text)),
    manifestPath,
  };
}
