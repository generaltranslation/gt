import { Command } from 'commander';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hashSource } from 'generaltranslation/id';
import type { TranslateFlags } from '../../types/index.js';
import { clearEmbeddedHashes } from '../../state/embeddedHashes.js';
import { InlineCLI } from '../inline.js';

vi.mock('../../console/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    message: vi.fn(),
    step: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
  },
}));

class GenerateCLI extends InlineCLI {
  generate(options: TranslateFlags) {
    return this.handleGenerateSourceCommand(options);
  }
}

const cwd = process.cwd();
afterEach(() => {
  process.chdir(cwd);
  clearEmbeddedHashes();
});

describe('gt generate', () => {
  it('writes msgOutput files for embedded locales', async () => {
    const dir = fs.realpathSync(
      fs.mkdtempSync(path.join(tmpdir(), 'gt-generate-msg-'))
    );
    try {
      fs.writeFileSync(
        path.join(dir, 'gt.config.json'),
        JSON.stringify({
          defaultLocale: 'en',
          locales: ['fr'],
          files: {
            gt: {
              output: 'translations/[locale].json',
              inlineTranslations: {
                locales: ['fr'],
                msgOutput: 'translations/[locale].msg.json',
              },
            },
          },
        })
      );
      fs.mkdirSync(path.join(dir, 'src'));
      fs.writeFileSync(
        path.join(dir, 'src/page.tsx'),
        `import { T, msg } from 'gt-next';
export const label = msg('Loaded');
export const page = <T>Embedded</T>;
`
      );
      process.chdir(dir);

      await new GenerateCLI(new Command(), 'gt-next').generate({
        config: path.join(dir, 'gt.config.json'),
      } as TranslateFlags);

      const read = (file: string) =>
        JSON.parse(
          fs.readFileSync(path.join(dir, 'translations', file), 'utf8')
        );
      const loadedHash = hashSource({ source: 'Loaded', dataFormat: 'ICU' });
      expect(Object.keys(read('fr.json'))).toHaveLength(2);
      expect(read('fr.msg.json')).toEqual({ [loadedHash]: 'Loaded' });
    } finally {
      process.chdir(cwd);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
