import { afterEach, describe, expect, it } from 'vitest';
import { hashSource } from 'generaltranslation/id';
import { extractFromVueProject } from '../../project.js';
import {
  createProjectFixture,
  linkInstalledVue,
  removeProjectFixture,
} from './projectTestUtils.js';
import { extractFromVueSource } from './testVueCompiler.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    removeProjectFixture(directory);
  }
});

describe('Vue T metadata extraction', () => {
  it('extracts canonical, sugar, and idiomatic template metadata props', async () => {
    const output = await extractTemplate(`
      <T context="card" id="hero" :max-chars="-12" requires-review>
        Primary
      </T>
      <T :$context="'alias'" :$id="'alias-id'" :$maxChars="0" :$requiresReview="false">
        Alias
      </T>
    `);

    expect(output.errors).toEqual([]);
    expect(output.results).toHaveLength(2);
    expect(output.results[0]?.metadata).toMatchObject({
      context: 'card',
      id: 'hero',
      maxChars: 12,
      requiresReview: true,
    });
    expect(output.results[1]?.metadata).toMatchObject({
      context: 'alias',
      id: 'alias-id',
      maxChars: 0,
      requiresReview: false,
    });
  });

  it('extracts canonical and sugar JSX metadata props', async () => {
    const output = await extractJsx(`
      const translationContext = 'card';
      const translationId = 'hero';
      const limit = -9;
      export const View = () => <>
        <T context={translationContext} $id={translationId} maxChars={limit} requiresReview>
          Primary
        </T>
        <T $context="alias" id="alias-id" $maxChars={0} $requiresReview={false}>
          Alias
        </T>
      </>;
    `);

    expect(output.errors).toEqual([]);
    expect(output.results).toHaveLength(2);
    expect(output.results[0]?.metadata).toMatchObject({
      context: 'card',
      id: 'hero',
      maxChars: 9,
      requiresReview: true,
    });
    expect(output.results[1]?.metadata).toMatchObject({
      context: 'alias',
      id: 'alias-id',
      maxChars: 0,
      requiresReview: false,
    });
  });

  it.each([
    ['context', 'context="first" :$context="\'second\'"'],
    ['id', 'id="first" :$id="\'second\'"'],
    ['maxChars', ':maxChars="1" :max-chars="2"'],
    ['requiresReview', 'requiresReview :requires-review="false"'],
  ])(
    'rejects duplicate template %s aliases',
    async (metadataKey, attributes) => {
      const output = await extractTemplate(`<T ${attributes}>Duplicate</T>`);

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain(
        `duplicate ${metadataKey} props`
      );
    }
  );

  it.each([
    ['context', 'context="first" $context="second"'],
    ['id', 'id="first" $id="second"'],
    ['maxChars', 'maxChars={1} $maxChars={2}'],
    ['requiresReview', 'requiresReview $requiresReview={false}'],
  ])('rejects duplicate JSX %s aliases', async (metadataKey, attributes) => {
    const output = await extractJsx(
      `export const View = () => <T ${attributes}>Duplicate</T>;`
    );

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      `duplicate ${metadataKey} props`
    );
  });

  it.each([
    ['dynamic id', ':id="dynamicId"', 'invalid or dynamic id'],
    ['string maxChars', 'max-chars="10"', 'invalid or dynamic maxChars'],
    ['fractional maxChars', ':max-chars="1.5"', 'invalid or dynamic maxChars'],
    ['NaN maxChars', ':max-chars="NaN"', 'invalid or dynamic maxChars'],
    [
      'string requiresReview',
      'requires-review="false"',
      'invalid or dynamic requiresReview',
    ],
    [
      'dynamic requiresReview',
      ':requires-review="dynamicReview"',
      'invalid or dynamic requiresReview',
    ],
  ])(
    'fails closed on template $name',
    async (_name, attributes, diagnostic) => {
      const output = await extractTemplate(
        `<T ${attributes}>Invalid</T>`,
        `const dynamicId = String(Date.now()); const dynamicReview = Boolean(Date.now());`
      );

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain(diagnostic);
    }
  );

  it.each([
    ['dynamic id', 'id={dynamicId}', 'invalid or dynamic id'],
    ['string maxChars', 'maxChars="10"', 'invalid or dynamic maxChars'],
    ['fractional maxChars', 'maxChars={1.5}', 'invalid or dynamic maxChars'],
    [
      'string requiresReview',
      'requiresReview="false"',
      'invalid or dynamic requiresReview',
    ],
    [
      'dynamic requiresReview',
      'requiresReview={dynamicReview}',
      'invalid or dynamic requiresReview',
    ],
  ])('fails closed on JSX $name', async (_name, attributes, diagnostic) => {
    const output = await extractJsx(`
      const dynamicId = String(Date.now());
      const dynamicReview = Boolean(Date.now());
      export const View = () => <T ${attributes}>Invalid</T>;
    `);

    expect(output.results).toEqual([]);
    expect(output.errors.join('\n')).toContain(diagnostic);
  });

  it.each(['Num', 'Currency', 'DateTime'])(
    'rejects named template <%s> variables until named variables are supported',
    async (component) => {
      const output = await extractTemplate(
        `<T>Value: <${component} name="named" :value="value" /></T>`,
        'const value = 1;',
        `T, ${component}`
      );

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain(
        `unsupported name prop on a gt-vue <${component}>`
      );
    }
  );

  it.each(['Num', 'Currency', 'DateTime'])(
    'rejects named JSX <%s> variables until named variables are supported',
    async (component) => {
      const output = await extractJsx(
        `export const View = () => <T>Value: <${component} name="named" value={1} /></T>;`,
        `T, ${component}`
      );

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain(
        `unsupported name prop on a gt-vue <${component}>`
      );
    }
  );

  it('hashes maxChars and review while keeping id metadata-only', async () => {
    const root = createProjectFixture({
      'package.json': JSON.stringify({
        dependencies: { 'gt-vue': '1.0.0', vue: '3.5.0' },
      }),
      'src/App.vue': `
        <script setup>
        import { T } from 'gt-vue';
        </script>
        <template>
          <T context="catalog" id="legacy" :max-chars="-12" requires-review>Review metadata</T>
          <T :max-chars="0">Zero metadata</T>
          <T :requires-review="false">False review</T>
        </template>
      `,
    });
    temporaryDirectories.push(root);
    linkInstalledVue(root);

    const output = await extractFromVueProject({ cwd: root });

    expect(output.errors).toEqual([]);
    expect(output.updates).toHaveLength(3);
    const review = output.updates.find(
      ({ source }) => source === 'Review metadata'
    );
    expect(review?.metadata).toMatchObject({
      context: 'catalog',
      id: 'legacy',
      maxChars: 12,
      requiresReview: true,
      hash: hashSource({
        source: 'Review metadata',
        context: 'catalog',
        maxChars: 12,
        requiresReview: true,
        dataFormat: 'JSX',
      }),
    });
    expect(review?.metadata.hash).not.toBe(
      hashSource({
        source: 'Review metadata',
        context: 'catalog',
        id: 'legacy',
        maxChars: 12,
        requiresReview: true,
        dataFormat: 'JSX',
      })
    );

    const zero = output.updates.find(
      ({ source }) => source === 'Zero metadata'
    );
    expect(zero?.metadata.maxChars).toBe(0);
    expect(zero?.metadata.hash).toBe(
      hashSource({
        source: 'Zero metadata',
        maxChars: 0,
        dataFormat: 'JSX',
      })
    );

    const falseReview = output.updates.find(
      ({ source }) => source === 'False review'
    );
    expect(falseReview?.metadata.requiresReview).toBe(false);
    expect(falseReview?.metadata.hash).toBe(
      hashSource({ source: 'False review', dataFormat: 'JSX' })
    );
  });
});

async function extractTemplate(template: string, setup = '', imports = 'T') {
  return extractFromVueSource(
    `<script setup>
      import { ${imports} } from 'gt-vue';
      ${setup}
    </script>
    <template>${template}</template>`,
    '/project/src/App.vue',
    { projectRoot: '/project' }
  );
}

async function extractJsx(source: string, imports = 'T') {
  return extractFromVueSource(
    `import { ${imports} } from 'gt-vue'; ${source}`,
    '/project/src/View.tsx',
    { projectRoot: '/project' }
  );
}
