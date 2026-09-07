import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateCompiler } from './validateCompiler';
import type {
  BaseWithGTConfigProps,
  CompilerOptions,
} from '../props/withGTConfigProps';

vi.mock('../../plugin/getStableNextVersionInfo', () => ({
  babelPluginCompatible: true,
  swcPluginCompatible: true,
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('auto JSX compiler validation', () => {
  it.each(['swc', 'babel'] as const)(
    'keeps %s insertion enabled without compile-time hashing',
    (type) => {
      vi.stubEnv('TURBOPACK', '');
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const config: BaseWithGTConfigProps = {
        experimentalCompilerOptions: {
          type,
          compileTimeHash: false,
          disableBuildChecks: true,
          enableAutoJsxInjection: true,
        },
      };
      validateCompiler(config);
      expect(config.experimentalCompilerOptions?.type).toBe(type);
      expect(warn).not.toHaveBeenCalled();
    }
  );

  it.each([false, undefined])(
    'retains the legacy disabled-hash behavior with auto injection %s',
    (enableAutoJsxInjection) => {
      vi.stubEnv('TURBOPACK', '');
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const config: BaseWithGTConfigProps = {
        experimentalCompilerOptions: {
          type: 'swc',
          compileTimeHash: false,
          enableAutoJsxInjection,
        },
      };
      validateCompiler(config);
      expect(config.experimentalCompilerOptions?.type).toBe('none');
    }
  );

  it('does not bypass bundler compatibility when only insertion is enabled', () => {
    vi.stubEnv('TURBOPACK', '1');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const options: CompilerOptions = {
      type: 'babel',
      compileTimeHash: false,
      enableAutoJsxInjection: true,
    };
    validateCompiler({ experimentalCompilerOptions: options });
    expect(options.type).toBe('none');
  });

  it.each(['false', 1, {}])(
    'requires boolean true before changing legacy compiler validation: %j',
    (flag) => {
      vi.stubEnv('TURBOPACK', '');
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const options: CompilerOptions = {
        type: 'swc',
        compileTimeHash: false,
        enableAutoJsxInjection: flag as unknown as boolean,
      };
      validateCompiler({ experimentalCompilerOptions: options });
      expect(options.type).toBe('none');
      expect(warn).not.toHaveBeenCalledWith(
        expect.stringContaining('Automatic JSX injection')
      );
    }
  );
});
