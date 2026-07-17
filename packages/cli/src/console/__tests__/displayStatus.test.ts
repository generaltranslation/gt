import { describe, it, expect } from 'vitest';
import {
  coveragePercent,
  renderStatusTable,
  renderStatusIssues,
} from '../displayStatus.js';
import { stripAnsi } from '../logging.js';
import type { LocaleStatus } from '../../translation/status/computeStatus.js';

function row(overrides: Partial<LocaleStatus>): LocaleStatus {
  return {
    locale: 'es',
    total: 10,
    translated: 10,
    missing: [],
    stale: [],
    errors: [],
    ...overrides,
  };
}

describe('coveragePercent', () => {
  it('is the exact translated ratio as a percentage', () => {
    expect(coveragePercent(row({ total: 8, translated: 6 }))).toBe(75);
  });

  it('treats an empty project as fully covered', () => {
    expect(coveragePercent(row({ total: 0, translated: 0 }))).toBe(100);
  });
});

describe('renderStatusTable', () => {
  it('renders one aligned row per locale', () => {
    const table = stripAnsi(
      renderStatusTable(
        [
          row({
            locale: 'es',
            total: 128,
            translated: 128,
            stale: [{ fileName: 'x' }, { fileName: 'y' }],
          }),
          row({
            locale: 'fr',
            total: 128,
            translated: 119,
            missing: Array.from({ length: 9 }, (_, i) => ({
              fileName: 'f',
              key: `k${i}`,
            })),
            errors: [{ fileName: 'f', key: 'k0', message: 'boom' }],
          }),
        ],
        { minCoverage: 100 }
      )
    );
    const lines = table.split('\n');
    expect(lines[1]).toMatch(
      /Locale.*Coverage.*Translated.*Missing.*Stale.*Errors/
    );
    const esLine = lines.find((l) => l.includes(' es '));
    const frLine = lines.find((l) => l.includes(' fr '));
    expect(esLine).toContain('100%');
    expect(esLine).toContain('128/128');
    expect(frLine).toContain('92.9%');
    expect(frLine).toContain('119/128');
    // borders present on every content line
    expect(lines.filter((l) => l.startsWith('│'))).toHaveLength(3);
  });

  it('does not round coverage up to the threshold', () => {
    const table = stripAnsi(
      renderStatusTable([row({ total: 1000, translated: 999 })], {
        minCoverage: 100,
      })
    );
    expect(table).toContain('99.9%');
    expect(table).not.toContain('100%');
  });
});

describe('renderStatusIssues', () => {
  it('lists validation errors with locale, file and key', () => {
    const text = stripAnsi(
      renderStatusIssues(
        [
          row({
            locale: 'fr',
            errors: [
              {
                fileName: 'gt/fr.json',
                key: 'h1',
                message: 'argument "{nam}" does not exist in the source',
              },
            ],
          }),
        ],
        { verbose: false }
      )
    );
    expect(text).toContain('fr');
    expect(text).toContain('gt/fr.json');
    expect(text).toContain('h1');
    expect(text).toContain('does not exist in the source');
  });

  it('returns an empty string when there is nothing to report', () => {
    expect(renderStatusIssues([row({})], { verbose: false })).toBe('');
  });

  it('caps long error lists and reports the overflow', () => {
    const errors = Array.from({ length: 30 }, (_, i) => ({
      fileName: 'gt/fr.json',
      key: `h${i}`,
      message: 'bad',
    }));
    const text = stripAnsi(
      renderStatusIssues([row({ locale: 'fr', errors })], { verbose: false })
    );
    expect(text).toContain('5 more');
  });

  it('only lists missing and stale units in verbose mode', () => {
    const rows = [
      row({
        locale: 'fr',
        missing: [{ fileName: 'docs/fr/a.mdx' }],
        stale: [{ fileName: 'gt/fr.json', key: 'h9' }],
      }),
    ];
    expect(renderStatusIssues(rows, { verbose: false })).toBe('');
    const verbose = stripAnsi(renderStatusIssues(rows, { verbose: true }));
    expect(verbose).toContain('docs/fr/a.mdx');
    expect(verbose).toContain('h9');
  });
});
