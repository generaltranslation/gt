import path from 'node:path';
import { declaredNames, moduleExportName, type ESTree } from '../utils/ast.js';
import { parseCode } from '../utils/parse.js';
import { readTextFile } from '../utils/read-file.js';
import { escapeRegExp } from '../utils/regexp.js';

type ModuleBody = ReadonlyArray<ESTree.Statement | ESTree.Directive>;

const matchesByIds = new WeakMap<
  ReadonlySet<string>,
  Map<string, readonly string[]>
>();

/** `declare module "…" { … }` blocks, by module name. */
type DeclaredModules = ReadonlyMap<string, ModuleBody>;

/**
 * The message ids an outdir defines, read from its generated files without
 * running them; undefined if they cannot be read.
 *
 * Starts at `messages.js` and follows its `export *` re-exports, which covers
 * every layout: message-modules (`messages/_index.js` → one module per message,
 * or shards), locale-modules (`messages/_index.js` defines them), Paraglide 1
 * (`messages.js` defines them, or re-exports `messages/index/<id>.js`), and
 * virtual-modules, whose `messages/_index.js` exists only in memory: its exports
 * are declared in `messages.virtual.d.ts` instead.
 */
export async function readCatalog(
  outdir: string
): Promise<Set<string> | undefined> {
  const declared = await declaredModules(
    path.join(outdir, 'messages.virtual.d.ts')
  );
  const exports = new ModuleExports(declared);

  const names = await exports.ofFile(path.join(outdir, 'messages.js'));
  if (!names) return undefined;

  const catalog = new Set(names);
  // `export *` does not re-export "default".
  catalog.delete('default');

  return catalog;
}

/** Matches a pattern against a set of ids once: many usages share one. */
export function matchingIds(
  pattern: string,
  ids: ReadonlySet<string>
): readonly string[] {
  let matchesOfIds = matchesByIds.get(ids);

  if (!matchesOfIds) {
    matchesOfIds = new Map();
    matchesByIds.set(ids, matchesOfIds);
  }

  let matches = matchesOfIds.get(pattern);

  if (!matches) {
    matches = [...ids].filter(patternMatcher(pattern));
    matchesOfIds.set(pattern, matches);
  }

  return matches;
}

/** Whether ids match `pattern`, a message id or a dynamic pattern where `*` is any text. */
export function patternMatcher(pattern: string): (id: string) => boolean {
  const parts = pattern.split('*').map(escapeRegExp);
  const expression = new RegExp(`^${parts.join('[\\s\\S]*')}$`);

  return (id) => expression.test(id);
}

/**
 * The value exports of a module and of every module it re-exports with
 * `export *`; undefined if one of them cannot be read.
 */
class ModuleExports {
  private readonly visited = new Set<string>();

  constructor(private readonly declared: DeclaredModules) {}

  async ofFile(file: string): Promise<string[] | undefined> {
    if (this.visited.has(file)) return [];
    this.visited.add(file);

    const program = await parseFile(file);

    return program && this.ofModule(program.body, file);
  }

  /** Reads the re-exported modules at once: an outdir can have one per message. */
  private async ofModule(
    body: ModuleBody,
    file: string
  ): Promise<string[] | undefined> {
    const names = await Promise.all(
      body.map((statement) => this.ofStatement(statement, file))
    );
    const isComplete = names.every((exported) => exported !== undefined);

    return isComplete ? names.flat() : undefined;
  }

  private async ofStatement(
    statement: ESTree.Statement | ESTree.Directive,
    file: string
  ): Promise<string[] | undefined> {
    if (statement.type === 'ExportNamedDeclaration')
      return namedExports(statement);
    if (!isStarExport(statement)) return [];

    return this.ofReexported(statement.source.value, file);
  }

  /** A declared virtual module, else a file relative to the one that re-exports it. */
  private async ofReexported(
    specifier: string,
    from: string
  ): Promise<string[] | undefined> {
    const declaredBody = this.declared.get(specifier);
    if (declaredBody) return this.ofModule(declaredBody, from);

    const isRelative = specifier.startsWith('.');
    if (!isRelative) return undefined;

    return this.ofFile(path.resolve(path.dirname(from), specifier));
  }
}

/** `export const a = …`, `export function a() {}`, `export { a, b as c }` */
function namedExports(statement: ESTree.ExportNamedDeclaration): string[] {
  if (statement.exportKind === 'type') return [];

  const declared = statement.declaration
    ? declaredNames(statement.declaration)
    : [];
  const specified = statement.specifiers
    .filter((specifier) => specifier.exportKind !== 'type')
    .map((specifier) => moduleExportName(specifier.exported));

  return [...declared, ...specified];
}

/** `export * from "./a.js"`; `export * as m` is the namespace, not a message. */
function isStarExport(
  statement: ESTree.Statement | ESTree.Directive
): statement is ESTree.ExportAllDeclaration {
  return (
    statement.type === 'ExportAllDeclaration' &&
    statement.exportKind !== 'type' &&
    !statement.exported
  );
}

/** The program of a `.js` or `.d.ts` file; undefined if it is missing or does not parse. */
async function parseFile(file: string): Promise<ESTree.Program | undefined> {
  const code = await readTextFile(file);
  if (code === undefined) return undefined;

  const lang = file.endsWith('.d.ts') ? 'dts' : 'js';
  const { program, errors } = parseCode(file, code, { lang });

  const hasError = errors.some((error) => error.severity === 'Error');
  if (hasError) return undefined;

  return program as unknown as ESTree.Program;
}

/** The `declare module "virtual:…/messages/_index.js" { … }` blocks of a `.d.ts` file. */
async function declaredModules(file: string): Promise<DeclaredModules> {
  const modules = new Map<string, ModuleBody>();
  const program = await parseFile(file);

  for (const statement of program?.body ?? []) {
    if (statement.type !== 'TSModuleDeclaration') continue;

    const { id, body } = statement;
    const isNamedByString = id.type === 'Literal';
    if (!isNamedByString || body?.type !== 'TSModuleBlock') continue;

    modules.set(id.value, body.body);
  }

  return modules;
}
