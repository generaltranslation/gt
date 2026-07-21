import { describe, expect, it } from 'vitest';
import {
  getDefaultReactRenderingMode,
  getLoadTranslationsSetupInstruction,
  getReactSetupSummary,
  type ReactRenderingMode,
} from '../frameworkUtils.js';
import type { ReactFrameworkObject } from '../../types/index.js';

function reactFramework(
  name: ReactFrameworkObject['name']
): ReactFrameworkObject {
  return { name, type: 'react' };
}

describe('React setup rendering modes', () => {
  it.each([
    ['vite', 'spa'],
    ['next-app', 'ssr'],
    ['next-pages', 'ssr'],
    ['gatsby', 'ssr'],
    ['redwood', 'ssr'],
  ] as const)('defaults %s projects to %s rendering', (name, mode) => {
    expect(getDefaultReactRenderingMode(reactFramework(name))).toBe(mode);
  });

  it('leaves generic React rendering mode for the user to choose', () => {
    expect(getDefaultReactRenderingMode(reactFramework('react'))).toBe(
      undefined
    );
  });

  it('describes SPA setup without a provider', () => {
    expect(getReactSetupSummary(reactFramework('vite'))).toContain(
      'no GTProvider'
    );
  });

  it('limits the server-rendered provider to resolved runtime data', () => {
    expect(getReactSetupSummary(reactFramework('react'), 'ssr')).toContain(
      'GTProvider receives only locale and translations'
    );
  });
});

describe('loadTranslations setup instructions', () => {
  const context = (
    renderingMode: ReactRenderingMode
  ): { framework: 'react'; renderingMode: ReactRenderingMode } => ({
    framework: 'react',
    renderingMode,
  });

  it('directs SPAs to initialization instead of a provider', () => {
    const instruction = getLoadTranslationsSetupInstruction(context('spa'));

    expect(instruction).toContain('initializeGTSPA()');
    expect(instruction).toContain('do not use GTProvider');
  });

  it('keeps loaders off the server-rendered provider', () => {
    const instruction = getLoadTranslationsSetupInstruction(context('ssr'));

    expect(instruction).toContain('initializeGT()');
    expect(instruction).toContain('only the resolved locale and translations');
  });
});
