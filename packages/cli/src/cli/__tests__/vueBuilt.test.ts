import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { hashSource } from 'generaltranslation/id';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// The command surface, setup decisions and JSON reporting are covered against
// the sources in `vueCli.test.ts` and `initOnboarding.test.ts`. These few child
// processes prove the same behavior survives the build: the shipped modules
// load, the bin resolves the Vue extractor, and stdout stays machine-readable.

const execFileAsync = promisify(execFile);

const packageRoot = fileURLToPath(new URL('../../..', import.meta.url));
const requireFromVueExtractor = createRequire(
  path.join(packageRoot, '../vue-extractor/package.json')
);
const installedVueDirectory = path.dirname(
  requireFromVueExtractor.resolve('vue/package.json')
);
const temporaryDirectories: string[] = [];
const commanderUrl = pathToFileURL(
  fs.realpathSync(path.join(packageRoot, 'node_modules/commander/esm.mjs'))
).href;
const builtUrl = (file: string) =>
  pathToFileURL(path.join(packageRoot, 'dist', file)).href;
const cliBinPath = path.join(packageRoot, 'bin/main.js');

beforeAll(async () => {
  if (process.env.TURBO_HASH) return;

  // npm_execpath may be a JS CLI (corepack pnpm.cjs, runnable via node) or
  // a native binary (mise-installed pnpm on CI, runnable directly).
  const npmExecpath = process.env.npm_execpath;
  const isJsCli = npmExecpath !== undefined && /\.[cm]?js$/.test(npmExecpath);
  const command = isJsCli ? process.execPath : (npmExecpath ?? 'pnpm');
  const args = isJsCli ? [npmExecpath, 'run', 'build'] : ['run', 'build'];
  await execFileAsync(command, args, {
    cwd: packageRoot,
    encoding: 'utf8',
    timeout: 120_000,
  });
}, 125_000);

