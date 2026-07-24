import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { parse } from '@babel/parser';
import * as t from '@babel/types';
import chalk from 'chalk';
import { logger } from '../console/logger.js';

type Formatter = 'prettier' | 'biome' | 'eslint';

/** What formatFiles actually did, for a caller that reports it to the user. */
export type FormatReport = {
  formatter: Formatter | null;
  /** One line naming the path taken (also logged). */
  reason: string;
  formattedFiles: string[];
  /**
   * Files whose formatted output was discarded because reformatting changed the
   * JSX child structure (see jsxChildrenPreserved); the generator's own output
   * was kept instead.
   */
  preservedFiles: string[];
};

type PrettierModule = {
  format: (
    source: string,
    options: Record<string, unknown>
  ) => string | Promise<string>;
  resolveConfig: (
    file: string
  ) => Promise<Record<string, unknown> | null> | Record<string, unknown> | null;
  resolveConfigFile?: (file: string) => Promise<string | null> | string | null;
};

type ProjectPrettier = {
  /** Absolute path of the prettier entry inside the project's own tree. */
  entry: string;
  module: PrettierModule;
  /** The project's own prettier config file (a config is required). */
  configFile: string;
  /** The directory the search was bounded to. */
  boundary: string;
};

/**
 * The directories a file's own project may resolve tooling from: its directory
 * up to the repository boundary (the first ancestor holding `.git`), or up to
 * the outermost ancestor holding a package.json when there is no repo marker.
 * Bounding matters: an unbounded Node resolution walk finds prettier in ANY
 * ancestor (the gt monorepo's own node_modules when the CLI is run from a
 * checkout, or an unrelated parent directory), which is how the formatter came
 * to run over projects that do not format themselves.
 */
