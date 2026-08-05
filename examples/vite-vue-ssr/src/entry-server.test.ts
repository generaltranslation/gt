import { describe, expect, it } from 'vitest';
import { createReusableRenderer, render } from './entry-server';

describe('Vue SSR translation isolation', () => {
  it('renders the selected locale before HTML is sent', async () => {
    const result = await render('/fr/reference');

    expect(result.locale).toBe('fr');
    expect(result.html).toContain('Référence de l’API');
    expect(result.html).toContain('Opérations disponibles');
  });

  it('sets the locale on every render when a renderer is reused', async () => {
    const renderRoute = await createReusableRenderer();

    expect((await renderRoute('/')).html).toContain('Developer documentation');
    expect((await renderRoute('/fr')).html).toContain(
      'Documentation pour les développeurs'
    );
    expect((await renderRoute('/reference')).html).toContain('API reference');
  });

  it('keeps independent renderers isolated when locales overlap', async () => {
    const [renderEnglish, renderFrench] = await Promise.all([
      createReusableRenderer(),
      createReusableRenderer(),
    ]);
    const [english, french] = await Promise.all([
      renderEnglish('/reference'),
      renderFrench('/fr/reference'),
    ]);

    expect(english.html).toContain('Available operations');
    expect(english.html).not.toContain('Opérations disponibles');
    expect(french.html).toContain('Opérations disponibles');
    expect(french.html).not.toContain('Available operations');
  });
});
