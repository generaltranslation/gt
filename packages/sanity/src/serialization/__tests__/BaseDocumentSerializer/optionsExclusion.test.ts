import { Schema } from '@sanity/schema';
import { SanityDocument } from 'sanity';
import { describe, expect, test } from 'vitest';
import { BaseDocumentSerializer } from '../../serialize/index';
import {
  fieldFilter,
  isFieldExcludedByOptions,
} from '../../serialize/fieldFilters';
import { findByClass, getHTMLNode } from './utils';

const nestedObjectType = {
  name: 'seoBlock',
  title: 'SEO Block',
  type: 'object',
  fields: [
    { name: 'heading', title: 'Heading', type: 'string' },
    {
      name: 'trackingId',
      title: 'Tracking ID',
      type: 'string',
      options: { gt: { exclude: true } },
    },
  ],
};

// Excluded at the type level ("field or type" in the native plugins).
const excludedObjectType = {
  name: 'legalBoilerplate',
  title: 'Legal Boilerplate',
  type: 'object',
  options: { gt: { exclude: true } },
  fields: [{ name: 'text', title: 'Text', type: 'string' }],
};

// Primitive and array aliases carry no runtime `_type`, so their exclusion
// must be resolved from the schema rather than from the serialized value.
const excludedStringType = {
  name: 'excludedString',
  title: 'Excluded String',
  type: 'string',
  options: { gt: { exclude: true } },
};

const excludedArrayType = {
  name: 'excludedTags',
  title: 'Excluded Tags',
  type: 'array',
  of: [{ type: 'string' }],
  options: { gt: { exclude: true } },
};

// Alias of an excluded alias: exclusion applies through the chain.
const excludedStringAliasType = {
  name: 'excludedStringAlias',
  title: 'Excluded String Alias',
  type: 'excludedString',
};

// Control: an alias without exclusion options stays translatable.
const includedStringType = {
  name: 'includedString',
  title: 'Included String',
  type: 'string',
};

const articleType = {
  name: 'optionsArticle',
  title: 'Options Article',
  type: 'document',
  fields: [
    { name: 'title', title: 'Title', type: 'string' },
    { name: 'legal', title: 'Legal', type: 'legalBoilerplate' },
    {
      name: 'gtExcluded',
      title: 'GT Excluded',
      type: 'string',
      options: { gt: { exclude: true } },
    },
    {
      name: 'docI18nExcluded',
      title: 'Doc I18n Excluded',
      type: 'string',
      options: { documentInternationalization: { exclude: true } },
    },
    {
      name: 'aiAssistExcluded',
      title: 'AI Assist Excluded',
      type: 'string',
      options: { aiAssist: { exclude: true } },
    },
    {
      name: 'notExcluded',
      title: 'Not Excluded',
      type: 'string',
      options: { gt: { exclude: false } },
    },
    { name: 'seo', title: 'SEO', type: 'seoBlock' },
    { name: 'secret', title: 'Secret', type: 'excludedString' },
    { name: 'tags', title: 'Tags', type: 'excludedTags' },
    {
      name: 'aliasedSecret',
      title: 'Aliased Secret',
      type: 'excludedStringAlias',
    },
    { name: 'subtitle', title: 'Subtitle', type: 'includedString' },
  ],
};

const schema: InstanceType<typeof Schema> = new Schema({
  name: 'test',
  types: [
    nestedObjectType,
    excludedObjectType,
    excludedStringType,
    excludedArrayType,
    excludedStringAliasType,
    includedStringType,
    articleType,
  ],
});

