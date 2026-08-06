import { describe, expect, it } from 'vitest';
import { render, type RenderResult } from './entry-server';

interface RenderCase {
  locale: 'en' | 'fr';
  expected: readonly string[];
  unexpected: readonly string[];
  url: string;
}

const englishTsx = [
  'Local re-exports work in TSX',
  'Namespace components work in TSX.',
  'Translator forwarding works in TSX.',
] as const;
const frenchTsx = [
  'Les réexportations locales fonctionnent en TSX',
  'Les composants avec espace de noms fonctionnent en TSX.',
  'Le transfert du traducteur fonctionne en TSX.',
] as const;

const renderCases: readonly RenderCase[] = [
  {
    locale: 'en',
    expected: ['Developer documentation', ...englishTsx],
    unexpected: ['Documentation pour les développeurs', ...frenchTsx],
    url: '/',
  },
  {
    locale: 'fr',
    expected: ['Documentation pour les développeurs', ...frenchTsx],
    unexpected: ['Developer documentation', ...englishTsx],
    url: '/fr',
  },
  {
    locale: 'en',
    expected: ['Available operations', ...englishTsx],
    unexpected: ['Opérations disponibles', ...frenchTsx],
    url: '/reference',
  },
  {
    locale: 'fr',
    expected: ['Opérations disponibles', ...frenchTsx],
    unexpected: ['Available operations', ...englishTsx],
    url: '/fr/reference',
  },
] as const;

describe('Vue SSR translation isolation', () => {
  it('renders the selected locale before HTML is sent', async () => {
    const result = await render('/fr/reference');

    expect(result.locale).toBe('fr');
    expect(result.html).toContain('Référence de l’API');
    expect(result.html).toContain('Opérations disponibles');
  });

  it('isolates 128 overlapping English and French requests', async () => {
    const requests = Array.from(
      { length: 128 },
      (_, index) => renderCases[index % renderCases.length]
    );
    const results = await Promise.all(
      requests.map(async (request) => ({
        request,
        result: await render(request.url),
      }))
    );

    for (const { request, result } of results) {
      expectRequestLocale(result, request);
    }
  });
});

function expectRequestLocale(result: RenderResult, request: RenderCase) {
  expect(result.locale).toBe(request.locale);
  for (const expected of request.expected) {
    expect(result.html).toContain(expected);
  }
  for (const unexpected of request.unexpected) {
    expect(result.html).not.toContain(unexpected);
  }
}
