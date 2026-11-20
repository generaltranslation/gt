/**
 * experimentalSplitTranslations in a server-rendered app: the split applies
 * to the client build only, and a framework integration names the entry that
 * compiled code loads translations from. How such a build runs in a browser
 * is checked by tests/apps/tanstack-start-split-translations.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import type { UnpluginContextMeta } from 'unplugin';
import gtUnplugin from '../index';
import type { GTUnpluginOptions } from '../index';
import { IMPORTED_CHUNKS_PLACEHOLDER } from '../transform/chunk-translations/resolveChunkTranslations';

// The hash of the `Save` template
const SAVE = 'ab72d114d0d156a9';
const LOADER = 'gt-tanstack-start/chunk-translations';
const OPTIONS: GTUnpluginOptions = {
  gtConfig: {
    defaultLocale: 'en',
    locales: ['fr'],
    files: { gt: { output: 'translations/[locale].json' } },
  },
  experimentalSplitTranslations: { minifyHashes: true },
  precomputeMessages: false,
  _splitTranslationsLoader: LOADER,
};
const MODULE = `import { useGT } from 'gt-tanstack-start';
export function Save() {
  const t = useGT();
  return t\`Save\`;
}
export const load = () => import('./Orders');`;

const SERVER = { environment: { config: { consumer: 'server' } } };
const CLIENT = { environment: { config: { consumer: 'client' } } };

type Hook = (this: unknown, ...args: never[]) => unknown;
type Plugin = {
  transform: Hook;
  vite: {
    configResolved: (config: object) => void;
    options?: (options: object) => null;
    renderChunk: Hook;
    generateBundle: Hook | { handler: Hook };
  };
};

function createBuild(options: GTUnpluginOptions = OPTIONS) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-split-server-'));
  onTestFinished(() => fs.rmSync(cwd, { force: true, recursive: true }));
  fs.mkdirSync(path.join(cwd, 'translations'));
  fs.writeFileSync(
    path.join(cwd, 'translations/fr.json'),
    JSON.stringify({ [SAVE]: 'Enregistrer' })
  );
  vi.spyOn(process, 'cwd').mockReturnValue(cwd);
  const [compile, wrap] = [
    gtUnplugin.raw(options, { framework: 'vite' } as UnpluginContextMeta),
  ].flat() as unknown as [Plugin, Plugin];
  const id = path.join(cwd, 'App.jsx');
  const run = async (hook: Hook, context: object, code: string) => {
    const result = (await hook.call(
      { addWatchFile() {}, ...context },
      ...([code, id] as never[])
    )) as { code: string } | string | null;
    return result && typeof result === 'object' ? result.code : result;
  };
  return {
    compile,
    wrap,
    transform: (context: object) => run(compile.transform, context, MODULE),
    wrapImports: (context: object) => run(wrap.transform, context, MODULE),
  };
}

describe('experimentalSplitTranslations in a server-rendered app', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('keeps the hash at each call site of a build for a server, and wraps none of its imports', async () => {
    const build = createBuild();
    expect(await build.transform(SERVER)).toContain(`$_hash: "${SAVE}"`);
    expect(await build.wrapImports(SERVER)).toBeNull();
  });

  it('splits the client build of the same plugins, which loads translations from the entry the integration names', async () => {
    const build = createBuild();
    const compiled = await build.transform(CLIENT);
    // The id of a build with hash minification, until its chunk is rendered
    expect(compiled).not.toContain(`"${SAVE}"`);
    expect(compiled).toContain('$_hash:');
    expect(await build.wrapImports(CLIENT)).toContain(
      `import { loadMinifiedChunk as __gt_chunk_load } from "${LOADER}";`
    );
  });

  it('writes no file for a server, and leaves its chunks as the bundler rendered them', async () => {
    const { compile, wrap } = createBuild();
    compile.vite.configResolved({ base: '/', build: { assetsDir: 'assets' } });
    const code = `t({$_hash:"${SAVE}"})\`Save\``;
    const bundle = {
      'server.js': {
        type: 'chunk',
        fileName: 'server.js',
        code,
        imports: [],
        dynamicImports: [],
        isEntry: true,
      },
    };
    const emitFile = vi.fn();
    expect(
      (compile.vite.renderChunk as Hook).call(SERVER, ...([code] as never[]))
    ).toBeNull();
    (compile.vite.generateBundle as Hook).call(
      { ...SERVER, emitFile },
      ...([{}, bundle] as never[])
    );
    (wrap.vite.generateBundle as { handler: Hook }).handler.call(
      SERVER,
      ...([{}, bundle] as never[])
    );
    expect(emitFile).not.toHaveBeenCalled();
    expect(bundle['server.js'].code).toBe(code);
  });

  /**
   * A client bundle whose entry holds `code` and imports a chunk with a
   * message. Returns what names the imported chunks, the last step of a build.
   */
  async function buildClient(code: string, options?: GTUnpluginOptions) {
    const { compile, wrap, transform } = createBuild({
      ...OPTIONS,
      experimentalSplitTranslations: {},
      ...options,
    });
    await transform(CLIENT);
    compile.vite.configResolved({ base: '/', build: { assetsDir: 'assets' } });
    wrap.vite.options!({});
    const chunk = (fileName: string, source: string, rest = {}) => ({
      type: 'chunk',
      fileName,
      code: source,
      imports: [],
      dynamicImports: [],
      isEntry: false,
      ...rest,
    });
    const bundle = {
      'assets/index.js': chunk('assets/index.js', code, {
        isEntry: true,
        dynamicImports: ['assets/Orders.js'],
      }),
      'assets/Orders.js': chunk(
        'assets/Orders.js',
        `t({$_hash:"${SAVE}"})\`Save\``
      ),
    };
    (compile.vite.generateBundle as Hook).call(
      { ...CLIENT, emitFile() {} },
      ...([{}, bundle] as never[])
    );
    return () =>
      (wrap.vite.generateBundle as { handler: Hook }).handler.call(
        CLIENT,
        ...([{}, bundle] as never[])
      );
  }

  it('fails the build on an import it could not wrap that loads translations, naming the package to add', async () => {
    const name = await buildClient(`import("./Orders.js")`);
    expect(name).toThrow(
      /cannot load the translations of assets\/Orders\.js because a dynamic import the build could not wrap loads them.*cannot resolve gt-tanstack-start\/chunk-translations.*Add gt-tanstack-start to the dependencies/s
    );
  });

  it('accepts a build whose imports are all wrapped, without asking for initializeGTSPA', async () => {
    const name = await buildClient(
      `e(()=>import("./Orders.js"),"${IMPORTED_CHUNKS_PLACEHOLDER}")`
    );
    expect(name).not.toThrow();
    expect(console.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('initializeGTSPA')
    );
  });

  it('only warns of such an import in an app that starts with initializeGTSPA', async () => {
    const name = await buildClient(`import("./Orders.js")`, {
      _splitTranslationsLoader: undefined,
    });
    expect(name).not.toThrow();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Nothing waits for the translations of assets/Orders.js'
      )
    );
  });
});
