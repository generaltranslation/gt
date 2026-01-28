import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import localizeRelativeAssets, {
  localizeRelativeAssetsForContent,
} from '../localizeRelativeAssets';

vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
  existsSync: vi.fn(),
}));

vi.mock('../../formats/files/fileMapping.js', () => ({
  createFileMapping: vi.fn(),
}));

import { createFileMapping } from '../../formats/files/fileMapping.js';

describe('localizeRelativeAssets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rewrites relative image urls to absolute paths when source asset exists', async () => {
    const mockFileMapping = {
      es: {
        '/proj/demoIndex.mdx': '/proj/es/demoIndex.mdx',
      },
    };

    vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);
    vi.mocked(fs.promises.readFile).mockResolvedValue(
      "<img src='whatsapp-clawd.jpg' />"
    );
    vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.existsSync).mockImplementation((p: any) => {
      if (p === '/proj/es/demoIndex.mdx') return true;
      if (p === '/proj/demoIndex.mdx') return true;
      if (p === '/proj/es/whatsapp-clawd.jpg') return false;
      if (p === '/proj/whatsapp-clawd.jpg') return true;
      return false;
    });

    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/proj');

    const settings = {
      files: {
        placeholderPaths: { docs: '/docs' },
        resolvedPaths: {},
        transformPaths: {},
      },
      locales: ['en', 'es'],
      defaultLocale: 'en',
    };

    await localizeRelativeAssets(settings as any, ['es']);

    expect(fs.promises.writeFile).toHaveBeenCalledTimes(1);
    const written = vi.mocked(fs.promises.writeFile).mock.calls[0][1] as string;
    expect(written).toContain("src='/whatsapp-clawd.jpg'");

    cwdSpy.mockRestore();
  });

  it('does not rewrite if target-relative asset exists', () => {
    vi.mocked(fs.existsSync).mockImplementation((p: any) => {
      if (p === '/proj/es/whatsapp-clawd.jpg') return true;
      return false;
    });

    const result = localizeRelativeAssetsForContent(
      "<img src='whatsapp-clawd.jpg' />",
      '/proj/demoIndex.mdx',
      '/proj/es/demoIndex.mdx',
      '/proj'
    );

    expect(result.hasChanges).toBe(false);
  });

  it('ignores absolute and remote urls', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = localizeRelativeAssetsForContent(
      "<img src='https://example.com/a.jpg' />\\n<img src='/a.jpg' />",
      '/proj/demoIndex.mdx',
      '/proj/es/demoIndex.mdx',
      '/proj'
    );

    expect(result.hasChanges).toBe(false);
    expect(result.content).toContain("src='https://example.com/a.jpg'");
    expect(result.content).toContain("src='/a.jpg'");
  });

  it('does not rewrite markdown links', () => {
    vi.mocked(fs.existsSync).mockImplementation((p: any) => {
      if (p === '/proj/whatsapp-clawd.jpg') return true;
      return false;
    });

    const result = localizeRelativeAssetsForContent(
      '![img](whatsapp-clawd.jpg) and [doc](whatsapp-clawd.jpg)',
      '/proj/demoIndex.mdx',
      '/proj/es/demoIndex.mdx',
      '/proj'
    );

    expect(result.hasChanges).toBe(true);
    expect(result.content).toContain('/whatsapp-clawd.jpg');
    expect(result.content).toContain('[doc](whatsapp-clawd.jpg)');
  });
});
