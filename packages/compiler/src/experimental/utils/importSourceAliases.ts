import * as t from '@babel/types';
import { GT_IMPORT_SOURCES } from '../../utils/constants/gt/constants';
import { EXPERIMENTAL_IMPORT_SOURCES } from './importSources';

/** The regular entry point each `/experimental` GT entry point extends. */
const REGULAR_IMPORT_SOURCES: Record<string, string> = {
  [EXPERIMENTAL_IMPORT_SOURCES.GT_REACT]: GT_IMPORT_SOURCES.GT_REACT,
  [EXPERIMENTAL_IMPORT_SOURCES.GT_TANSTACK_START]:
    GT_IMPORT_SOURCES.GT_TANSTACK_START,
};

/**
 * Presents a module's `/experimental` GT imports to the regular passes as
 * imports from the regular entry points they extend (every export of those
 * is also exported by the `/experimental` entry point), so the regular
 * compiler stays unaware of them. {@link restore} puts the original sources
 * back before the locale twins pass reads them and before code generation.
 */
export class ImportSourceAliases {
  private readonly originals = new Map<t.StringLiteral, string>();

  /** Aliases the program's `/experimental` GT imports, including new ones. */
  alias(program: t.Program): void {
    for (const statement of program.body) {
      if (!t.isImportDeclaration(statement)) continue;
      const regular = REGULAR_IMPORT_SOURCES[statement.source.value];
      if (!regular) continue;
      this.originals.set(statement.source, statement.source.value);
      statement.source.value = regular;
    }
  }

  /** Puts every aliased import source back. */
  restore(): void {
    for (const [source, original] of this.originals) source.value = original;
    this.originals.clear();
  }
}