function projectSearchDirs(file: string): { dirs: string[]; boundary: string } {
  const dirs: string[] = [];
  let current = path.dirname(path.resolve(file));
  let lastWithManifest: string | null = null;
  for (;;) {
    dirs.push(current);
    if (fs.existsSync(path.join(current, 'package.json'))) {
      lastWithManifest = current;
    }
    if (fs.existsSync(path.join(current, '.git'))) {
      return { dirs, boundary: current };
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  // No repo marker anywhere: stop at the outermost package.json instead of
  // trusting the whole path to the filesystem root.
  const boundary = lastWithManifest ?? dirs[0];
  const boundaryIndex = dirs.indexOf(boundary);
  return {
    dirs: boundaryIndex === -1 ? dirs : dirs.slice(0, boundaryIndex + 1),
    boundary,
  };
}

/**
 * The project's OWN prettier, plus its OWN config; null when either is missing.
 * Both are required before a whole-file reformat is allowed to touch generated
 * output: a project with no prettier config has never agreed to prettier's
 * defaults (printWidth 80), and reflowing its JSX at those defaults can change
 * what the page renders (a JSX text node holding an HTML entity loses the
 * leading whitespace of its first line, so materialising that whitespace as
 * `{" "}` across a line break adds a rendered space).
 */
async function resolveProjectPrettier(
  file: string
): Promise<ProjectPrettier | null> {
  const { dirs, boundary } = projectSearchDirs(file);
  let entry: string | null = null;
  for (const dir of dirs) {
    const candidate = path.join(dir, 'node_modules', 'prettier');
    if (!fs.existsSync(path.join(candidate, 'package.json'))) continue;
    try {
      entry = createRequire(path.join(dir, 'noop.js')).resolve('prettier');
    } catch {
      // A broken install is treated as no prettier at all.
      entry = null;
    }
    if (entry) break;
  }
  if (!entry) return null;

  let module: PrettierModule;
  try {
    const imported = (await import(pathToFileURL(entry).href)) as {
      default?: PrettierModule;
    } & PrettierModule;
    module =
      typeof imported.format === 'function'
        ? imported
        : (imported.default as PrettierModule);
    if (!module || typeof module.format !== 'function') return null;
  } catch {
    return null;
  }

  let configFile: string | null = null;
  try {
    if (typeof module.resolveConfigFile === 'function') {
      configFile = (await module.resolveConfigFile(file)) ?? null;
    } else {
      // Ancient prettier without resolveConfigFile: a non-null resolved config
      // still proves the project configured it, so treat the file's own project
      // as the config location for the boundary check below.
      configFile = (await module.resolveConfig(file)) ? file : null;
    }
  } catch {
    configFile = null;
  }
  if (!configFile) return null;
  // A config found above the project boundary belongs to somebody else.
  const resolvedConfig = path.resolve(configFile);
  if (
    resolvedConfig !== boundary &&
    !resolvedConfig.startsWith(boundary + path.sep)
  ) {
    return null;
  }
  return { entry, module, configFile: resolvedConfig, boundary };
}

/** True when the project (bounded as above) has the given dependency installed. */
function projectHasModule(file: string, id: string): boolean {
  const { dirs } = projectSearchDirs(file);
  return dirs.some((dir) =>
    fs.existsSync(path.join(dir, 'node_modules', ...id.split('/')))
  );
}

function projectHasBiomeConfig(file: string): boolean {
  const { dirs } = projectSearchDirs(file);
  return dirs.some(
    (dir) =>
      fs.existsSync(path.join(dir, 'biome.json')) ||
      fs.existsSync(path.join(dir, 'biome.jsonc'))
  );
}

type FormatterResolution = {
  formatter: Formatter | null;
  prettier: ProjectPrettier | null;
  /** Why this path was taken, phrased for the console and the report. */
  note: string;
};

/**
 * Which formatter the PROJECT uses, resolved from the project's own tree (the
 * anchor file's project) and never from whatever the CLI happens to carry. A
 * project that installs prettier without configuring it has not opted into
 * prettier's defaults, so nothing is reformatted; falling through to another
 * formatter would substitute a tool the project did not choose.
 */
async function resolveProjectFormatter(
  anchorFile: string
): Promise<FormatterResolution> {
  const prettier = await resolveProjectPrettier(anchorFile);
  if (prettier) {
    return {
      formatter: 'prettier',
      prettier,
      note: `formatted with the project's prettier (config: ${prettier.configFile})`,
    };
  }
  if (projectHasModule(anchorFile, 'prettier')) {
    return {
      formatter: null,
      prettier: null,
      note: 'this project installs prettier but has no prettier config of its own, so the generated formatting was left as is',
    };
  }
  if (projectHasModule(anchorFile, 'eslint')) {
    return {
      formatter: 'eslint',
      prettier: null,
      note: 'formatted with eslint --fix',
    };
  }
  if (
    projectHasModule(anchorFile, '@biomejs/biome') ||
    projectHasBiomeConfig(anchorFile)
  ) {
    return { formatter: 'biome', prettier: null, note: 'formatted with biome' };
  }
  return {
    formatter: null,
    prettier: null,
    note: 'this project has no formatter installed, so the generated formatting was left as is',
  };
}

/**
 * Which formatter the PROJECT uses, never one that only the CLI happens to
 * carry. `projectDir` anchors the lookup (the project root by default).
 */
export async function detectFormatter(
  projectDir: string = process.cwd()
): Promise<Formatter | null> {
  const anchor = path.join(path.resolve(projectDir), 'package.json');
  return (await resolveProjectFormatter(anchor)).formatter;
}

const WHITESPACE = ' \t\n\r\f\v';

function isWhitespace(character: string): boolean {
  // Explicit set, NOT /\s/: /\s/ also matches U+00A0, so an `&nbsp;` decoded by
  // the parser would be mistaken for layout whitespace and normalized away.
  return WHITESPACE.includes(character);
}

/**
 * A JSX text child reduced to the parts a formatter is allowed to move.
 * Leading/trailing whitespace runs that contain a newline are indentation and
 * are dropped; every other whitespace run collapses to a single space (a
 * formatter may rewrap prose). An all-whitespace child that contained a newline
 * yields '' and is dropped by the caller. A space that does NOT contain a
 * newline is content and survives, which is the point: the difference between
 * `{x} &rarr;` (one text child, ' →') and `{x}{" "}` + `&rarr;` (two children,
 * ' ' and '→') is exactly the change that alters what the page renders.
 */
function cleanJsxText(value: string): string {
  let start = 0;
  while (start < value.length && isWhitespace(value[start])) start++;
  let end = value.length;
  while (end > start && isWhitespace(value[end - 1])) end--;
  const leading = value.slice(0, start);
  const trailing = value.slice(end);
  const middle = value
    .slice(start, end)
    .replace(/[ \t\n\r\f\v]+/g, (run) => (run.includes('\n') ? ' ' : run));
  if (start === value.length) {
    // All whitespace: indentation when it spans lines, content otherwise.
    return leading.includes('\n') ? '' : ' ';
  }
  return (
    (leading.includes('\n') ? '' : leading ? ' ' : '') +
    middle +
    (trailing.includes('\n') ? '' : trailing ? ' ' : '')
  );
}

const HTML_ENTITY = /&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]{1,31});/;

type SignatureChild =
  | { kind: 'text'; text: string; entity: boolean }
  | { kind: 'token'; token: string };

