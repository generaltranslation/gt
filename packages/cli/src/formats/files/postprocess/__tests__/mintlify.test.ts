import { beforeEach, describe, expect, it, vi } from 'vitest';
import { postprocessMintlify } from '../mintlify.js';
import processOpenApi from '../../../../utils/processOpenApi.js';
import localizeMintlifyFrontmatterUrls from '../../../../utils/localizeMintlifyFrontmatterUrls.js';
import type { Settings } from '../../../../types/index.js';

vi.mock('../../../../utils/processOpenApi.js', () => ({
  default: vi.fn(),
}));
vi.mock('../../../../utils/localizeMintlifyFrontmatterUrls.js', () => ({
  default: vi.fn(),
}));

describe('postprocessMintlify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs OpenAPI postprocessing for explicit Mintlify OpenAPI config', async () => {
    const settings = {
      options: {
        mintlify: {
          openapi: {
            files: ['./openapi.json'],
          },
        },
      },
    } as Settings;

    await postprocessMintlify(settings);

    expect(processOpenApi).toHaveBeenCalledWith(settings, undefined);
    expect(localizeMintlifyFrontmatterUrls).not.toHaveBeenCalled();
  });

  it('runs all Mintlify postprocessors for detected Mintlify projects', async () => {
    const settings = {
      framework: 'mintlify',
    } as Settings;
    const includeFiles = new Set(['ja/sandboxes.mdx']);

    await postprocessMintlify(settings, includeFiles);

    expect(processOpenApi).toHaveBeenCalledWith(settings, includeFiles);
    expect(localizeMintlifyFrontmatterUrls).toHaveBeenCalledWith(
      settings,
      includeFiles
    );
  });

  it('skips non-Mintlify projects without Mintlify OpenAPI config', async () => {
    await postprocessMintlify({ framework: 'next-app' } as Settings);

    expect(processOpenApi).not.toHaveBeenCalled();
    expect(localizeMintlifyFrontmatterUrls).not.toHaveBeenCalled();
  });
});
