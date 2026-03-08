import { describe, it, expect, vi } from 'vitest';
import { createLocalTranslationLoader } from '../createLocalTranslationLoader';

vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
  },
}));

describe('createLocalTranslationLoader', () => {
  it('returns loader function', () => {
    const loader = createLocalTranslationLoader({
      translationOutputPath: 'public/_gt/[locale].json',
    });
    expect(typeof loader).toBe('function');
  });

  it('reads translations from local file', async () => {
    const mockTranslations = { greeting: 'Hola, mundo!' };
    const fs = await import('fs');
    (fs.promises.readFile as any).mockResolvedValueOnce(
      JSON.stringify(mockTranslations)
    );

    const loader = createLocalTranslationLoader({
      translationOutputPath: 'public/_gt/[locale].json',
    });

    const result = await loader('es');
    expect(fs.promises.readFile).toHaveBeenCalledWith(
      'public/_gt/es.json',
      'utf-8'
    );
    expect(result).toEqual(mockTranslations);
  });

  it('throws on file read failure', async () => {
    const fs = await import('fs');
    (fs.promises.readFile as any).mockRejectedValueOnce(
      new Error('ENOENT: no such file or directory')
    );

    const loader = createLocalTranslationLoader({
      translationOutputPath: 'public/_gt/[locale].json',
    });

    await expect(loader('fr')).rejects.toThrow('ENOENT');
  });
});
