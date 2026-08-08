import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

const mocks = vi.hoisted(() => ({
  constructor: vi.fn(),
  execute: vi.fn(),
  init: vi.fn(),
}));

vi.mock('../fs/determineFramework/index.js', () => ({
  determineLibrary: () => ({
    library: 'gt-vue',
    additionalModules: ['i18next-icu'],
  }),
}));

vi.mock('../cli/vue.js', () => ({
  VueCLI: class {
    public constructor(...args: unknown[]) {
      mocks.constructor(...args);
    }

    public init(): void {
      mocks.init();
    }

    public execute(): void {
      mocks.execute();
    }
  },
}));

import { main } from '../index.js';

describe('Vue CLI routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes a root gt-vue project to the Vue CLI', () => {
    const program = new Command();

    main(program);

    expect(mocks.constructor).toHaveBeenCalledWith(program, ['i18next-icu']);
    expect(mocks.init).toHaveBeenCalledOnce();
    expect(mocks.execute).toHaveBeenCalledOnce();
  });
});
