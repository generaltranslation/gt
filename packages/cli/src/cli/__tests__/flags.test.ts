import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';
import { attachTranslateFlags } from '../flags.js';

vi.mock('../../fs/findFilepath.js', () => ({
  default: vi.fn(() => ''),
}));

function parseTranslateFlags(args: string[] = []) {
  const command = attachTranslateFlags(new Command());
  command.exitOverride().parse(args, { from: 'user' });
  return command.opts();
}

describe('attachTranslateFlags', () => {
  it('saves local edits by default', () => {
    expect(parseTranslateFlags().saveLocal).toBe(true);
  });

  it('keeps the explicit save-local flag enabled', () => {
    expect(parseTranslateFlags(['--save-local']).saveLocal).toBe(true);
  });

  it('allows saving local edits to be disabled', () => {
    expect(parseTranslateFlags(['--no-save-local']).saveLocal).toBe(false);
  });

  it('defaults the timeout to 900 seconds', () => {
    expect(parseTranslateFlags().timeout).toBe(900);
  });

  it('parses a numeric timeout', () => {
    expect(parseTranslateFlags(['--timeout', '300']).timeout).toBe(300);
  });

  it('disables the timeout when set to none', () => {
    expect(parseTranslateFlags(['--timeout', 'none']).timeout).toBe(Infinity);
  });

  it('rejects a non-numeric timeout', () => {
    expect(() => parseTranslateFlags(['--timeout', 'abc'])).toThrow(
      'Invalid timeout: not a number.'
    );
  });

  it('rejects a negative timeout', () => {
    expect(() => parseTranslateFlags(['--timeout', '-5'])).toThrow(
      'Invalid timeout: must be a positive number.'
    );
  });
});
