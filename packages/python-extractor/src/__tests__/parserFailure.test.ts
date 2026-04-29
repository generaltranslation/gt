import { describe, it, expect, vi } from 'vitest';

vi.mock('../parser.js', () => ({
  getParser: vi.fn(async () => {
    throw new Error('Unknown WASM specifier for Bun: extra.wasm');
  }),
}));

import { extractFromPythonSource } from '../index.js';

describe('parser initialization failures', () => {
  it('returns a warning instead of throwing', async () => {
    const result = await extractFromPythonSource(
      'from gt_flask import t\nt("Hello")',
      'app.py'
    );

    expect(result.results).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('app.py');
    expect(result.warnings[0]).toContain('Failed to initialize Python parser');
    expect(result.warnings[0]).toContain(
      'Unknown WASM specifier for Bun: extra.wasm'
    );
  });
});
