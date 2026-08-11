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

  it('rejects an empty output path before rendering', () => {
    expect(() => parseCliArgs(['--code', '<T>Hello</T>', '--out='])).toThrow(
      'The runtime seed output path is empty'
    );
  });

  it('rejects conflicting output destinations even with an empty path', () => {
    expect(() =>
      parseCliArgs(['--code', '<T>Hello</T>', '--out=', '--stdout'])
    ).toThrow('The runtime seed output path is empty');

    expect(() =>
      parseCliArgs(['--code', '<T>Hello</T>', '--out=seed.json', '--stdout'])
    ).toThrow('--out and --stdout cannot be used together');
  });
});
