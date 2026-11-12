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
  it('leaves save-local unset by default so config can decide', () => {
    expect(parseTranslateFlags().saveLocal).toBeUndefined();
  });

  it('keeps the explicit save-local flag enabled', () => {
    expect(parseTranslateFlags(['--save-local']).saveLocal).toBe(true);
  });

  it('allows saving local edits to be disabled', () => {
    expect(parseTranslateFlags(['--no-save-local']).saveLocal).toBe(false);
  });

  it('parses a whole-number timeout', () => {
    expect(parseTranslateFlags(['--timeout', '0']).timeout).toBe(0);
    expect(parseTranslateFlags(['--timeout', '120']).timeout).toBe(120);
  });

  it.each(['nope', '12s', '1.5', '-1', ''])(
    'rejects timeout %j as an invalid argument',
    (value) => {
      vi.spyOn(process.stderr, 'write').mockReturnValue(true);

      expect(() => parseTranslateFlags(['--timeout', value])).toThrow(
        expect.objectContaining({
          code: 'commander.invalidArgument',
          exitCode: 1,
          message: expect.stringContaining(
            'Timeout must be a non-negative whole number of seconds.'
          ),
        })
      );
    }
  );
});
