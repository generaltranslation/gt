import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BUILD_TOOL_SETUPS, getSetupDocsUrl } from '../buildTools/index.js';

const docs = 'https://generaltranslation.com/docs/react';

describe('setup docs URLs', () => {
  it('links each build tool to its setup guide', () => {
    expect(
      Object.fromEntries(
        BUILD_TOOL_SETUPS.map((setup) => [setup.framework, setup.docsUrl])
      )
    ).toEqual({
      vite: `${docs}/react-spa-quickstart`,
      'tanstack-start': `${docs}/tanstack-start/setup`,
      'react-router': `${docs}/react-router-quickstart`,
    });
  });

  it.each([
    ['next-app', `${docs}/nextjs-quickstart`],
    ['next-pages', `${docs}/nextjs-pages-router-quickstart`],
    ['vite', `${docs}/react-spa-quickstart`],
    ['tanstack-start', `${docs}/tanstack-start/setup`],
    ['react-router', `${docs}/react-router-quickstart`],
    ['react', `${docs}/react-quickstart`],
    ['gatsby', `${docs}/react-quickstart`],
    [undefined, `${docs}/react-quickstart`],
  ])('links %s to %s', (framework, url) => {
    expect(getSetupDocsUrl(framework)).toBe(url);
  });

  it('keeps the retired tutorials quickstart out of package sources', () => {
    // The old tutorials quickstart pages redirect to the React overview.
    const retired = ['tutorials', 'quickstart'].join('/');
    const packagesDir = fileURLToPath(new URL('../../../../', import.meta.url));
    const offenders: string[] = [];
    const scan = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules') scan(file);
        } else if (fs.readFileSync(file, 'utf8').includes(retired)) {
          offenders.push(path.relative(packagesDir, file));
        }
      }
    };
    for (const pkg of fs.readdirSync(packagesDir)) {
      const src = path.join(packagesDir, pkg, 'src');
      if (fs.existsSync(src)) scan(src);
    }
    expect(offenders).toEqual([]);
  });
});
