import fs from 'node:fs';
import path from 'node:path';
import resolve from 'resolve';
import {
  loadTsconfig,
  walkForTsConfig,
} from 'tsconfig-paths/lib/tsconfig-loader.js';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/internal';

/** The host may supply a resolved source; CLI scans instead supply the source file. */
export type AutoJsxRuntimeContext = {
  file?: string;
  configFile?: string;
  jsxImportSource?: string;
};

type ProjectConfig = {
  extends?: string | string[];
  compilerOptions?: { jsxImportSource?: unknown };
};

function readConfig(filename: string): ProjectConfig | undefined {
  let read = false;
  // Reuse the CLI's existing JSON5/BOM reader for one file at a time. Resolve
  // inheritance below so package configs, repeated bases and cycles are handled
  // consistently instead of depending on the loader's relative-only recursion.
  return loadTsconfig(
    filename,
    (candidate) => !read && candidate === filename && fs.existsSync(candidate),
    (candidate) => {
      read = true;
      const source = fs.readFileSync(candidate, 'utf8');
      return source.trim() ? source : '{}';
    }
  ) as ProjectConfig | undefined;
}

function inheritedConfig(filename: string, reference: string): string {
  return resolve.sync(reference, {
    basedir: path.dirname(filename),
    extensions: ['.json'],
    packageFilter: (pkg) => ({
      ...pkg,
      main: typeof pkg.tsconfig === 'string' ? pkg.tsconfig : 'tsconfig.json',
    }),
  });
}

/** Resolve only auto-JSX eligibility; keep all other project options in the host. */
export function resolveAutoJsxRuntime(
  context: AutoJsxRuntimeContext = {}
): AutoJsxRuntimeContext {
  if (
    context.jsxImportSource !== undefined ||
    (!context.file && !context.configFile)
  )
    return context;
  let filename: string | undefined;
  try {
    filename = context.configFile
      ? path.resolve(context.configFile)
      : walkForTsConfig(path.dirname(path.resolve(context.file!)), (dir) => {
          // A programmatic caller can pass a not-yet-written source file/directory.
          try {
            return fs.readdirSync(dir);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
            throw error;
          }
        });
    if (!filename) return context;

    const active = new Set<string>();
    const completed = new Map<string, ProjectConfig['compilerOptions']>();
    function options(file: string): ProjectConfig['compilerOptions'] {
      file = fs.realpathSync(file);
      if (active.has(file))
        throw new Error(
          createDiagnosticMessage({
            whatHappened:
              'The project configuration contains circular inheritance',
            details: file,
          })
        );
      if (completed.has(file)) return completed.get(file);
      active.add(file);
      const config = readConfig(file);
      const bases = Array.isArray(config?.extends)
        ? config.extends
        : config?.extends
          ? [config.extends]
          : [];
      let result: ProjectConfig['compilerOptions'] = {};
      for (const base of bases)
        result = { ...result, ...options(inheritedConfig(file, base)) };
      result = { ...result, ...config?.compilerOptions };
      active.delete(file);
      completed.set(file, result);
      return result;
    }
    const source = options(filename)?.jsxImportSource;
    return {
      ...context,
      jsxImportSource: typeof source === 'string' ? source : undefined,
    };
  } catch (error) {
    throw new Error(
      createDiagnosticMessage({
        source: 'gt',
        severity: 'Error',
        whatHappened: 'The JSX import source could not be read',
        fix: 'Check the TypeScript or JavaScript configuration file',
        details: [
          filename ?? context.file,
          formatDiagnosticErrorDetails(error),
        ].filter((detail): detail is string => detail !== undefined),
      })
    );
  }
}
