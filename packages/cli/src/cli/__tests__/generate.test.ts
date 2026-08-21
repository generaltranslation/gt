import { Command } from 'commander';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BaseCLI } from '../base.js';

describe('gt generate', () => {
  const originalCwd = process.cwd();
  let projectDir: string;

  beforeEach(() => {
    projectDir = mkdtempSync(path.join(tmpdir(), 'gt-generate-'));
    process.chdir(projectDir);

    mkdirSync(path.join(projectDir, 'content', 'en'), { recursive: true });
    mkdirSync(path.join(projectDir, 'messages', 'en'), { recursive: true });
    mkdirSync(path.join(projectDir, 'content', 'es'), { recursive: true });
    writeFileSync(
      path.join(projectDir, 'content', 'en', 'intro.mdx'),
      'Hello\n\n[Guide](/en/blah)'
    );
    writeFileSync(
      path.join(projectDir, 'messages', 'en', 'common.json'),
      JSON.stringify({ hello: 'Hello' })
    );
    writeFileSync(
      path.join(projectDir, 'content', 'es', 'intro.mdx'),
      '# Hola'
    );
    writeFileSync(
      path.join(projectDir, 'gt.config.json'),
      JSON.stringify({
        defaultLocale: 'en',
        locales: ['es', 'fr'],
        files: {
          mdx: { include: ['content/[locale]/*.mdx'] },
          json: { include: ['messages/[locale]/*.json'] },
        },
        options: { experimentalLocalizeStaticUrls: true },
      })
    );
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(projectDir, { recursive: true, force: true });
  });

  it('seeds missing locale files without replacing existing translations', async () => {
    const program = new Command();
    const cli = new BaseCLI(program, 'base');
    cli.init();

    await program.parseAsync(
      ['generate', '--config', path.join(projectDir, 'gt.config.json')],
      { from: 'user' }
    );

    expect(
      readFileSync(path.join(projectDir, 'content', 'es', 'intro.mdx'), 'utf8')
    ).toBe('# Hola');
    expect(
      readFileSync(path.join(projectDir, 'content', 'fr', 'intro.mdx'), 'utf8')
    ).toBe('Hello\n\n[Guide](/fr/blah)');
    expect(
      JSON.parse(
        readFileSync(
          path.join(projectDir, 'messages', 'fr', 'common.json'),
          'utf8'
        )
      )
    ).toEqual({ hello: 'Hello' });
  });
});
