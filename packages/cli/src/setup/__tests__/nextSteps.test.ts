import { describe, expect, it } from 'vitest';
import { getInitNextSteps, getTranslateInstruction } from '../nextSteps.js';

describe('getInitNextSteps', () => {
  it('names a custom config in the translate step', () => {
    const steps = getInitNextSteps({
      framework: 'vite',
      configuredAppEntry: true,
      docsUrl: 'https://example.com/docs',
      locales: ['fr', 'es'],
      configFilepath: 'config/custom.json',
    });
    expect(steps).toContain(
      'Run `npx gt translate --config config/custom.json` to translate your content into fr, es'
    );
  });
});

describe('getTranslateInstruction', () => {
  it.each(['gt.config.json', './gt.config.json'])(
    'omits --config for the default %s',
    (configFilepath) => {
      expect(getTranslateInstruction(configFilepath)).toBe(
        'Run `npx gt translate`'
      );
    }
  );

  it.each([
    ['linux', 'config/custom.json'],
    ['darwin', 'custom.gt.config.json'],
    ['win32', 'config\\custom.json'],
  ] as const)(
    'puts a literal %s path in the command: %s',
    (platform, configFilepath) => {
      expect(getTranslateInstruction(configFilepath, platform)).toBe(
        `Run \`npx gt translate --config ${configFilepath}\``
      );
    }
  );

  // Spaces, quotes, $, `, % and \ (outside Windows) mean different things
  // to POSIX shells, Command Prompt and PowerShell.
  it.each([
    ['linux', "my app's gt.json"],
    ['linux', 'config\\custom.json'],
    ['win32', 'config/$schema.json'],
    ['win32', 'my app\\gt.json'],
    ['win32', '%APPDATA%.json'],
  ] as const)(
    'names a %s path the shell would change outside the command: %s',
    (platform, configFilepath) => {
      expect(getTranslateInstruction(configFilepath, platform)).toBe(
        `Run \`npx gt translate\` with --config set to your config file (${configFilepath})`
      );
    }
  );
});
