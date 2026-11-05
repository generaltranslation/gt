import { describe, expect, it } from 'vitest';
import { getInitNextSteps, quoteShellArgument } from '../nextSteps.js';

const context = {
  framework: 'vite',
  configuredAppEntry: true,
  docsUrl: 'https://example.com/docs',
  locales: ['fr', 'es'],
} as const;

function translateStep(configFilepath: string): string | undefined {
  return getInitNextSteps({ ...context, configFilepath }).find((step) =>
    step.startsWith('Run `npx gt translate')
  );
}

describe('getInitNextSteps', () => {
  it.each(['gt.config.json', './gt.config.json'])(
    'omits --config for the default %s',
    (configFilepath) => {
      expect(translateStep(configFilepath)).toBe(
        'Run `npx gt translate` to translate your content into fr, es'
      );
    }
  );

  it('names a custom config in the translate command', () => {
    expect(translateStep('config/custom.json')).toBe(
      'Run `npx gt translate --config config/custom.json` to translate your content into fr, es'
    );
  });

  it('quotes a custom config path for the shell', () => {
    expect(translateStep("my app's gt.json")).toContain(
      `npx gt translate --config ${quoteShellArgument("my app's gt.json")}\``
    );
  });
});

describe('quoteShellArgument', () => {
  it.each([
    ['linux', 'config/custom.json', 'config/custom.json'],
    ['darwin', "my app's gt.json", "'my app'\\''s gt.json'"],
    ['win32', 'config\\custom.json', 'config\\custom.json'],
    ['win32', 'my app\\gt.json', '"my app\\gt.json"'],
  ] as const)('quotes for %s: %s', (platform, value, quoted) => {
    expect(quoteShellArgument(value, platform)).toBe(quoted);
  });
});
