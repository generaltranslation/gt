import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseCLI } from '../base.js';

vi.mock('../commands/stage.js', () => ({
  handleStage: vi.fn(async () => null),
}));

describe('gt stage config update', () => {
  const originalCwd = process.cwd();
  const config = JSON.stringify({ defaultLocale: 'en', locales: ['es'] });
  let configPath: string;
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(tmpdir(), 'gt-stage-dry-run-'));
    configPath = path.join(root, 'gt.config.json');
    fs.writeFileSync(path.join(root, 'package.json'), '{}');
    fs.writeFileSync(configPath, config);
    process.chdir(root);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(root, { recursive: true, force: true });
  });

  async function stage(args: string[]) {
    const program = new Command();
    new BaseCLI(program, 'base').init();
    await program.parseAsync(['--quiet', 'stage', ...args], { from: 'user' });
  }

  it('leaves gt.config.json unchanged on a dry run', async () => {
    await stage(['--dry-run']);

    expect(fs.readFileSync(configPath, 'utf8')).toBe(config);
  });

  it('sets stageTranslations in gt.config.json on a real run', async () => {
    await stage([]);

    expect(JSON.parse(fs.readFileSync(configPath, 'utf8'))).toEqual({
      defaultLocale: 'en',
      locales: ['es'],
      stageTranslations: true,
    });
  });
});
