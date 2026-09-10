import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SRC_PATTERNS } from '../generateSettings.js';
import { matchFiles } from '../../fs/matchFiles.js';

// Files laid out relative to the fixture root.
const FIXTURE_FILES = [
  // Root-level source files that users are told to create (issue #1045).
  'server.js',
  'index.ts',
  'middleware.ts',
  // Root-level config / build / declaration files that must NOT be scanned.
  'next.config.ts',
  'next.config.js',
  'vite.config.ts',
  'tailwind.config.ts',
  'babel.config.js',
  'next-env.d.ts',
  'types.d.ts',
  // Files inside the existing directory patterns.
  'src/app/page.tsx',
  'app/layout.tsx',
  'pages/index.tsx',
  'components/Button.tsx',
  // A config file nested in src/ (existing behavior must be preserved).
  'src/setup.config.ts',
];

describe('DEFAULT_SRC_PATTERNS', () => {
  let root: string;
  let matched: Set<string>;

  beforeAll(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gt-src-')));
    for (const file of FIXTURE_FILES) {
      const abs = path.join(root, file);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, '// fixture\n');
    }
    matched = new Set(
      matchFiles(root, DEFAULT_SRC_PATTERNS).map((f) => path.relative(root, f))
    );
  });

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('matches root-level source files like server.js', () => {
    expect(matched).toContain('server.js');
    expect(matched).toContain('index.ts');
    expect(matched).toContain('middleware.ts');
  });

  it('does not match root-level config or declaration files', () => {
    expect(matched).not.toContain('next.config.ts');
    expect(matched).not.toContain('next.config.js');
    expect(matched).not.toContain('vite.config.ts');
    expect(matched).not.toContain('tailwind.config.ts');
    expect(matched).not.toContain('babel.config.js');
    expect(matched).not.toContain('next-env.d.ts');
    expect(matched).not.toContain('types.d.ts');
  });

  it('still matches the existing directory patterns', () => {
    expect(matched).toContain(path.join('src', 'app', 'page.tsx'));
    expect(matched).toContain(path.join('app', 'layout.tsx'));
    expect(matched).toContain(path.join('pages', 'index.tsx'));
    expect(matched).toContain(path.join('components', 'Button.tsx'));
  });

  it('keeps matching config-named files nested in source directories', () => {
    // Root-scoped negations must not leak into subdirectories.
    expect(matched).toContain(path.join('src', 'setup.config.ts'));
  });
});
