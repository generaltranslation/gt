import { Command } from 'commander';
import { describe, expect, it } from 'vitest';
import type { InlineRuntimeSetup } from '../base.js';
import { NodeCLI } from '../node.js';
import { Libraries } from '../../types/libraries.js';

class NodeLoaderProbe extends NodeCLI {
  loader(runtimeSetup: InlineRuntimeSetup) {
    return {
      runtime: this.getLoadTranslationsRuntime(runtimeSetup),
      guidance: this.getLocalTranslationGuidance({
        generatedLoader: true,
        runtimeSetup,
        translationsDir: 'public/_gt',
      }),
    };
  }
}

const probe = new NodeLoaderProbe(new Command(), Libraries.GT_NODE);

describe('NodeCLI local translation loader', () => {
  it('writes a Node loader and points to initializeGT and the Node guide', () => {
    const { runtime, guidance } = probe.loader({
      hasOtherInlineRuntime: true,
      hasVueRuntime: false,
      ranReactSetup: false,
    });

    expect(runtime).toBe('node');
    expect(guidance).toContain('initializeGT({ loadTranslations })');
    expect(guidance).toContain('/docs/node/guides/storing-translations');
    expect(guidance).not.toContain('/docs/next/');
  });

  it('keeps the bundler loader that gt-vue shares with its browser bundle', () => {
    const { runtime, guidance } = probe.loader({
      hasOtherInlineRuntime: true,
      hasVueRuntime: true,
      ranReactSetup: false,
    });

    expect(runtime).toBe('bundler');
    expect(guidance).toContain('createGT({ loadTranslations })');
  });

  it('keeps the bundler loader for a React app that init set up', () => {
    const { runtime, guidance } = probe.loader({
      hasOtherInlineRuntime: true,
      hasVueRuntime: false,
      ranReactSetup: true,
    });

    expect(runtime).toBe('bundler');
    expect(guidance).toContain('/docs/next/guides/local-tx');
  });
});
