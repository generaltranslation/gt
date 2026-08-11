import { describe, expect, it } from 'vitest';
import { parseCliArgs } from '../args';

describe('parseCliArgs', () => {
  it('parses supported arguments after a package-manager separator', () => {
    expect(parseCliArgs(['--', '--code', '<T>Hello</T>', '--stdout'])).toEqual({
      code: '<T>Hello</T>',
      stdout: true,
    });
  });

  it('reports unsupported arguments as command-line diagnostics', () => {
    expect(() => parseCliArgs(['--unknown'])).toThrow(
      'The command-line arguments are invalid'
    );
  });
});
