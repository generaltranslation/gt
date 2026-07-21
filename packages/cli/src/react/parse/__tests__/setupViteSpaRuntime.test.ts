import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setupViteSpaRuntime } from '../setupViteSpaRuntime.js';

describe('setupViteSpaRuntime', () => {
  let appDirectory: string;

  beforeEach(() => {
    appDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-vite-spa-'));
    fs.mkdirSync(path.join(appDirectory, 'src'));
    fs.writeFileSync(
      path.join(appDirectory, 'gt.config.json'),
      JSON.stringify({ defaultLocale: 'en', locales: ['es'] })
    );
  });

  afterEach(() => {
    fs.rmSync(appDirectory, { recursive: true, force: true });
  });

  it('creates a v11 bootstrap and points index.html at it without changing the app entry', async () => {
    const originalHtml = `<!doctype html>
<html>
  <head><title>User app</title></head>
  <body>
    <div id="root"></div>
    <!-- <script type="module" src="/src/main.tsx"></script> -->
    <script data-user="keep" src="/src/main.tsx?user=keep" type="module"></script>
  </body>
</html>
`;
    const originalAppEntry = `import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(<App />);
`;
    fs.writeFileSync(path.join(appDirectory, 'index.html'), originalHtml);
    fs.writeFileSync(
      path.join(appDirectory, 'src', 'main.tsx'),
      originalAppEntry
    );

    const filesUpdated: string[] = [];
    const warnings: string[] = [];
    await setupViteSpaRuntime({
      appDirectory,
      configFilepath: 'gt.config.json',
      filesUpdated,
      warnings,
    });

    const bootstrapPath = path.join(appDirectory, 'src', 'index.ts');
    const bootstrap = fs.readFileSync(bootstrapPath, 'utf8');
    expect(bootstrap).toContain("import { initializeGTSPA } from 'gt-react';");
    expect(bootstrap).toContain("import gtConfig from '../gt.config.json';");
    expect(bootstrap).toContain(
      "import loadTranslations from './loadTranslations';"
    );
    expect(bootstrap).toContain(
      'projectId: import.meta.env.VITE_GT_PROJECT_ID'
    );
    expect(bootstrap).toContain(
      'devApiKey: import.meta.env.VITE_GT_DEV_API_KEY'
    );
    expect(bootstrap).not.toContain('GTProvider');
    expect(bootstrap.indexOf('await initializeGTSPA')).toBeLessThan(
      bootstrap.indexOf("await import('./main.tsx?user=keep')")
    );

    expect(fs.readFileSync(path.join(appDirectory, 'index.html'), 'utf8')).toBe(
      originalHtml.replace(
        'data-user="keep" src="/src/main.tsx?user=keep"',
        'data-user="keep" src="/src/index.ts"'
      )
    );
    expect(
      fs.readFileSync(path.join(appDirectory, 'src', 'main.tsx'), 'utf8')
    ).toBe(originalAppEntry);
    expect(filesUpdated).toEqual([
      bootstrapPath,
      path.join(appDirectory, 'index.html'),
    ]);
    expect(warnings).toEqual([]);
  });

  it('is idempotent when the generated bootstrap is already the browser entry', async () => {
    fs.writeFileSync(
      path.join(appDirectory, 'index.html'),
      '<script type="module" src="./src/main.jsx"></script>\n'
    );
    fs.writeFileSync(
      path.join(appDirectory, 'src', 'main.jsx'),
      "console.log('render user app');\n"
    );

    await setupViteSpaRuntime({
      appDirectory,
      configFilepath: 'gt.config.json',
      filesUpdated: [],
      warnings: [],
    });
    const htmlAfterFirstRun = fs.readFileSync(
      path.join(appDirectory, 'index.html'),
      'utf8'
    );
    const entryAfterFirstRun = fs.readFileSync(
      path.join(appDirectory, 'src', 'index.js'),
      'utf8'
    );

    const filesUpdated: string[] = [];
    const warnings: string[] = [];
    await setupViteSpaRuntime({
      appDirectory,
      configFilepath: 'gt.config.json',
      filesUpdated,
      warnings,
    });

    expect(fs.readFileSync(path.join(appDirectory, 'index.html'), 'utf8')).toBe(
      htmlAfterFirstRun
    );
    expect(
      fs.readFileSync(path.join(appDirectory, 'src', 'index.js'), 'utf8')
    ).toBe(entryAfterFirstRun);
    expect(filesUpdated).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('preserves an existing index module by using a dedicated fallback entry', async () => {
    const customIndex = "export const userCode = 'keep me';\n";
    fs.writeFileSync(
      path.join(appDirectory, 'index.html'),
      '<script type="module" src="src/main.tsx"></script>\n'
    );
    fs.writeFileSync(path.join(appDirectory, 'src', 'main.tsx'), '// render\n');
    fs.writeFileSync(path.join(appDirectory, 'src', 'index.ts'), customIndex);

    await setupViteSpaRuntime({
      appDirectory,
      configFilepath: 'gt.config.json',
      filesUpdated: [],
      warnings: [],
    });

    expect(
      fs.readFileSync(path.join(appDirectory, 'src', 'index.ts'), 'utf8')
    ).toBe(customIndex);
    expect(
      fs.readFileSync(path.join(appDirectory, 'src', 'gt-entry.ts'), 'utf8')
    ).toContain("await import('./main.tsx')");
    expect(fs.readFileSync(path.join(appDirectory, 'index.html'), 'utf8')).toBe(
      '<script type="module" src="src/gt-entry.ts"></script>\n'
    );
  });

  it('leaves ambiguous browser entries unchanged and reports manual guidance', async () => {
    const originalHtml = `<script type="module" src="/src/main.tsx"></script>
<script type="module" src="/src/admin.tsx"></script>
`;
    fs.writeFileSync(path.join(appDirectory, 'index.html'), originalHtml);
    fs.writeFileSync(path.join(appDirectory, 'src', 'main.tsx'), '// main\n');
    fs.writeFileSync(path.join(appDirectory, 'src', 'admin.tsx'), '// admin\n');
    const warnings: string[] = [];

    await setupViteSpaRuntime({
      appDirectory,
      configFilepath: 'gt.config.json',
      filesUpdated: [],
      warnings,
    });

    expect(fs.readFileSync(path.join(appDirectory, 'index.html'), 'utf8')).toBe(
      originalHtml
    );
    expect(fs.existsSync(path.join(appDirectory, 'src', 'index.ts'))).toBe(
      false
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('multiple local module entries');
    expect(warnings[0]).toContain('initializeGTSPA');
  });
});
