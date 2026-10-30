/**
 * Locale twin apps import GT from the `/experimental` entry points, and
 * TanStack apps split route components into `route.tsx?tsr-split=component`
 * modules. The experimental compiler must treat both exactly like the regular
 * compiler treats a gt-react module.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  TransformResult,
  UnpluginBuildContext,
  UnpluginContext,
} from 'unplugin';
import regularUnplugin from '../../index';
import { unplugin as experimentalUnplugin } from '../index';

const tempDirs: string[] = [];

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
});

function createTestContext(): UnpluginBuildContext & UnpluginContext {
  return {
    addWatchFile() {},
    emitFile() {},
    getWatchFiles() {
      return [];
    },
    parse() {
      throw new Error('parse is not implemented in this test context');
    },
    warn() {},
    error(message: unknown) {
      throw new Error(String(message));
    },
  } as UnpluginBuildContext & UnpluginContext;
}

async function transform(
  code: string,
  id: string,
  gtUnplugin: { raw: typeof regularUnplugin.raw } = experimentalUnplugin
): Promise<string | null> {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-compiler-'));
  tempDirs.push(cwd);
  const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(cwd);
  const plugin = (() => {
    try {
      return gtUnplugin.raw(
        { logLevel: 'silent', defaultLocale: 'en' },
        { framework: 'vite' }
      );
    } finally {
      cwdSpy.mockRestore();
    }
  })();
  const hook = plugin.transform;
  if (typeof hook !== 'function') {
    throw new Error('Expected transform hook to be a function');
  }
  const result: TransformResult = await hook.call(
    createTestContext(),
    code,
    id
  );
  if (!result) return null;
  return typeof result === 'string' ? result : result.code;
}

const T_COMPONENT_CODE = (source: string) => `
  import { jsx } from 'react/jsx-runtime';
  import { T } from '${source}';
  export const el = jsx(T, { children: "Hello world" });
`;

const USEGT_CODE = (source: string) => `
  import { useGT } from '${source}';
  export function Page() {
    const gt = useGT();
    return gt("Hello world", { $context: "greeting" });
  }
`;

const STANDALONE_T_CODE = (source: string) => `
  import { t } from '${source}';
  export const greeting = t("Hello world");
`;

const TAGGED_TEMPLATE_CODE = (source: string) => `
  import { t } from '${source}';
  export const greet = (name) => t\`Hello \${name}\`;
`;

const SPLIT_ROUTE_ID = '/app/src/routes/index.tsx?tsr-split=component';

describe.each([
  ['gt-react/experimental', 'gt-react'],
  ['gt-tanstack-start/experimental', 'gt-tanstack-start'],
])('the %s import source', (experimentalSource, regularSource) => {
  it.each([
    ['<T>', T_COMPONENT_CODE],
    ['useGT()', USEGT_CODE],
    ['standalone t()', STANDALONE_T_CODE],
    ['t`` macro', TAGGED_TEMPLATE_CODE],
  ])(
    'compiles %s like the regular compiler compiles the regular source',
    async (_name, makeCode) => {
      const regular = await transform(
        makeCode(regularSource),
        '/app/src/App.tsx',
        regularUnplugin
      );
      const experimental = await transform(
        makeCode(experimentalSource),
        '/app/src/App.tsx'
      );

      expect(regular).not.toBeNull();
      expect(experimental).toBe(
        regular!.replaceAll(`'${regularSource}'`, `'${experimentalSource}'`)
      );
    }
  );
});

describe('TanStack split route modules', () => {
  it('compiles a ?tsr-split=component module like its source file', async () => {
    const code = T_COMPONENT_CODE('gt-tanstack-start/experimental');
    const fromSource = await transform(code, '/app/src/routes/index.tsx');
    const fromSplit = await transform(code, SPLIT_ROUTE_ID);

    expect(fromSplit).toMatch(/_hash: "[0-9a-f]{16}"/);
    expect(fromSplit).toBe(fromSource);
  });
});
