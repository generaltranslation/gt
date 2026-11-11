import fs from 'node:fs/promises';
import path from 'node:path';
import { parseSync } from 'oxc-parser';
import { moduleExportName, type ESTree } from '../analysis/ast.js';

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
  const ids = new Set<string>();
  const visited = new Set<string>();

  /** Adds the value exports of a module; false if it cannot be read. */
  const collect = async (
    body: ESTree.Statement[] | ESTree.Directive[],
    from: string
  ) => {
    for (const statement of body as ESTree.Statement[]) {
      if (statement.type === 'ExportNamedDeclaration') {
        if (statement.exportKind === 'type') continue;
        if (statement.declaration) {
          for (const name of declaredNames(statement.declaration))
            ids.add(name);
        }
        for (const specifier of statement.specifiers) {
          if (specifier.exportKind !== 'type')
            ids.add(moduleExportName(specifier.exported));
        }
      } else if (
        statement.type === 'ExportAllDeclaration' &&
        statement.exportKind !== 'type' &&
        // `export * as m` is the namespace, not a message.
        !statement.exported
      ) {
        if (!(await follow(statement.source.value, from))) return false;
      }
    }
    return true;
  };

  const follow = async (specifier: string, from: string): Promise<boolean> => {
    const body = declared.get(specifier);
    if (body) return collect(body, from);
    if (!specifier.startsWith('.')) return false;
    const file = path.resolve(path.dirname(from), specifier);
    if (visited.has(file)) return true;
    visited.add(file);
    const program = await parseFile(file);
    return program ? collect(program.body, file) : false;
  };

  const entry = path.join(outdir, 'messages.js');
  visited.add(entry);
  const program = await parseFile(entry);
  if (!program || !(await collect(program.body, entry))) return undefined;
  // `export *` does not re-export "default".
  ids.delete('default');
  return ids;
}

/** Whether `name`, a message id or a dynamic pattern where `*` is any text, matches `id`. */
export function matchesPattern(pattern: string, id: string): boolean {
  const parts = pattern
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`^${parts.join('[\\s\\S]*')}$`).test(id);
}

async function parseFile(file: string): Promise<ESTree.Program | undefined> {
  const code = await fs.readFile(file, 'utf8').catch(() => undefined);
  if (code === undefined) return undefined;
  const lang = file.endsWith('.d.ts') ? 'dts' : 'js';
  const { program, errors } = parseSync(file, code, { lang });
  return errors.some((error) => error.severity === 'Error')
    ? undefined
    : (program as unknown as ESTree.Program);
}

/** `declare module "virtual:…/messages/_index.js" { … }` blocks, by module name. */
async function declaredModules(
  file: string
): Promise<Map<string, ESTree.Statement[]>> {
  const modules = new Map<string, ESTree.Statement[]>();
  const program = await parseFile(file);
  for (const statement of program?.body ?? []) {
    if (
      statement.type === 'TSModuleDeclaration' &&
      statement.id.type === 'Literal' &&
      statement.body?.type === 'TSModuleBlock'
    ) {
      modules.set(
        statement.id.value,
        statement.body.body as ESTree.Statement[]
      );
    }
  }
  return modules;
}

function declaredNames(declaration: ESTree.Declaration): string[] {
  switch (declaration.type) {
    case 'VariableDeclaration':
      return declaration.declarations.flatMap((declarator) =>
        declarator.id.type === 'Identifier' ? [declarator.id.name] : []
      );
    case 'FunctionDeclaration':
    case 'ClassDeclaration':
    case 'TSDeclareFunction':
      return declaration.id ? [declaration.id.name] : [];
    default:
      return [];
  }
}
