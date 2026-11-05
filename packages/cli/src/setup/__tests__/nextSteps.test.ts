import { describe, expect, it } from 'vitest';
import { getInitNextSteps } from '../nextSteps.js';

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
      "npx gt translate --config 'my app'\\''s gt.json'"
    );
  });
});
