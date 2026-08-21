import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { matchFiles } from '../../../fs/matchFiles.js';
import { Libraries } from '../../../types/libraries.js';
import { wrapContentReact } from '../wrapContent.js';

vi.mock('../../../fs/matchFiles.js', () => ({
  matchFiles: vi.fn(),
}));

describe('wrapContentReact', () => {
  const originalSeparator = Object.getOwnPropertyDescriptor(path, 'sep')!;
  const tempDirs: string[] = [];

  afterEach(() => {
    Object.defineProperty(path, 'sep', originalSeparator);
    vi.restoreAllMocks();
    for (const tempDir of tempDirs) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it('writes a slash-separated config import on Windows', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-wrap-'));
    tempDirs.push(tempDir);
    const filePath = path.join(tempDir, 'pages', '_app.tsx');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(
      filePath,
      [
        'export default function App({ Component, pageProps }) {',
        '  return <Component {...pageProps} />;',
        '}',
      ].join('\n')
    );
    vi.mocked(matchFiles).mockReturnValue([filePath]);

    Object.defineProperty(path, 'sep', {
      ...originalSeparator,
      value: path.win32.sep,
    });
    const nativeRelative = path.relative.bind(path);
    vi.spyOn(path, 'relative').mockImplementation((from, to) =>
      from === path.dirname(filePath) &&
      to === path.resolve(process.cwd(), 'gt.config.json')
        ? '..\\gt.config.json'
        : nativeRelative(from, to)
    );

    const errors: string[] = [];
    const result = await wrapContentReact(
      {
        src: ['pages/_app.tsx'],
        config: 'gt.config.json',
        skipTs: false,
        disableIds: false,
        disableFormatting: false,
        addGTProvider: true,
      },
      Libraries.GT_REACT,
      'next-pages',
      errors,
      []
    );

    expect(errors).toEqual([]);
    expect(result.filesUpdated).toEqual([filePath]);
    expect(fs.readFileSync(filePath, 'utf8')).toContain(
      'from "../gt.config.json"'
    );
  });
});
