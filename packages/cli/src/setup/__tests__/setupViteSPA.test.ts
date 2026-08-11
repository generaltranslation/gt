import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setupViteSPA } from '../setupViteSPA.js';

describe('setupViteSPA', () => {
  let appDirectory: string;

  beforeEach(() => {
    appDirectory = fs.mkdtempSync(path.join(tmpdir(), 'gt-vite-spa-'));
    fs.mkdirSync(path.join(appDirectory, 'src'));
    fs.writeFileSync(
      path.join(appDirectory, 'index.html'),
      '<div id="root"></div>\n<script>document.documentElement.dataset.theme = "dark";</script>\n<script type="module" src="/src/main.tsx"></script>\n'
    );
    fs.writeFileSync(path.join(appDirectory, 'src', 'main.tsx'), '// app');
    fs.writeFileSync(path.join(appDirectory, 'gt.config.json'), '{}');
  });

  afterEach(() => {
    fs.rmSync(appDirectory, { recursive: true, force: true });
  });

  it('configures bundled translations before rendering the app', async () => {
    await setupViteSPA({
      appDirectory,
      configFilepath: 'gt.config.json',
      defaultLocale: 'en',
      locales: ['fr', 'zh', 'en'],
      translationsDir: 'src/_gt',
    });

    expect(
      fs.readFileSync(path.join(appDirectory, 'index.html'), 'utf8')
    ).toContain('src="/src/gt-entry.ts"');
    expect(
      fs.readFileSync(path.join(appDirectory, 'src', 'gt-entry.ts'), 'utf8')
    ).toBe(`import { initializeGTSPA } from 'gt-react';
import gtConfig from '../gt.config.json';
import loadTranslations from './loadTranslations';

await initializeGTSPA({ ...gtConfig, loadTranslations });

await import('./main');
`);
    expect(
      fs.readFileSync(
        path.join(appDirectory, 'src', 'loadTranslations.ts'),
        'utf8'
      )
    ).toContain('import(`./_gt/${locale}.json`)');
    expect(
      fs.readFileSync(path.join(appDirectory, 'src', '_gt', 'fr.json'), 'utf8')
    ).toBe('{}\n');
    expect(
      fs.existsSync(path.join(appDirectory, 'src', '_gt', 'zh.json'))
    ).toBe(true);
    expect(
      fs.existsSync(path.join(appDirectory, 'src', '_gt', 'en.json'))
    ).toBe(false);
  });

  it('preserves existing translation files and custom loaders', async () => {
    fs.mkdirSync(path.join(appDirectory, 'src', '_gt'));
    fs.writeFileSync(
      path.join(appDirectory, 'src', '_gt', 'fr.json'),
      '{"hello":"bonjour"}'
    );
    fs.writeFileSync(
      path.join(appDirectory, 'src', 'loadTranslations.ts'),
      '// custom loader'
    );

    await setupViteSPA({
      appDirectory,
      configFilepath: 'gt.config.json',
      defaultLocale: 'en',
      locales: ['fr'],
      translationsDir: 'src/_gt',
    });

    expect(
      fs.readFileSync(path.join(appDirectory, 'src', '_gt', 'fr.json'), 'utf8')
    ).toBe('{"hello":"bonjour"}');
    expect(
      fs.readFileSync(
        path.join(appDirectory, 'src', 'loadTranslations.ts'),
        'utf8'
      )
    ).toBe('// custom loader');
  });

  it('uses CDN loading when no translations directory is configured', async () => {
    await setupViteSPA({
      appDirectory,
      configFilepath: 'gt.config.json',
      defaultLocale: 'en',
      locales: ['fr'],
    });

    const bootstrap = fs.readFileSync(
      path.join(appDirectory, 'src', 'gt-entry.ts'),
      'utf8'
    );
    expect(bootstrap).toContain('await initializeGTSPA(gtConfig);');
    expect(bootstrap).not.toContain('loadTranslations');
  });

  it('imports the app entry declared in index.html', async () => {
    fs.writeFileSync(
      path.join(appDirectory, 'index.html'),
      '<script type="module" src="/src/app.tsx"></script>\n'
    );
    fs.writeFileSync(path.join(appDirectory, 'src', 'app.tsx'), '// app');

    await setupViteSPA({
      appDirectory,
      configFilepath: 'gt.config.json',
      defaultLocale: 'en',
      locales: ['fr'],
    });

    expect(
      fs.readFileSync(path.join(appDirectory, 'src', 'gt-entry.ts'), 'utf8')
    ).toContain("await import('./app');");
  });

  it.each(['index.tsx', 'index.jsx', 'index.js'])(
    'does not collide with an %s app entry',
    async (entry) => {
      fs.writeFileSync(
        path.join(appDirectory, 'index.html'),
        `<script type="module" src="/src/${entry}"></script>\n`
      );
      fs.writeFileSync(path.join(appDirectory, 'src', entry), '// app');

      await setupViteSPA({
        appDirectory,
        configFilepath: 'gt.config.json',
        defaultLocale: 'en',
        locales: ['fr'],
      });

      expect(
        fs.readFileSync(path.join(appDirectory, 'src', 'gt-entry.ts'), 'utf8')
      ).toContain("await import('./index');");
      expect(
        fs.readFileSync(path.join(appDirectory, 'src', entry), 'utf8')
      ).toBe('// app');
    }
  );

  it.each(['gt-entry.tsx', 'gt-entry.jsx', 'gt-entry.js'])(
    'does not self-import when the app entry is %s',
    async (entry) => {
      fs.writeFileSync(
        path.join(appDirectory, 'index.html'),
        `<script type="module" src="/src/${entry}"></script>\n`
      );
      fs.writeFileSync(path.join(appDirectory, 'src', entry), '// app');

      await setupViteSPA({
        appDirectory,
        configFilepath: 'gt.config.json',
        defaultLocale: 'en',
        locales: ['fr'],
      });

      expect(
        fs.readFileSync(path.join(appDirectory, 'index.html'), 'utf8')
      ).toContain('src="/src/gt-bootstrap.ts"');
      expect(
        fs.readFileSync(
          path.join(appDirectory, 'src', 'gt-bootstrap.ts'),
          'utf8'
        )
      ).toContain("await import('./gt-entry');");
      expect(
        fs.readFileSync(path.join(appDirectory, 'src', entry), 'utf8')
      ).toBe('// app');
    }
  );

  it('updates the bootstrap when switching to bundled translations', async () => {
    await setupViteSPA({
      appDirectory,
      configFilepath: 'gt.config.json',
      defaultLocale: 'en',
      locales: ['fr'],
    });
    await setupViteSPA({
      appDirectory,
      configFilepath: 'gt.config.json',
      defaultLocale: 'en',
      locales: ['fr'],
      translationsDir: 'src/_gt',
    });

    const bootstrap = fs.readFileSync(
      path.join(appDirectory, 'src', 'gt-entry.ts'),
      'utf8'
    );
    expect(bootstrap).toContain(
      'await initializeGTSPA({ ...gtConfig, loadTranslations });'
    );
    expect(bootstrap).toContain("await import('./main');");
  });

  it('updates a generated loader when the translations directory changes', async () => {
    await setupViteSPA({
      appDirectory,
      configFilepath: 'gt.config.json',
      defaultLocale: 'en',
      locales: ['fr'],
      translationsDir: 'src/_gt',
    });
    await setupViteSPA({
      appDirectory,
      configFilepath: 'gt.config.json',
      defaultLocale: 'en',
      locales: ['fr'],
      translationsDir: 'src/translations',
    });

    const loader = fs.readFileSync(
      path.join(appDirectory, 'src', 'loadTranslations.ts'),
      'utf8'
    );
    expect(loader).toContain('import(`./translations/${locale}.json`)');
    expect(loader).not.toContain('import(`./_gt/${locale}.json`)');
  });

  it('does not overwrite an existing non-GT bootstrap', async () => {
    fs.writeFileSync(
      path.join(appDirectory, 'src', 'gt-entry.ts'),
      '// custom'
    );

    await expect(
      setupViteSPA({
        appDirectory,
        configFilepath: 'gt.config.json',
        defaultLocale: 'en',
        locales: ['fr'],
        translationsDir: 'src/_gt',
      })
    ).rejects.toThrow('GT will not overwrite an existing src/gt-entry.ts file');
    expect(
      fs.readFileSync(path.join(appDirectory, 'index.html'), 'utf8')
    ).toContain('src="/src/main.tsx"');
  });
});
