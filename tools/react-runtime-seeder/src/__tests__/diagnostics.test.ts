import { describe, expect, it } from 'vitest';
import { createOutputError } from '../diagnostics';

describe('output diagnostics', () => {
  it('identifies the output path and recommends a writable destination', () => {
    const error = createOutputError(
      '/read-only/candidate.json',
      new Error('permission denied')
    );

    expect(error.message).toContain(
      'The runtime seed candidate could not be written'
    );
    expect(error.message).toContain('/read-only/candidate.json');
    expect(error.message).toContain('--out');
    expect(error.message).toContain('permission denied');
  });
});
