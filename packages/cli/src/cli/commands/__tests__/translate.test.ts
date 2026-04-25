import path from 'node:path';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { postProcessTranslations } from '../translate.js';
import type { Settings } from '../../../types/index.js';
import flattenJsonFiles from '../../../utils/flattenJsonFiles.js';
import processOpenApi from '../../../utils/processOpenApi.js';
import { persistPostProcessHashes } from '../../../utils/persistPostprocessHashes.js';

vi.mock('../../../utils/flattenJsonFiles.js', () => ({
  default: vi.fn(),
}));
vi.mock('../../../utils/processOpenApi.js', () => ({
  default: vi.fn(),
}));
vi.mock('../../../utils/localizeStaticUrls.js', () => ({
  default: vi.fn(),
}));
vi.mock('../../../utils/localizeRelativeAssets.js', () => ({
  default: vi.fn(),
}));
vi.mock('../../../utils/processAnchorIds.js', () => ({
  default: vi.fn(),
}));
vi.mock('../../../utils/localizeStaticImports.js', () => ({
  default: vi.fn(),
}));
vi.mock('../../../fs/copyFile.js', () => ({
  default: vi.fn(),
}));
vi.mock('../../../state/recentDownloads.js', () => ({
  getDownloadedMeta: vi.fn(() => new Map()),
}));
vi.mock('../../../utils/persistPostprocessHashes.js', () => ({
  persistPostProcessHashes: vi.fn(),
}));

function makeSettings(): Settings {
  return {
    defaultLocale: 'en',
    locales: ['fr'],
    files: {
      resolvedPaths: {
        pot: [path.resolve('locales/en/messages.pot')],
        json: [path.resolve('locales/en/messages.json')],
      },
      placeholderPaths: {
        pot: [path.resolve('locales/[locale]/messages.pot')],
        json: [path.resolve('locales/[locale]/messages.json')],
      },
      transformPaths: {},
      transformFormats: {
        pot: 'PO',
      },
      publishPaths: new Set(),
      unpublishPaths: new Set(),
      parsingFlags: {},
      gtJson: {
        parsingFlags: {},
      },
    },
    options: {
      experimentalFlattenJsonFiles: true,
    },
  } as Settings;
}

describe('postProcessTranslations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips postprocessing only for files transformed to another format', async () => {
    await postProcessTranslations(
      makeSettings(),
      new Set(['locales/fr/messages.po', 'locales/fr/messages.json'])
    );

    expect(processOpenApi).toHaveBeenCalledWith(
      expect.anything(),
      new Set(['locales/fr/messages.json'])
    );
    expect(flattenJsonFiles).toHaveBeenCalledWith(
      expect.anything(),
      new Set(['locales/fr/messages.json'])
    );
    expect(persistPostProcessHashes).toHaveBeenCalledWith(
      expect.anything(),
      new Set(['locales/fr/messages.json']),
      expect.anything()
    );
  });
});
