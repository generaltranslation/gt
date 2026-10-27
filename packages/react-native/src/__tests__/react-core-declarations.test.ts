import { execFile } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import ts from 'typescript';
import { afterAll, beforeAll, expect, it } from 'vitest';

const run = promisify(execFile);
const packagesRoot = fileURLToPath(new URL('../../..', import.meta.url));
// gt-react-native and the workspace packages its declarations import.
const packedPackages = [
  'react-native',
  'react-core',
  'format',
  'core',
  'i18n',
  'supported-locales',
  'api',
  'icu',
];

// A NodeNext ESM consumer reaches react-core both directly (import condition)
// and through gt-react-native's CJS-scoped declarations (require condition).
// Both must resolve to one declaration graph, or react-core classes such as
// ReactI18nCache become two incompatible types.
const consumer = `
import { setReactI18nCache } from '@generaltranslation/react-core/pure';
import { getReactI18nCache } from 'gt-react-native';
setReactI18nCache(getReactI18nCache());
`;

let fixture: string;

// Packing takes ~45s on CI runners (~3s locally). It runs asynchronously so
// the vitest worker can keep reporting progress while it waits.
const PACK_TIMEOUT = 120_000;
const TYPECHECK_TIMEOUT = 60_000;

beforeAll(async () => {
  fixture = mkdtempSync(join(tmpdir(), 'gt-react-native-declarations-'));
  const nodeModules = join(fixture, 'node_modules');
  const packed = new Set<string>();
  const external = new Map<string, string>();
  await Promise.all(
    packedPackages.map(async (directory) => {
      const pack = join(fixture, 'packs', directory);
      mkdirSync(pack, { recursive: true });
      // pnpm is a .cmd shim on Windows and needs a shell (see check-package.mjs).
      const shell = process.platform === 'win32';
      await run(
        'pnpm',
        ['pack', '--pack-destination', shell ? `"${pack}"` : pack],
        {
          cwd: join(packagesRoot, directory),
          shell,
        }
      );
      const archive = readdirSync(pack).find((name) => name.endsWith('.tgz'))!;
      await run('tar', ['-xzf', join(pack, archive), '-C', pack]);
    })
  );
  for (const directory of packedPackages) {
    const root = join(packagesRoot, directory);
    const manifest = JSON.parse(
      readFileSync(join(root, 'package.json'), 'utf8')
    );
    const pack = join(fixture, 'packs', directory);
    const link = join(nodeModules, manifest.name);
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(join(pack, 'package'), link, 'junction');
    packed.add(manifest.name);
    for (const name of [
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.peerDependencies ?? {}),
      '@types/react',
    ]) {
      const source = join(root, 'node_modules', name);
      if (existsSync(source)) external.set(name, realpathSync(source));
    }
  }
  for (const [name, source] of external) {
    if (packed.has(name)) continue;
    const link = join(nodeModules, name);
    if (existsSync(link)) continue;
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(source, link, 'junction');
  }
  writeFileSync(join(fixture, 'consumer.mts'), consumer);
}, PACK_TIMEOUT);

afterAll(() => {
  rmSync(fixture, { recursive: true, force: true });
});

it.each([true, false])(
  'shares react-core declarations with a NodeNext ESM consumer (skipLibCheck %s)',
  (skipLibCheck) => {
    const program = ts.createProgram([join(fixture, 'consumer.mts')], {
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      strict: true,
      noEmit: true,
      skipLibCheck,
      types: [],
    });
    // Only report the consumer and the two packages under test; other
    // packages' declaration issues are not what this test covers.
    const checkedFiles = [
      'consumer.mts',
      '/packs/react-core/',
      '/packs/react-native/',
    ];
    const diagnostics = ts
      .getPreEmitDiagnostics(program)
      .filter(
        (diagnostic) =>
          !diagnostic.file ||
          checkedFiles.some((file) =>
            diagnostic.file!.fileName.replaceAll('\\', '/').includes(file)
          )
      )
      .map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
      );
    expect(diagnostics).toEqual([]);
  },
  TYPECHECK_TIMEOUT
);