afterAll(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe.concurrent('built Vue CLI', () => {
  it('routes gt-vue and mixed roots to the Vue command surface', async () => {
    const projectRoot = createProject({
      dependencies: { 'next-intl': '*', 'gt-vue': '*', vite: '*' },
    });

    await runNode(
      `
        import assert from 'node:assert/strict';
        import { Command } from ${JSON.stringify(commanderUrl)};
        import { main } from ${JSON.stringify(builtUrl('index.js'))};
        import { VueCLI } from ${JSON.stringify(builtUrl('cli/vue.js'))};
        import { resolveInlineLibrary } from ${JSON.stringify(builtUrl('formats/files/collectFiles.js'))};

        const commandNames = (program) =>
          program.commands.map((command) => command.name());
        const vueProgram = new Command();
        new VueCLI(vueProgram).init();
        assert.equal(commandNames(vueProgram).includes('generate'), true);
        assert.equal(commandNames(vueProgram).includes('validate'), true);
        assert.equal(
          commandNames(vueProgram).filter((name) => name === 'setup').length,
          1
        );

        process.argv.splice(0, process.argv.length, process.execPath, 'gt', 'probe');
        const routedProgram = new Command();
        main(routedProgram);
        assert.deepEqual(commandNames(routedProgram), commandNames(vueProgram));
        assert.match(
          routedProgram.commands
            .find((command) => command.name() === 'init')
            .description(),
          /gt-vue/
        );
        assert.equal(resolveInlineLibrary('next-intl'), 'gt-vue');
      `,
      projectRoot
    );
  });

  it('extracts React and Vue content into one catalog through an explicit tsconfig', async () => {
    const projectRoot = createProject({
      dependencies: { 'gt-react': '*', 'gt-vue': '*', vue: '*' },
    });
    const aliased = 'Hello through custom tsconfig';
    const constrained = 'Review this constrained Vue entry';
    const headline = 'Visit San Francisco';
    const callToAction = 'Explore the waterfront';
    const context = 'homepage call to action';
    const react = 'Preserved React entry';
    writeProjectFiles(projectRoot, {
      'config/tsconfig.app.json': JSON.stringify({
        compilerOptions: { baseUrl: '..', paths: { '@gt': ['src/gt.ts'] } },
      }),
      'gt.config.json': JSON.stringify({
        defaultLocale: 'en',
        locales: ['fr'],
        files: { gt: { output: 'translations/[locale].json' } },
      }),
      'src/App.tsx': `import { T } from 'gt-react';
export const App = () => <T>${react}</T>;
`,
      'src/App.vue': `<script setup lang="ts">
import { LocalT } from '@gt';
</script>
<template><LocalT>${aliased}</LocalT></template>
`,
      'src/Card.vue': `<script setup>
import { T } from 'gt-vue';
</script>
<template><T id="editor-metadata" context="card" :max-chars="24" requires-review>${constrained}</T></template>
`,
      'src/gt.ts': `export { T as LocalT } from 'gt-vue';\n`,
      'src/moduleMessages.ts': `import { t } from 'gt-vue';
export const headline = t(${JSON.stringify(headline)});
export const callToAction = t(${JSON.stringify(callToAction)}, { $context: ${JSON.stringify(context)} });
`,
    });
    linkInstalledVue(projectRoot);
    const sourceCatalogPath = path.join(projectRoot, 'translations/en.json');
    const targetCatalogPath = path.join(projectRoot, 'translations/fr.json');
    const generate = (tsconfig: string) =>
      runBuiltCli(
        [
          '--skip-version-check',
          'generate',
          '--config',
          'gt.config.json',
          '--jsconfig',
          tsconfig,
        ],
        projectRoot
      );

    await generate('config/tsconfig.app.json');

    const sourceCatalog = fs.readFileSync(sourceCatalogPath, 'utf8');
    // The id is not part of the identity, the remaining metadata is.
    expect(JSON.parse(sourceCatalog)).toEqual({
      [hashSource({ dataFormat: 'JSX', source: react })]: react,
      [hashSource({ dataFormat: 'JSX', source: aliased })]: aliased,
      [hashSource({
        context: 'card',
        dataFormat: 'JSX',
        maxChars: 24,
        requiresReview: true,
        source: constrained,
      })]: constrained,
      [hashSource({ dataFormat: 'STRING', source: headline })]: headline,
      [hashSource({ context, dataFormat: 'STRING', source: callToAction })]:
        callToAction,
    });

    const validationOutput = await runBuiltCli(
      [
        '--skip-version-check',
        'validate',
        'src/App.vue',
        '--config',
        'gt.config.json',
        '--tsconfig',
        'config/tsconfig.app.json',
      ],
      projectRoot
    );
    expect(validationOutput).toContain('Found 1 translatable entries');

    // A failed extraction leaves both catalogs as they were.
    const targetCatalog = JSON.stringify({ existing: 'Keep this translation' });
    fs.writeFileSync(targetCatalogPath, targetCatalog);
    await expect(generate('config/missing.json')).rejects.toThrow();
    expect(fs.readFileSync(sourceCatalogPath, 'utf8')).toBe(sourceCatalog);
    expect(fs.readFileSync(targetCatalogPath, 'utf8')).toBe(targetCatalog);
  });

  it('extracts Vue content through a mixed file-library root', async () => {
    const projectRoot = createProject({
      dependencies: { i18next: '*', 'gt-vue': '*', vue: '*' },
    });
    writeProjectFiles(projectRoot, {
      'gt.config.json': JSON.stringify({
        defaultLocale: 'en',
        locales: ['fr'],
        files: { gt: { output: 'translations/[locale].json' } },
      }),
      'src/App.vue': `<script setup>
import { T } from 'gt-vue';
</script>
<template><T>Vue entry from i18next</T></template>
`,
    });
    linkInstalledVue(projectRoot);

    await runBuiltCli(['generate', '--config', 'gt.config.json'], projectRoot);

    expect(
      JSON.parse(
        fs.readFileSync(path.join(projectRoot, 'translations/en.json'), 'utf8')
      )
    ).toEqual({
      [hashSource({ dataFormat: 'JSX', source: 'Vue entry from i18next' })]:
        'Vue entry from i18next',
    });
  });
});

describe.concurrent('built setup commands', () => {
  const setupEnv = (projectRoot: string) => ({
    GT_API_KEY: '',
    GT_PROJECT_ID: '',
    GT_DEV_API_KEY: '',
    VITE_GT_DEV_API_KEY: '',
    XDG_CONFIG_HOME: path.join(projectRoot, 'xdg-config'),
    XDG_STATE_HOME: path.join(projectRoot, 'xdg-state'),
  });
  const jsonLines = (stdout: string) =>
    stdout
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as Record<string, unknown>);

  // The other Commander error kinds are covered in `initOnboarding.test.ts`.
  it('reports argument errors as one JSON result, and as text without --json', async () => {
    const projectRoot = createProject({ devDependencies: { gt: '*' } });
    const run = (...args: string[]) =>
      runBuiltProcess(args, projectRoot, setupEnv(projectRoot));
    const message = "argument 'invalid' is invalid";

    const [json, text, help] = await Promise.all([
      run('init', '--json', '--storage', 'invalid'),
      run('init', '--storage', 'invalid'),
      run('configure', '--json', '--help'),
    ]);

    expect(json.code).toBe(1);
    expect(jsonLines(json.stdout)).toEqual([
      {
        type: 'result',
        command: 'init',
        outcome: 'failed',
        completedSteps: [],
        error: expect.stringContaining(message),
      },
    ]);
    expect(json.stderr).toContain(message);
    expect(text.code).toBe(1);
    expect(text.stdout).toBe('');
    expect(text.stderr).toContain(message);
    expect(help.code).toBe(0);
    expect(help.stdout).toContain('Usage:');
    expect(help.stdout).not.toContain('"type":"result"');
  });

  it.each([
    [
      'gt-vue Vite',
      {
        dependencies: { 'gt-vue': '*', vite: '*' },
        devDependencies: { gt: '*' },
      },
      ['init', '--json', '--defaults', '--locales', 'fr'],
    ],
    [
      'React',
      {
        dependencies: { 'gt-react': '*', react: '*' },
        devDependencies: { gt: '*' },
      },
      [
        'init',
        '--json',
        '--defaults',
        '--locales',
        'fr',
        '--no-dev-credentials',
      ],
    ],
  ])(
    'writes only JSON events to stdout for a %s setup',
    async (_name, manifest, args) => {
      const projectRoot = createProject(manifest);
      writeProjectFiles(projectRoot, { 'src/.gitkeep': '' });

      const result = await runBuiltProcess(
        args,
        projectRoot,
        setupEnv(projectRoot)
      );

      expect(result.code).toBe(0);
      const events = jsonLines(result.stdout);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ type: 'result', outcome: 'success' });
      expect(result.stderr).toContain('gt.config.json');
      expect(
        JSON.parse(
          fs.readFileSync(path.join(projectRoot, 'gt.config.json'), 'utf8')
        )
      ).toMatchObject({ locales: ['fr'] });
    }
  );
});

