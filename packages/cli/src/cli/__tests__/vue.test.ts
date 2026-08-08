import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';
import { VueCLI } from '../vue.js';

class TestVueCLI extends VueCLI {
  public readonly configure = vi.fn(
    async (_useBundledDefaults: boolean) => undefined
  );

  protected override handleConfigureCommand(
    useBundledTranslationDefaults: boolean = true
  ): Promise<void> {
    return this.configure(useBundledTranslationDefaults);
  }
}

describe('VueCLI', () => {
  it.each(['init', 'configure'])(
    'routes %s through loader-free generic configuration',
    async (command) => {
      const program = new Command();
      const cli = new TestVueCLI(program);
      cli.init();

      await program.parseAsync([command], { from: 'user' });

      expect(cli.configure).toHaveBeenCalledOnce();
      expect(cli.configure).toHaveBeenCalledWith(true);
    }
  );
});
