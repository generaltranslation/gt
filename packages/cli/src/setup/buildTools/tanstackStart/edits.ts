// Offset-based source edits that follow the file's own code style.
import * as t from '@babel/types';

type Edit = { start: number; end?: number; text: string };

export type CodeStyle = {
  quote: string;
  semi: string;
  eol: string;
  indent: string;
};

function getImports(statements: t.Statement[]): t.ImportDeclaration[] {
  return statements.filter(
    (statement): statement is t.ImportDeclaration =>
      statement.type === 'ImportDeclaration'
  );
}

/** Generated lines follow the file's last import, so they read as its own. */
export function getCodeStyle(
  content: string,
  statements: t.Statement[]
): CodeStyle {
  const lastImport = getImports(statements).at(-1);
  return {
    quote: lastImport ? content[lastImport.source.start!] : "'",
    semi:
      lastImport &&
      !content.slice(lastImport.start!, lastImport.end!).endsWith(';')
        ? ''
        : ';',
    eol: content.includes('\r\n') ? '\r\n' : '\n',
    // Skips JSDoc continuation lines, whose ` * ` is not an indent unit.
    indent: /^([ \t]+)[^\s*]/m.exec(content)?.[1] ?? '  ',
  };
}

function getLineStart(content: string, position: number): number {
  return content.lastIndexOf('\n', position - 1) + 1;
}

export function getLineIndent(content: string, position: number): string {
  return /^[ \t]*/.exec(content.slice(getLineStart(content, position)))![0];
}

/** The indent before position, or undefined when code precedes it. */
export function getOwnLineIndent(
  content: string,
  position: number
): string | undefined {
  const prefix = content.slice(getLineStart(content, position), position);
  return /^[ \t]*$/.test(prefix) ? prefix : undefined;
}

/** Inserts at original offsets, last first, so earlier offsets stay valid. */
export function applyEdits(content: string, edits: Edit[]): string {
  return [...edits]
    .sort((a, b) => b.start - a.start)
    .reduce(
      (result, { start, end, text }) =>
        result.slice(0, start) + text + result.slice(end ?? start),
      content
    );
}

export function getImportEdit(
  statements: t.Statement[],
  lines: string[],
  eol: string
): Edit {
  const lastImport = getImports(statements).at(-1);
  if (!lastImport) return { start: 0, text: lines.join(eol) + eol + eol };
  // A same-line comment such as `// eslint-disable-line` stays on its import.
  const lineComment = lastImport.trailingComments
    ?.filter((comment) => comment.loc!.start.line === lastImport.loc!.end.line)
    .at(-1);
  return {
    start: lineComment?.end ?? lastImport.end!,
    text: eol + lines.join(eol),
  };
}
