import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { wrapContentReact } from '../wrapContent.js';
import { Libraries } from '../../../types/libraries.js';

describe('wrapContentReact provider behavior', () => {
  let originalCwd: string;
  let tempDirectory: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-wrap-provider-'));
    process.chdir(tempDirectory);
    fs.mkdirSync('pages');
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });

  it('does not inject the legacy config-backed provider into Next Pages', async () => {
    const source = `
export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
`;
    const filePath = path.join(tempDirectory, 'pages', '_app.tsx');
    fs.writeFileSync(filePath, source);

    const errors: string[] = [];
    const warnings: string[] = [];
    const result = await wrapContentReact(
      {
        src: ['pages/_app.tsx'],
        config: 'gt.config.json',
        skipTs: true,
        disableIds: true,
        disableFormatting: true,
        addGTProvider: true,
      },
      Libraries.GT_REACT,
      'next-pages',
      errors,
      warnings
    );

    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(result.filesUpdated).toEqual([]);
    const transformedSource = fs.readFileSync(filePath, 'utf8');
    expect(transformedSource).toBe(source);
    expect(transformedSource).not.toContain('GTProvider');
    expect(transformedSource).not.toContain('gtConfig');
  });
});
