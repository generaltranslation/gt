import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';
import { attachInlineTranslateFlags, attachTranslateFlags } from '../flags.js';

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

describe('inline source help', () => {
  const sourceDescription = (sourceHelp?: 'historical' | 'vue') => {
    const command = attachInlineTranslateFlags(new Command(), sourceHelp);
    return command.options.find((option) => option.long === '--src')
      ?.description;
  };

  it('preserves the historical React-family default patterns', () => {
    expect(sourceDescription()).toBe(
      "Space-separated list of glob patterns containing the app's source code, by default 'src/**/*.{js,jsx,ts,tsx}' 'app/**/*.{js,jsx,ts,tsx}' 'pages/**/*.{js,jsx,ts,tsx}' 'components/**/*.{js,jsx,ts,tsx}'"
    );
  });

  it('describes framework-owned discovery only for Vue commands', () => {
    expect(sourceDescription('vue')).toBe(
      "Space-separated glob patterns containing the app's source code. Vue source locations are scanned by default."
    );
  });
});
