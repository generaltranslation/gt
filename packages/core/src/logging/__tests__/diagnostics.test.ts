import { describe, expect, it } from 'vitest';
import { createDiagnosticMessage } from '../diagnostics';

describe('createDiagnosticMessage', () => {
  it('formats a diagnostic with fix and way out', () => {
    expect(
      createDiagnosticMessage({
        source: 'gt-next',
        severity: 'Error',
        whatHappened: 'Remote translations could not be loaded',
        fix: 'Check your project ID and API key',
        wayOut: 'Source content will render as a fallback',
      })
    ).toBe(
      'gt-next Error: Remote translations could not be loaded. Check your project ID and API key. Source content will render as a fallback.'
    );
  });

  it('combines what happened with why, and fix with a way out', () => {
    expect(
      createDiagnosticMessage({
        whatHappened: 'Translations could not be uploaded',
        why: 'the request to GT failed',
        reassurance: 'Your local content was not changed',
        fix: 'Check your project ID and API key, then try again',
        wayOut: 'keep editing and upload later',
      })
    ).toBe(
      'Translations could not be uploaded because the request to GT failed. Your local content was not changed. Check your project ID and API key, then try again, or keep editing and upload later.'
    );
  });

  it('formats details and docs links', () => {
    expect(
      createDiagnosticMessage({
        source: 'GT',
        severity: 'Warning',
        whatHappened: 'Translation hashes do not match',
        details: ['expected abc', 'received def'],
        docsUrl: 'https://generaltranslation.com/docs',
      })
    ).toBe(
      'GT Warning: Translation hashes do not match. Details: expected abc, received def. Learn more: https://generaltranslation.com/docs'
    );
  });

  it('formats message bodies without a source prefix', () => {
    expect(
      createDiagnosticMessage({
        whatHappened: 'Locale "zz" is not valid',
        fix: 'Use a valid BCP 47 locale code or add a custom mapping',
      })
    ).toBe(
      'Locale "zz" is not valid. Use a valid BCP 47 locale code or add a custom mapping.'
    );
  });

  it('handles repeated trailing punctuation in combined messages', () => {
    expect(
      createDiagnosticMessage({
        whatHappened: `Translations failed${'!'.repeat(1000)}`,
        why: `the service rejected the request${'?'.repeat(1000)}`,
      })
    ).toBe('Translations failed because the service rejected the request.');
  });
});
