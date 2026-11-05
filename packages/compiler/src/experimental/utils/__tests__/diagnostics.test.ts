import { describe, expect, it } from 'vitest';
import { createCompilerDiagnostic } from '../diagnostics';

describe('createCompilerDiagnostic', () => {
  it('prefixes the message with the compiler package and severity', () => {
    expect(
      createCompilerDiagnostic({
        severity: 'Warning',
        whatHappened: 'Locale twins were not generated',
        why: 'no translation files were found',
        fix: 'Run gt translate before vite build',
      })
    ).toBe(
      '@generaltranslation/compiler Warning: Locale twins were not generated because no translation files were found. Run gt translate before vite build.'
    );
  });

  it('omits the severity label when none is given', () => {
    expect(
      createCompilerDiagnostic({
        whatHappened: 'Generated 4 locale twins',
        details: ['src/App.tsx:3', 'src/Nav.tsx:10'],
      })
    ).toBe(
      '@generaltranslation/compiler: Generated 4 locale twins. Details: src/App.tsx:3, src/Nav.tsx:10.'
    );
  });
});
