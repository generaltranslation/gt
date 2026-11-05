import * as t from '@babel/types';
import { GT_IMPORT_SOURCES } from '../../utils/constants/gt/constants';
import { EXPERIMENTAL_IMPORT_SOURCES } from './importSources';

/** The regular entry point each `/experimental` GT entry point extends. */
const REGULAR_IMPORT_SOURCES: Record<string, string> = {
  [EXPERIMENTAL_IMPORT_SOURCES.GT_REACT]: GT_IMPORT_SOURCES.GT_REACT,
  [EXPERIMENTAL_IMPORT_SOURCES.GT_TANSTACK_START]:
    GT_IMPORT_SOURCES.GT_TANSTACK_START,
};

/** The regular sources the macro expansion imports `t` from. */
const MACRO_IMPORT_SOURCES = new Set<string>([
  GT_IMPORT_SOURCES.GT_REACT,
  GT_IMPORT_SOURCES.GT_REACT_BROWSER,
]);

/**
 * Presents a module's `/experimental` GT imports to the regular passes as
 * imports from the regular entry points they extend (every export of those
 * is also exported by the `/experimental` entry point), so the regular
 * compiler stays unaware of them. {@link restore} puts the original sources
 * back before the locale twins pass reads them and before code generation.
 */
export class ImportSourceAliases {
  private readonly originals = new Map<t.StringLiteral, string>();
  private readonly seen = new WeakSet<t.ImportDeclaration>();

  /** Aliases the program's `/experimental` GT imports, including new ones. */
  alias(program: t.Program): void {
    for (const statement of program.body) {
      if (!t.isImportDeclaration(statement)) continue;
      this.seen.add(statement);
      const regular = REGULAR_IMPORT_SOURCES[statement.source.value];
      if (!regular) continue;
      this.originals.set(statement.source, statement.source.value);
      statement.source.value = regular;
    }
  }

  /**
   * Turns the `t` import the regular macro expansion injected (from
   * `gt-react`) into an import from an `/experimental` entry point: the
   * module's own, else `fallback` (the plugin's `autoJsxImportSource`) when
   * it is one. Only the locale twin `t()` reads the twins. Call after the
   * macro expansion pass.
   */
  aliasMacroImport(program: t.Program, fallback: string | undefined): void {
    const experimental =
      this.originals.values().next().value ??
      (fallback && REGULAR_IMPORT_SOURCES[fallback] ? fallback : undefined);
    for (const statement of program.body) {
      if (!t.isImportDeclaration(statement) || this.seen.has(statement)) {
        continue;
      }
      this.seen.add(statement);
      if (!experimental || !MACRO_IMPORT_SOURCES.has(statement.source.value)) {
        continue;
      }
      this.originals.set(statement.source, experimental);
      statement.source.value = REGULAR_IMPORT_SOURCES[experimental];
    }
  }

  /** Whether an import's source is an aliased `/experimental` entry point. */
  isExperimental(source: t.StringLiteral): boolean {
    return this.originals.has(source);
  }

  /** Puts every aliased import source back. */
  restore(): void {
    for (const [source, original] of this.originals) source.value = original;
    this.originals.clear();
  }
}
