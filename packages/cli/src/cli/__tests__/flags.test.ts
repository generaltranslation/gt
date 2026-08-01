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
});
