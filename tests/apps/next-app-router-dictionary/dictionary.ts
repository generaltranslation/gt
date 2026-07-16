export const dictionary = {
  page: {
    eyebrow: 'Next.js App Router',
    title: 'gt-next dictionary test',
    intro: [
      'This server component reads from dictionary.ts and interpolates a render timestamp: {renderedAt}.',
      {
        $context:
          'Explains that the Next.js App Router test fixture uses General Translation dictionaries.',
      },
    ],
  },
  server: {
    eyebrow: 'Server component',
    title: 'Dictionary access from getTranslations',
    body: 'This section is rendered in a React Server Component using gt-next/server.',
    checks: {
      source: 'Source dictionary bundled from dictionary.ts',
      target: 'Target dictionaries loaded through loadDictionary.ts',
      object: 'Nested dictionary object resolved with t.obj()',
    },
  },
  client: {
    eyebrow: 'Client component',
    title: 'Dictionary access from useTranslations',
    greeting: ['Hello {name}, this came from a client dictionary lookup.', {}],
    features: {
      locale: 'Locale changes should update client dictionary entries.',
      provider: 'GTProvider supplies the dictionary snapshot to the browser.',
      interpolation: 'Variables are interpolated from the lookup options.',
    },
  },
};

export default dictionary;
