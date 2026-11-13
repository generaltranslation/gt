import fs from 'node:fs/promises';
import path from 'node:path';
import { parseSync } from 'oxc-parser';
import { moduleExportName, type ESTree } from '../analysis/ast.js';
import { declaredNames } from '../analysis/module-syntax.js';

type ModuleBody = ReadonlyArray<ESTree.Statement | ESTree.Directive>;

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

  const isComplete = await exports.addFile(path.join(outdir, 'messages.js'));
  if (!isComplete) return undefined;

  // `export *` does not re-export "default".
  exports.names.delete('default');

  return exports.names;
}

/** Whether `name`, a message id or a dynamic pattern where `*` is any text, matches `id`. */
export function matchesPattern(pattern: string, id: string): boolean {
  return patternMatcher(pattern)(id);
}

/** `matchesPattern` for one pattern and many ids: the pattern is compiled once. */
export function patternMatcher(pattern: string): (id: string) => boolean {
  const parts = pattern
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const expression = new RegExp(`^${parts.join('[\\s\\S]*')}$`);

  return (id) => expression.test(id);
}

/**
 * The value exports of a module and of every module it re-exports with
 * `export *`. Each `add…` is false if a module on the way cannot be read: the
 * names are incomplete then.
 */
class ModuleExports {
  readonly names = new Set<string>();
  private readonly visited = new Set<string>();

  constructor(private readonly declared: DeclaredModules) {}

  async addFile(file: string): Promise<boolean> {
    if (this.visited.has(file)) return true;
    this.visited.add(file);

    const program = await parseFile(file);
    if (!program) return false;

    return this.addModule(program.body, file);
  }

  private async addModule(body: ModuleBody, file: string): Promise<boolean> {
    for (const statement of body) {
      if (statement.type === 'ExportNamedDeclaration') {
        this.addNamedExports(statement);
        continue;
      }

      if (!isStarExport(statement)) continue;

      const isComplete = await this.addReexported(statement.source.value, file);
      if (!isComplete) return false;
    }

    return true;
  }

  /** `export const a = …`, `export function a() {}`, `export { a, b as c }` */
  private addNamedExports(statement: ESTree.ExportNamedDeclaration): void {
    if (statement.exportKind === 'type') return;

    const declared = statement.declaration
      ? declaredNames(statement.declaration)
      : [];
    for (const name of declared) this.names.add(name);

    for (const specifier of statement.specifiers) {
      if (specifier.exportKind === 'type') continue;

      this.names.add(moduleExportName(specifier.exported));
    }
  }

  /** A declared virtual module, else a file relative to the one that re-exports it. */
  private async addReexported(
    specifier: string,
    from: string
  ): Promise<boolean> {
    const declaredBody = this.declared.get(specifier);
    if (declaredBody) return this.addModule(declaredBody, from);

    const isRelative = specifier.startsWith('.');
    if (!isRelative) return false;

    return this.addFile(path.resolve(path.dirname(from), specifier));
  }
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
  const code = await fs.readFile(file, 'utf8').catch(() => undefined);
  if (code === undefined) return undefined;

  const lang = file.endsWith('.d.ts') ? 'dts' : 'js';
  const { program, errors } = parseSync(file, code, { lang });

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