/**
 * The element-wise child signature of every JSX element/fragment in the file,
 * in document order. Element-wise, NOT concatenated: the concatenation of
 * `[' →']` and `[' ', '→']` is identical, which is why a naive text comparison
 * passes the exact case this guards.
 *
 * Adjacent text children merge when NEITHER came from source containing an HTML
 * entity, so a formatter moving a space across a line break (`{a} {b}` <->
 * `{a}{" "}` + `{b}`) reads as unchanged: that reshuffle is semantics-preserving
 * for entity-free text. It is NOT preserving next to an entity, because the
 * compiler drops the leading whitespace of an entity-bearing text node while
 * rendering a `{" "}` child as a real space, so those never merge and the
 * difference survives into the signature.
 *
 * Expressions collapse to a placeholder (a formatter never changes what an
 * expression evaluates to, and the codemod's own rewrites already happened
 * before this runs); nested elements collapse to a placeholder too, since each
 * one contributes its own entry to the list. A comment-only container renders
 * nothing and is dropped.
 *
 * Exported so the invariant itself can be pinned directly, not only through a
 * particular prettier version's line-breaking decisions.
 */
export function jsxChildSignature(code: string, file: string): string | null {
  const ast = parseSource(code, file);
  if (!ast) return null;
  const elements: string[][] = [];
  t.traverseFast(ast, (node) => {
    if (!t.isJSXElement(node) && !t.isJSXFragment(node)) return;
    const children: SignatureChild[] = [];
    const pushText = (text: string, entity: boolean) => {
      if (text === '') return;
      const previous = children[children.length - 1];
      if (previous?.kind === 'text' && !previous.entity && !entity) {
        previous.text += text;
        return;
      }
      children.push({ kind: 'text', text, entity });
    };
    for (const child of node.children) {
      if (t.isJSXText(child)) {
        const raw =
          child.start != null && child.end != null
            ? code.slice(child.start, child.end)
            : child.value;
        pushText(cleanJsxText(child.value), HTML_ENTITY.test(raw));
        continue;
      }
      if (t.isJSXExpressionContainer(child)) {
        if (t.isJSXEmptyExpression(child.expression)) continue;
        if (
          t.isStringLiteral(child.expression) &&
          child.expression.value.length > 0 &&
          [...child.expression.value].every(isWhitespace)
        ) {
          // `{" "}`: a rendered space, and never an entity.
          pushText(child.expression.value, false);
          continue;
        }
        children.push({ kind: 'token', token: '{expression}' });
        continue;
      }
      if (t.isJSXSpreadChild(child)) {
        children.push({ kind: 'token', token: '{...spread}' });
        continue;
      }
      children.push({ kind: 'token', token: '<element>' });
    }
    elements.push(
      children.map((entry) =>
        entry.kind === 'token'
          ? entry.token
          : `${entry.entity ? 'entity' : 'text'}:${entry.text}`
      )
    );
  });
  return JSON.stringify(elements);
}

function parseSource(code: string, file: string): t.File | null {
  const typescriptFirst = /\.[cm]?ts$/.test(file);
  const attempts: Array<Array<'jsx' | 'typescript'>> = typescriptFirst
    ? [['typescript'], ['jsx', 'typescript']]
    : [['jsx', 'typescript'], ['typescript']];
  for (const plugins of attempts) {
    try {
      return parse(code, { sourceType: 'module', plugins });
    } catch {
      // Try the next plugin combination.
    }
  }
  return null;
}

/**
 * True when reformatting left every JSX element's child list identical. A
 * formatter is allowed to move code around; it is not allowed to change what the
 * page renders. Unparseable input on either side counts as not preserved: the
 * invariant could not be checked, so the generated output is kept.
 */
function jsxChildrenPreserved(
  before: string,
  after: string,
  file: string
): boolean {
  const original = jsxChildSignature(before, file);
  const formatted = jsxChildSignature(after, file);
  return original !== null && formatted !== null && original === formatted;
}

function noteDiscardedFormatting(file: string, report: FormatReport): void {
  report.preservedFiles.push(file);
  logger.warn(
    chalk.yellow(
      `Kept ${file} unformatted: reformatting it would have changed the JSX children (rendered whitespace), so the migration's own output was preserved.`
    )
  );
}

async function snapshotFiles(files: string[]): Promise<Map<string, string>> {
  const snapshots = new Map<string, string>();
  for (const file of files) {
    try {
      snapshots.set(file, await fs.promises.readFile(file, 'utf-8'));
    } catch {
      // A file that cannot be read cannot be verified or rolled back.
    }
  }
  return snapshots;
}

/**
 * For formatters that write the files themselves (biome, eslint --fix): restore
 * any file whose rewrite changed the JSX children, and record what happened.
 */
async function rollbackUnsafeRewrites(
  snapshots: Map<string, string>,
  report: FormatReport
): Promise<void> {
  for (const [file, original] of snapshots) {
    let current: string;
    try {
      current = await fs.promises.readFile(file, 'utf-8');
    } catch {
      continue;
    }
    if (current === original) continue;
    if (jsxChildrenPreserved(original, current, file)) {
      report.formattedFiles.push(file);
      continue;
    }
    await fs.promises.writeFile(file, original);
    noteDiscardedFormatting(file, report);
  }
}