const doc = {
  _id: 'options-article-1',
  _type: 'optionsArticle',
  _rev: 'rev-1',
  title: 'Translate me',
  gtExcluded: 'gt-excluded-value',
  docI18nExcluded: 'doc-i18n-excluded-value',
  aiAssistExcluded: 'ai-assist-excluded-value',
  notExcluded: 'not-excluded-value',
  seo: {
    _type: 'seoBlock',
    heading: 'SEO heading',
    trackingId: 'UA-12345',
  },
  legal: {
    _type: 'legalBoilerplate',
    text: 'all-rights-reserved-text',
  },
  secret: 'string-alias-excluded-value',
  tags: ['array-alias-excluded-value'],
  aliasedSecret: 'alias-chain-excluded-value',
  subtitle: 'string-alias-included-value',
} as unknown as SanityDocument;

describe('isFieldExcludedByOptions', () => {
  test('recognizes each supported exclusion namespace', () => {
    expect(isFieldExcludedByOptions({ gt: { exclude: true } })).toBe(true);
    expect(
      isFieldExcludedByOptions({
        documentInternationalization: { exclude: true },
      })
    ).toBe(true);
    expect(isFieldExcludedByOptions({ aiAssist: { exclude: true } })).toBe(
      true
    );
  });

  test('ignores falsy, missing, and unrelated options', () => {
    expect(isFieldExcludedByOptions(undefined)).toBe(false);
    expect(isFieldExcludedByOptions({})).toBe(false);
    expect(isFieldExcludedByOptions({ gt: { exclude: false } })).toBe(false);
    expect(isFieldExcludedByOptions({ layout: 'radio' })).toBe(false);
  });
});

describe('serialization honors schema options exclusion', () => {
  const serialized = BaseDocumentSerializer(schema).serializeDocument(
    doc,
    'document'
  );
  const docTree = getHTMLNode(serialized).body.children[0];

  test('keeps translatable fields', () => {
    expect(serialized.content).toContain('Translate me');
    expect(serialized.content).toContain('not-excluded-value');
  });

  test('excludes options.gt.exclude fields', () => {
    expect(findByClass(docTree.children, 'gtExcluded')).toBeUndefined();
    expect(serialized.content).not.toContain('gt-excluded-value');
  });

  test('excludes options.documentInternationalization.exclude fields', () => {
    expect(findByClass(docTree.children, 'docI18nExcluded')).toBeUndefined();
    expect(serialized.content).not.toContain('doc-i18n-excluded-value');
  });

  test('excludes options.aiAssist.exclude fields', () => {
    expect(findByClass(docTree.children, 'aiAssistExcluded')).toBeUndefined();
    expect(serialized.content).not.toContain('ai-assist-excluded-value');
  });

  test('excludes fields nested inside object types', () => {
    expect(serialized.content).toContain('SEO heading');
    expect(serialized.content).not.toContain('UA-12345');
  });

  test('excludes whole types marked in the type definition options', () => {
    expect(serialized.content).not.toContain('all-rights-reserved-text');
  });

  test('excludes fields whose string alias type is marked in options', () => {
    expect(findByClass(docTree.children, 'secret')).toBeUndefined();
    expect(serialized.content).not.toContain('string-alias-excluded-value');
  });

  test('excludes fields whose array alias type is marked in options', () => {
    expect(findByClass(docTree.children, 'tags')).toBeUndefined();
    expect(serialized.content).not.toContain('array-alias-excluded-value');
  });

  test('excludes fields through a chain of type aliases', () => {
    expect(findByClass(docTree.children, 'aliasedSecret')).toBeUndefined();
    expect(serialized.content).not.toContain('alias-chain-excluded-value');
  });

  test('keeps fields of alias types without exclusion options', () => {
    expect(serialized.content).toContain('string-alias-included-value');
  });
});

describe('fieldFilter unit behavior', () => {
  test('drops fields excluded via options while keeping siblings', () => {
    const filtered = fieldFilter(
      { _type: 'optionsArticle', title: 'Hi', gtExcluded: 'secret' },
      articleType.fields as never,
      []
    );
    expect(filtered.title).toBe('Hi');
    expect(filtered.gtExcluded).toBeUndefined();
  });
});