async function runBuiltProcess(
  args: string[],
  cwd: string,
  environment: Record<string, string>
): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [cliBinPath, ...args],
      {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, NO_COLOR: '1', ...environment },
        timeout: 30_000,
      }
    );
    return { code: 0, stdout, stderr };
  } catch (error) {
    const result = error as { code?: number; stdout?: string; stderr?: string };
    return {
      code: typeof result.code === 'number' ? result.code : -1,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
    };
  }
}

function createProject(manifest: Record<string, unknown>): string {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-vue-cli-'));
  temporaryDirectories.push(projectRoot);
  fs.writeFileSync(
    path.join(projectRoot, 'package.json'),
    JSON.stringify(manifest)
  );
  return projectRoot;
}

function writeProjectFiles(
  projectRoot: string,
  files: Record<string, string>
): void {
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(projectRoot, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }
}

function linkInstalledVue(projectRoot: string): void {
  const nodeModules = path.join(projectRoot, 'node_modules');
  fs.mkdirSync(nodeModules, { recursive: true });
  fs.symlinkSync(
    installedVueDirectory,
    path.join(nodeModules, 'vue'),
    process.platform === 'win32' ? 'junction' : 'dir'
  );
}

async function runBuiltCli(args: string[], cwd: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      [cliBinPath, ...args],
      {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, NO_COLOR: '1' },
        timeout: 30_000,
      }
    );
    return stdout;
  } catch (error) {
    const result = error as Error & { stderr?: string; stdout?: string };
    throw new Error(
      [result.message, result.stdout, result.stderr].filter(Boolean).join('\n')
    );
  }
}

async function runNode(source: string, cwd: string): Promise<void> {
  await execFileAsync(
    process.execPath,
    ['--input-type=module', '--eval', source],
    {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
      timeout: 30_000,
    }
  );
}