export async function formatFiles(
  filesUpdated: string[],
  formatter?: Formatter
): Promise<FormatReport> {
  const report: FormatReport = {
    formatter: formatter ?? null,
    reason: 'no files to format',
    formattedFiles: [],
    preservedFiles: [],
  };
  if (filesUpdated.length === 0) return report;

  try {
    // Resolution is per project directory, so a monorepo whose packages have
    // different setups is handled a package at a time.
    const byDirectory = new Map<string, FormatterResolution>();
    const resolutionFor = async (
      file: string
    ): Promise<FormatterResolution> => {
      const directory = path.dirname(path.resolve(file));
      const cached = byDirectory.get(directory);
      if (cached) return cached;
      const resolved = await resolveProjectFormatter(file);
      byDirectory.set(directory, resolved);
      return resolved;
    };

    const first = await resolutionFor(filesUpdated[0]);
    const detectedFormatter = formatter || first.formatter;
    report.formatter = detectedFormatter;

    if (!detectedFormatter) {
      report.reason = first.note;
      logger.message(chalk.dim(`Skipping formatting: ${report.reason}.`));
      return report;
    }

    if (detectedFormatter === 'prettier') {
      let announced = false;
      let skipNoted = false;
      for (const file of filesUpdated) {
        const resolution = await resolutionFor(file);
        const project = resolution.prettier;
        if (!project) {
          if (!skipNoted) {
            report.reason = resolution.note;
            logger.message(chalk.dim(`Skipping formatting: ${report.reason}.`));
            skipNoted = true;
          }
          continue;
        }
        if (!announced) {
          report.reason = `formatted with the project's prettier (config: ${project.configFile})`;
          logger.message(
            chalk.dim(
              `Cleaning up with prettier (project config: ${project.configFile})...`
            )
          );
          announced = true;
        }
        const content = await fs.promises.readFile(file, 'utf-8');
        let formatted: string;
        try {
          const config = (await project.module.resolveConfig(file)) ?? {};
          formatted = await project.module.format(content, {
            ...config,
            filepath: file,
          });
        } catch (error) {
          logger.warn(
            chalk.yellow(
              `Could not format ${file}, keeping it unformatted: ${String(error)}`
            )
          );
          continue;
        }
        if (formatted === content) {
          report.formattedFiles.push(file);
          continue;
        }
        // Whole-file reformatting can change rendered text, so the JSX child
        // structure has to survive it. When it does not, the generator's output
        // is what ships and the file is named.
        if (!jsxChildrenPreserved(content, formatted, file)) {
          noteDiscardedFormatting(file, report);
          continue;
        }
        await fs.promises.writeFile(file, formatted);
        report.formattedFiles.push(file);
      }
      return report;
    }

    if (detectedFormatter === 'biome') {
      report.reason = 'formatted with biome';
      logger.message(chalk.dim('Cleaning up with biome...'));
      // biome rewrites the files itself, so the same JSX-children invariant is
      // checked afterwards and a file that fails it is rolled back.
      const snapshots = await snapshotFiles(filesUpdated);
      try {
        await new Promise<void>((resolve) => {
          const args = [
            '@biomejs/biome',
            'format',
            '--write',
            ...filesUpdated.map((file) => file),
          ];

          const child = spawn('npx', args, {
            stdio: ['ignore', 'inherit', 'inherit'],
          });

          child.on('error', (error: Error) => {
            logger.warn(
              chalk.yellow('Biome formatting failed: ' + error.message)
            );
            resolve();
          });

          child.on('close', (code: number) => {
            if (code !== 0) {
              logger.warn(
                chalk.yellow(`Biome formatting failed with exit code ${code}`)
              );
            }
            resolve();
          });
        });
      } catch (error) {
        logger.warn(chalk.yellow('Biome formatting failed: ' + String(error)));
      }
      await rollbackUnsafeRewrites(snapshots, report);
      return report;
    }

    if (detectedFormatter === 'eslint') {
      report.reason = 'formatted with eslint --fix';
      logger.message(chalk.dim('Cleaning up with eslint...'));
      const { ESLint } = await import('eslint');
      const eslint = new ESLint({
        fix: true,
        overrideConfigFile: undefined, // Will use project's .eslintrc
      });
      const snapshots = await snapshotFiles(filesUpdated);
      for (const file of filesUpdated) {
        const results = await eslint.lintFiles([file]);
        await ESLint.outputFixes(results);
      }
      await rollbackUnsafeRewrites(snapshots, report);
      return report;
    }
  } catch (e) {
    logger.warn(chalk.yellow('Unable to run code formatter: ' + String(e)));
  }
  return report;
}
