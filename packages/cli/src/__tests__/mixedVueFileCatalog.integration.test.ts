import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Command } from 'commander';
import type { FileToUpload } from 'generaltranslation/types';
import { afterEach, describe, expect, it, vi } from 'vitest';

const loggingMocks = vi.hoisted(() => ({
  logCollectedFiles: vi.fn(),
}));

vi.mock('../console/logging.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../console/logging.js')>();
  return {
    ...actual,
    logCollectedFiles: loggingMocks.logCollectedFiles,
  };
});

import { main } from '../index.js';
import { logger } from '../console/logger.js';

const initialCwd = process.cwd();
const temporaryDirectories: string[] = [];
const vueNodeModules = path.resolve(
  import.meta.dirname,
  '../../../vue-extractor/node_modules'
);
const vueMessageHash = '64d944a98839aaae';

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value));
}

function createMixedProject(fileLibrary: 'i18next' | 'next-intl'): string {
  const projectRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'gt-vue-mixed-catalog-')
  );
  temporaryDirectories.push(projectRoot);

  writeJson(path.join(projectRoot, 'package.json'), {
    dependencies: {
      'gt-vue': '*',
      [fileLibrary]: '*',
      vue: '^3.5.0',
    },
  });
  writeJson(path.join(projectRoot, 'gt.config.json'), {
    defaultLocale: 'en',
    locales: ['fr'],
    files: {
      json: { include: ['messages/[locale].json'] },
      gt: { output: 'translations/[locale].json' },
    },
  });
  writeJson(path.join(projectRoot, 'messages/en.json'), {
    greeting: 'Hello file',
  });
  fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, 'src/App.vue'),
    `<script setup lang="ts">
import { T } from 'gt-vue';
</script>

<template><T>Hello Vue</T></template>
`
  );
  fs.symlinkSync(
    vueNodeModules,
    path.join(projectRoot, 'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir'
  );

  process.chdir(projectRoot);
  return projectRoot;
}

afterEach(() => {
  process.chdir(initialCwd);
  logger.setQuiet(false);
  loggingMocks.logCollectedFiles.mockReset();
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('mixed Vue and file-library CLI integration', () => {
  it.each([
    ['i18next', 'I18NEXT'],
    ['next-intl', 'ICU'],
  ] as const)(
    'collects the historical %s catalog and the Vue GTJSON catalog',
    async (fileLibrary, expectedDataFormat) => {
      createMixedProject(fileLibrary);
      const program = new Command();

      main(program);

      const commandNames = program.commands.map((command) => command.name());
      expect(commandNames).toContain('validate');
      expect(commandNames).toContain('generate');

      await program.parseAsync(
        ['--quiet', 'translate', '--dry-run', '--config', 'gt.config.json'],
        { from: 'user' }
      );

      expect(loggingMocks.logCollectedFiles).toHaveBeenCalledOnce();
      const [files, vueComponents] = loggingMocks.logCollectedFiles.mock
        .calls[0] as [FileToUpload[], number];
      expect(vueComponents).toBe(1);

      const fileCatalog = files.find((file) => file.fileFormat === 'JSON');
      expect(fileCatalog).toMatchObject({
        dataFormat: expectedDataFormat,
        fileName: path.join('messages', 'en.json'),
        locale: 'en',
      });
      expect(JSON.parse(fileCatalog!.content)).toEqual({
        greeting: 'Hello file',
      });

      const vueCatalog = files.find((file) => file.fileFormat === 'GTJSON');
      expect(vueCatalog).toBeDefined();
      expect(JSON.parse(vueCatalog!.content)).toEqual({
        [vueMessageHash]: 'Hello Vue',
      });
      expect(vueCatalog!.formatMetadata).toMatchObject({
        [vueMessageHash]: {
          dataFormat: 'JSX',
          hash: vueMessageHash,
        },
      });
    }
  );
});
