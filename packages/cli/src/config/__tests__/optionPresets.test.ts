import { describe, it, expect, vi } from 'vitest';
import { generatePreset } from '../optionPresets.js';
import { parseJson } from '../../formats/json/parseJson.js';
import { mergeJson } from '../../formats/json/mergeJson.js';

vi.mock('../../console/logger.js');
vi.mock('../../console/logging.js');

type NavEntry = {
  language: string;
  groups: { group: string; root: string; pages: string[] }[];
  navbar: { links: { label: string; href: string }[] };
  footer: {
    links: { header: string; items: { label: string; href: string }[] }[];
  };
};

const docsJson = (pathPrefix: string) =>
  JSON.stringify({
    navigation: {
      languages: [
        {
          language: 'en',
          groups: [
            {
              group: 'Getting started',
              root: `${pathPrefix}intro`,
              pages: [`${pathPrefix}quickstart`],
            },
          ],
          navbar: {
            links: [{ label: 'Support', href: 'https://example.com/support' }],
          },
          footer: {
            links: [
              {
                header: 'Developers',
                items: [{ label: 'Blog', href: 'https://example.com/blog' }],
              },
            ],
          },
        },
      ],
    },
  });

const presets = [
  { preset: 'mintlify', sourcePrefix: 'en/', targetPrefix: 'fr/' },
  { preset: 'mintlify-hide-default', sourcePrefix: '', targetPrefix: 'fr/' },
] as const;

describe.each(presets)(
  'generatePreset($preset)',
  ({ preset, sourcePrefix, targetPrefix }) => {
    const options = {
      jsonSchema: { '**/*.json': generatePreset(preset, 'json') },
    };

    it('extracts footer and navbar text for translation', () => {
      const parsed = JSON.parse(
        parseJson(docsJson(sourcePrefix), 'docs.json', options, 'en')
      );
      const values = Object.values(parsed['/navigation/languages']['/0']);

      expect(values).toEqual(
        expect.arrayContaining([
          'Getting started',
          'Support',
          'Developers',
          'Blog',
        ])
      );
    });

    it('writes translated footer and navbar text and localizes group roots', () => {
      const source = docsJson(sourcePrefix);
      const parsed = JSON.parse(parseJson(source, 'docs.json', options, 'en'));
      const translated = Object.fromEntries(
        Object.entries(parsed['/navigation/languages']['/0']).map(
          ([key, value]) => [key, `fr:${value}`]
        )
      );

      const [merged] = mergeJson(
        source,
        'docs.json',
        options,
        [
          {
            translatedContent: JSON.stringify({
              '/navigation/languages': { '/0': translated },
            }),
            targetLocale: 'fr',
          },
        ],
        'en'
      );
      const fr = (JSON.parse(merged).navigation.languages as NavEntry[]).find(
        (entry) => entry.language === 'fr'
      );

      expect(fr?.navbar.links[0].label).toBe('fr:Support');
      expect(fr?.footer.links[0].header).toBe('fr:Developers');
      expect(fr?.footer.links[0].items[0].label).toBe('fr:Blog');
      expect(fr?.footer.links[0].items[0].href).toBe(
        'https://example.com/blog'
      );
      expect(fr?.groups[0].root).toBe(`${targetPrefix}intro`);
      expect(fr?.groups[0].pages[0]).toBe(`${targetPrefix}quickstart`);
    });
  }
);
