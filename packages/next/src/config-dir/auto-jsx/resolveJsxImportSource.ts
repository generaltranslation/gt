import fs from 'fs';
import path from 'path';
import JSON5 from 'json5';
import type { NextConfig } from 'next';
import {
  createGtNextPluginDiagnostic,
  formatDiagnosticErrorDetails,
} from '../../errors/diagnostics';

type TypeScriptConfigReader = {
  sys: {
    readFile: (filename: string) => string | undefined;
    [key: string]: unknown;
  };
  readConfigFile: (
    filename: string,
    readFile: (filename: string) => string | undefined
  ) => { config?: unknown; error?: unknown };
  parseJsonConfigFileContent: (
    config: unknown,
    host: Record<string, unknown>,
    directory: string
  ) => { options: { jsxImportSource?: string } };
};

function readImportSource(
  filename: string,
  emptyFileSource?: string
): string | undefined {
  const text = fs.readFileSync(filename, 'utf8');
  if (text.length === 0) return emptyFileSource;
  const config: unknown = text.trim() ? JSON5.parse(text) : {};
  if (!config || typeof config !== 'object' || !('compilerOptions' in config))
    return undefined;
  const options = config.compilerOptions;
  if (
    !options ||
    typeof options !== 'object' ||
    !('jsxImportSource' in options)
  )
    return undefined;
  return typeof options.jsxImportSource === 'string'
    ? options.jsxImportSource
    : undefined;
}

function ancestorDirectories(directory: string): string[] {
  const directories = [directory];
  while (path.dirname(directory) !== directory) {
    directory = path.dirname(directory);
    directories.push(directory);
  }
  return directories;
}

function turbopackRoot(config: NextConfig, directory: string): string {
  // Next gives outputFileTracingRoot precedence when both roots are present.
  const explicitRoot =
    config.outputFileTracingRoot ||
    config.turbopack?.root ||
    config.experimental?.turbo?.root;
  if (explicitRoot) return path.resolve(explicitRoot);
  // Next's automatic root is the outermost workspace/lockfile directory.
  const markers = [
    'pnpm-workspace.yaml',
    'pnpm-lock.yaml',
    'package-lock.json',
    'yarn.lock',
    'bun.lock',
    'bun.lockb',
  ];
  return (
    ancestorDirectories(directory)
      .reverse()
      .find((candidate) =>
        markers.some((marker) => fs.existsSync(path.join(candidate, marker)))
      ) ?? directory
  );
}

function turbopackConfig(config: NextConfig, directory: string) {
  if (config.typescript?.tsconfigPath) {
    const filename = path.resolve(directory, config.typescript.tsconfigPath);
    return fs.existsSync(filename) ? filename : undefined;
  }
  for (const name of ['tsconfig.json', 'jsconfig.json']) {
    const filename = path.join(directory, name);
    if (fs.existsSync(filename)) return filename;
  }
  const root = turbopackRoot(config, directory);
  if (directory === root) return undefined;
  for (const candidate of ancestorDirectories(directory).slice(1)) {
    for (const name of ['tsconfig.json', 'jsconfig.json']) {
      const filename = path.join(candidate, name);
      if (fs.existsSync(filename)) return filename;
    }
    if (candidate === root) break;
  }
  return undefined;
}

function projectTypeScript(
  directory: string
): TypeScriptConfigReader | undefined {
  try {
    const packageJson = require.resolve('typescript/package.json', {
      paths: [directory],
    });
    return require(path.join(path.dirname(packageJson), 'lib/typescript.js'));
  } catch {
    // Like Next's load-jsconfig, JS-only projects need no TypeScript dependency.
    return undefined;
  }
}

/** Resolve only the host JSX import source; all other compiler settings stay in Next. */
export function resolveJsxImportSource(
  config: NextConfig,
  turbopack: boolean,
  directory = process.cwd()
): string | undefined {
  let filename: string | undefined;
  try {
    if (turbopack) {
      filename = turbopackConfig(config, directory);
      // Next 16's Turbopack JSX accessor returns a value for the first config,
      // even when jsxImportSource is absent. Inherited values therefore do not
      // apply here, unlike Webpack's TypeScript-resolved config below.
      // https://github.com/vercel/next.js/blob/v16.2.9/crates/next-core/src/transform_options.rs
      // An exactly empty config yields no native config entries; Next then uses
      // JsxTransformOptions::default(), including React even when Emotion is set.
      return filename ? readImportSource(filename, 'react') : undefined;
    }

    const tsconfig = path.resolve(
      directory,
      config.typescript?.tsconfigPath || 'tsconfig.json'
    );
    const typescript = fs.existsSync(tsconfig)
      ? projectTypeScript(directory)
      : undefined;
    if (typescript) {
      filename = tsconfig;
      const { config: contents, error } = typescript.readConfigFile(
        tsconfig,
        typescript.sys.readFile
      );
      if (error) throw error;
      return typescript.parseJsonConfigFileContent(
        contents,
        { ...typescript.sys, readDirectory: () => ['file.ts'] },
        path.dirname(tsconfig)
      ).options.jsxImportSource;
    }

    filename = path.join(directory, 'jsconfig.json');
    // Next's Webpack JS-only loader parses JSON5 without resolving extends.
    return fs.existsSync(filename) ? readImportSource(filename) : undefined;
  } catch (error) {
    throw new Error(
      createGtNextPluginDiagnostic({
        severity: 'Error',
        whatHappened: 'The JSX import source could not be read',
        fix: 'Check the TypeScript or JavaScript configuration file',
        details: [
          filename ?? directory,
          formatDiagnosticErrorDetails(error),
        ].filter((detail): detail is string => detail !== undefined),
      })
    );
  }
}
