// @vitest-environment jsdom

import { Schema } from '@sanity/schema';
import { PortableTextHtmlComponents } from '@portabletext/to-html';
import merge from 'lodash.merge';
import { PortableTextBlock, SanityDocument } from 'sanity';
import { describe, expect, test, vi } from 'vitest';
import { attachGTData, detachGTData } from '../data';
import { BaseDocumentDeserializer } from '../deserialize/BaseDocumentDeserializer';
import { BaseDocumentSerializer } from '../serialize/index';
import {
  fieldFilter,
  isFieldExcludedByOptions,
} from '../serialize/fieldFilters';
import {
  customSerializers,
  defaultStopTypes,
} from '../BaseSerializationConfig';
import {
  addedCustomSerializers,
  annotationAndInlineBlocks,
  createCustomInnerHTML,
  docWithInlineMarks,
  documentLevelArticle,
  findByClass,
  getHTMLNode,
  getSerialized,
  getValidFields,
  inlineDocumentLevelArticle,
  inlineSchema,
  schema,
  toPlainText,
  type ArticleFields,
} from './helpers';

const classNames = (element: Element) =>
  Array.from(element.children)
    .map((child) => child.className)
    .sort();

const objectInArray = (content: ArticleFields['content']) =>
  content.find((block) => block._type === 'objectField')!;

const levels = [
  {
    level: 'document' as const,
    article: documentLevelArticle as SanityDocument,
    fields: documentLevelArticle as unknown as ArticleFields,
    fieldElement: (docTree: Element, name: string) =>
      findByClass(docTree.children, name),
  },
];

for (const { level, article, fields, fieldElement } of levels) {
  describe(`${level}-level serialization`, () => {
    const serialized = getSerialized(article);
    const docTree = getHTMLNode(serialized).body.children[0];
    const objectField = findByClass(
      fieldElement(docTree, 'config')!.children,
      'objectField'
    )!;
    const nestedObject = findByClass(objectField.children, 'objectAsField')!
      .children[0];
    const arrayField = fieldElement(docTree, 'content')!;

    test('matches the snapshot', () => {
      expect(serialized).toMatchSnapshot();
    });

    test('serializes top-level string and text fields', () => {
      expect(fieldElement(docTree, 'title')?.innerHTML).toEqual(fields.title);
      expect(fieldElement(docTree, 'snippet')?.innerHTML).toEqual(
        fields.snippet
      );
    });

    test('objects contain all serializable fields, at any depth', () => {
      expect(classNames(objectField)).toEqual(
        getValidFields(fields.config).sort()
      );
      expect(classNames(nestedObject)).toEqual(
        getValidFields(fields.config.objectAsField).sort()
      );
    });

    test('objects contain accurate values, at any depth', () => {
      expect(objectField.innerHTML).toContain(fields.config.title);
      expect(objectField.innerHTML).toContain(
        toPlainText(fields.config.nestedArrayField)
      );
      expect(nestedObject.innerHTML).toContain(
        fields.config.objectAsField.title
      );
      expect(nestedObject.innerHTML).toContain(
        toPlainText(fields.config.objectAsField.content)
      );
    });

    test('arrays contain all serializable blocks with keys, in order', () => {
      expect(Array.from(arrayField.children).map((block) => block.id)).toEqual(
        fields.content.map((block) => block._key)
      );
    });

    test('arrays contain top-level block text', () => {
      const blockStrings = toPlainText(fields.content).trim().split('\n\n');
      blockStrings.forEach((substring) =>
        expect(arrayField.innerHTML).toContain(substring)
      );
    });

    test('objects in arrays contain all serializable fields and accurate nested values', () => {
      const original = objectInArray(fields.content);
      const serializedObject = findByClass(arrayField.children, 'objectField')!;
      expect(classNames(serializedObject)).toEqual(
        getValidFields(original).sort()
      );

      const nested = findByClass(serializedObject.children, 'objectAsField');
      expect(nested?.innerHTML).toContain(original.objectAsField.title);
      expect(nested?.innerHTML).toContain(
        toPlainText(original.objectAsField.content).trim()
      );
    });
  });
}

describe('document with inline marks', () => {
  // The fixture's `linkField` marks have no serializer; to-html warns for each.
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const serialized = BaseDocumentSerializer(schema).serializeDocument(
    docWithInlineMarks,
    defaultStopTypes,
    merge({}, customSerializers, {
      marks: {
        link: ({ value, children }) =>
          attachGTData(`<a>${children}</a>`, value, 'markDef'),
        inlineMath: ({ value, children }) =>
          attachGTData(`<span>${children}</span>`, value, 'markDef'),
      },
    } satisfies Partial<PortableTextHtmlComponents>)
  );
  warn.mockRestore();

  test('serializes to the snapshot', () => {
    expect(serialized).toMatchSnapshot();
  });

  test('deserializes to the snapshot', () => {
    expect(
      BaseDocumentDeserializer.deserializeDocument(serialized.content)
    ).toMatchSnapshot();
  });

  test('serializes top-level string and text fields', () => {
    const docTree = getHTMLNode(serialized).body.children[0];
    expect(findByClass(docTree.children, 'title')?.innerHTML).toEqual(
      docWithInlineMarks.title
    );
    expect(findByClass(docTree.children, 'snippet')?.innerHTML).toEqual(
      docWithInlineMarks.snippet
    );
  });
});

describe('document-level article', () => {
  const serialized = getSerialized(documentLevelArticle);
  const html = getHTMLNode(serialized);
  const docTree = html.body.children[0];
  const arrayField = findByClass(docTree.children, 'content')!;

  test.each([
    ['_id', documentLevelArticle._id],
    ['_rev', documentLevelArticle._rev],
    ['_type', documentLevelArticle._type],
    ['version', '3'],
  ])('has the %s metadata field', (name, content) => {
    const metaTag = Array.from(html.head.children).find(
      (tag) => tag.getAttribute('name') === name
    );
    expect(metaTag?.getAttribute('content')).toEqual(content);
  });

  test('Fields marked "localize: false" should not be serialized', () => {
    //"meta" is localize: false field
    expect(documentLevelArticle.meta).toBeDefined();
    expect(findByClass(docTree.children, 'meta')).toBeUndefined();
  });

  test('Expect default stop types to be absent', () => {
    //"hidden" is boolean field
    expect(documentLevelArticle.hidden).toBeDefined();
    expect(findByClass(docTree.children, 'hidden')).toBeUndefined();
  });

  test('Serialized content should preserve style tags from Portable Text', () => {
    const blockH1 = documentLevelArticle.content.find(
      (block: PortableTextBlock) => block.style === 'h1'
    )!;
    const blockH2 = documentLevelArticle.content.find(
      (block: PortableTextBlock) => block.style === 'h2'
    )!;
    expect(arrayField.querySelector('h1')?.innerHTML).toEqual(
      blockH1.children![0]!.text
    );
    expect(arrayField.querySelector('h2')?.innerHTML).toEqual(
      blockH2.children![0]!.text
    );
  });

  test('Serialized content should preserve list style and depth from Portable text', () => {
    const listItem = documentLevelArticle.content.find(
      (block: PortableTextBlock) =>
        block.listItem === 'bullet' && block.style === 'h2'
    );
    const nestedListItem = documentLevelArticle.content.find(
      (block: PortableTextBlock) =>
        block.listItem === 'bullet' && block.level === 2
    )!;
    const serializedListItem = arrayField.querySelectorAll('li')[2];
    const serializedNestedListItem = arrayField.querySelectorAll('li')[1];

    expect(serializedListItem?.innerHTML).toContain(
      listItem!.children![0]!.text
    );
    expect(serializedListItem?.innerHTML).toContain('h2');
    expect(serializedNestedListItem?.innerHTML).toEqual(
      nestedListItem.children![0]!.text
    );
  });

  test('Values in a field are not repeated (indicating serializers are stateless)', () => {
    const tags = Array.from(findByClass(docTree.children, 'tags')!.children);
    expect(tags.map((tag) => tag.innerHTML)).toEqual(documentLevelArticle.tags);
  });
});

/*
 * CUSTOM SETTINGS
 */
describe('custom serializers and stop types', () => {
  const inlineDocument = {
    ...documentLevelArticle,
    ...annotationAndInlineBlocks,
  };
  const serializeWith = (
    document: SanityDocument,
    stopTypes: string[],
    serializers: Partial<PortableTextHtmlComponents>
  ) =>
    getHTMLNode(
      BaseDocumentSerializer(schema).serializeDocument(
        document,
        stopTypes,
        serializers
      )
    ).body.children[0];

  test('Custom serialization should manifest at all levels', () => {
    const docTree = serializeWith(
      documentLevelArticle,
      defaultStopTypes,
      addedCustomSerializers
    );

    const topLevelCustomSerialized = findByClass(docTree.children, 'config');
    expect(topLevelCustomSerialized?.innerHTML).toContain(
      createCustomInnerHTML(documentLevelArticle.config.title)
    );

    const arrayField = findByClass(docTree.children, 'content');
    const nestedSerialized = findByClass(arrayField!.children, 'objectField');
    const requiredNestedTitle = documentLevelArticle.content.find(
      (b: Record<string, unknown>) => b._type === 'objectField'
    )!.title!;
    expect(nestedSerialized?.innerHTML).toContain(
      createCustomInnerHTML(requiredNestedTitle)
    );
  });

  test('Expect custom stop types to be absent at all levels', () => {
    const docTree = serializeWith(
      documentLevelArticle,
      [...defaultStopTypes, 'objectField'],
      customSerializers
    );

    expect(documentLevelArticle.config).toBeDefined();
    expect(findByClass(docTree.children, 'config')).toBeUndefined();

    const arrayField = findByClass(docTree.children, 'content');
    const nestedObjField = documentLevelArticle.content.find(
      (b: Record<string, unknown>) => b._type === 'objectField'
    );
    expect(nestedObjField).toBeDefined();
    expect(findByClass(arrayField!.children, 'objectField')).toBeUndefined();
  });

  test('Unhandled inline objects and annotations should not hinder translation flows', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const serialized = getSerialized(inlineDocument);
    const docTree = getHTMLNode(serialized).body.children[0];
    const arrayField = findByClass(docTree.children, 'content');

    //expect annotated object to have underlying text and carry its markDef
    const blockWithAnnotation = Array.from(arrayField!.children).find(
      (node) => node.id === '0e55995095df'
    );
    const unhandledAnnotation = blockWithAnnotation!.querySelector(
      'span[data-gt-internal]'
    );
    expect(unhandledAnnotation?.innerHTML).toContain('text');
    expect(
      detachGTData(unhandledAnnotation!.outerHTML).data?.markDef
    ).toMatchObject({ _key: '2f5ec56ab061', _type: 'annotation' });

    //expect unknown inline object to stay inline in its block, with no
    //translatable text and carrying its data (merged back safely, but not sent
    //to translation)
    const inlineObject = arrayField!.querySelector('p > .childObjectField');
    expect(inlineObject?.tagName.toLowerCase()).toEqual('span');
    expect(inlineObject?.textContent).toEqual('\u200B');
    expect(
      detachGTData(inlineObject!.outerHTML).data?.inlineObject
    ).toMatchObject({ _type: 'childObjectField' });
  });

  test('Handled inline objects and annotations should be accurately represented per serializer', () => {
    const docTree = serializeWith(
      inlineDocument,
      defaultStopTypes,
      addedCustomSerializers
    );
    const blocks = Array.from(
      findByClass(docTree.children, 'content')!.children
    );
    const spans = inlineDocument.content.flatMap(
      (block: PortableTextBlock) =>
        (Array.isArray(block.children) ? block.children : []) as Record<
          string,
          unknown
        >[]
    );

    const inlineObject = blocks
      .map((block) => findByClass(block.children, 'childObjectField'))
      .find(Boolean);
    const inlineObjectSpan = spans.findLast(
      (span) => span._type === 'childObjectField'
    )!;
    expect(inlineObject!.innerHTML).toContain(
      createCustomInnerHTML(inlineObjectSpan.title as string)
    );

    const annotation = blocks
      .map((block) => findByClass(block.children, 'annotation'))
      .find(Boolean);
    const annotatedSpan = spans.findLast(
      (span) => Array.isArray(span.marks) && span.marks.length > 0
    )!;
    expect(annotation!.innerHTML).toEqual(annotatedSpan.text);
  });
});

/*
 * V2 functionality -- be able to operate without a strict schema
 */
test('Content with anonymous inline objects serializes all fields, at any depth', () => {
  const serialized = BaseDocumentSerializer(inlineSchema).serializeDocument(
    inlineDocumentLevelArticle
  );
  const docTree = getHTMLNode(serialized).body.children[0];
  const tabs = findByClass(docTree.children, 'tabs')!.children[0];
  const config = findByClass(tabs!.children, 'config')!.children[0];
  expect(classNames(config)).toEqual(
    getValidFields(inlineDocumentLevelArticle.tabs.config).sort()
  );
  const nestedObjHTML = findByClass(config!.children, 'objectAsField')!
    .children[0];
  expect(classNames(nestedObjHTML)).toEqual(
    getValidFields(inlineDocumentLevelArticle.tabs.config.objectAsField).sort()
  );

  const content = findByClass(tabs!.children, 'content')!;
  const keysHTML = Array.from(content.children).map((child) => child.id);
  const keysJSON = inlineDocumentLevelArticle.tabs.content.map(
    (child: { _key: string }) => child._key
  );
  expect(keysHTML.sort()).toEqual(keysJSON.sort());

  const objectInArrayHTML = findByClass(content.children, 'objectField')!;
  const objectInArrayJSON = inlineDocumentLevelArticle.tabs.content.find(
    (obj: { _type?: string }) => obj._type === 'objectField'
  )!;
  expect(classNames(objectInArrayHTML)).toEqual(
    getValidFields(objectInArrayJSON).sort()
  );
});

/*
 * SCHEMA OPTIONS EXCLUSION
 */
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

describe('schema options exclusion', () => {
  const excluded = { options: { gt: { exclude: true } } };

  const articleType = {
    name: 'optionsArticle',
    title: 'Options Article',
    type: 'document',
    fields: [
      { name: 'title', title: 'Title', type: 'string' },
      { name: 'legal', title: 'Legal', type: 'legalBoilerplate' },
      { name: 'gtExcluded', title: 'GT Excluded', type: 'string', ...excluded },
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
      { name: 'legalViaAlias', title: 'Legal Via Alias', type: 'legalAlias' },
      {
        name: 'legalList',
        title: 'Legal List',
        type: 'array',
        of: [{ type: 'legalAlias' }],
      },
      // Anonymous inline object: exclusion inside declared fields must apply
      // even though the runtime value carries no `_type`.
      {
        name: 'meta',
        title: 'Meta',
        type: 'object',
        fields: [
          { name: 'metaHeading', title: 'Meta Heading', type: 'string' },
          {
            name: 'inlineSecret',
            title: 'Inline Secret',
            type: 'string',
            ...excluded,
          },
        ],
      },
    ],
  };

  const optionsSchema: InstanceType<typeof Schema> = new Schema({
    name: 'test',
    types: [
      {
        name: 'seoBlock',
        title: 'SEO Block',
        type: 'object',
        fields: [
          { name: 'heading', title: 'Heading', type: 'string' },
          {
            name: 'trackingId',
            title: 'Tracking ID',
            type: 'string',
            ...excluded,
          },
        ],
      },
      // Excluded at the type level ("field or type" in the native plugins).
      {
        name: 'legalBoilerplate',
        title: 'Legal Boilerplate',
        type: 'object',
        ...excluded,
        fields: [{ name: 'text', title: 'Text', type: 'string' }],
      },
      // Primitive and array aliases carry no runtime `_type`, so their
      // exclusion must be resolved from the schema rather than from the
      // serialized value.
      {
        name: 'excludedString',
        title: 'Excluded String',
        type: 'string',
        ...excluded,
      },
      {
        name: 'excludedTags',
        title: 'Excluded Tags',
        type: 'array',
        of: [{ type: 'string' }],
        ...excluded,
      },
      // Alias of an excluded alias: exclusion applies through the chain.
      {
        name: 'excludedStringAlias',
        title: 'Excluded String Alias',
        type: 'excludedString',
      },
      // Alias of an excluded object type: runtime values carry the alias
      // `_type`.
      { name: 'legalAlias', title: 'Legal Alias', type: 'legalBoilerplate' },
      // Control: an alias without exclusion options stays translatable.
      { name: 'includedString', title: 'Included String', type: 'string' },
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
    legalViaAlias: {
      _type: 'legalAlias',
      text: 'object-alias-excluded-value',
    },
    legalList: [
      {
        _key: 'legal-item-1',
        _type: 'legalAlias',
        text: 'object-alias-in-array-excluded-value',
      },
    ],
    meta: {
      metaHeading: 'inline-object-heading',
      inlineSecret: 'inline-object-excluded-value',
    },
  } as unknown as SanityDocument;

  const serialized =
    BaseDocumentSerializer(optionsSchema).serializeDocument(doc);
  const docTree = getHTMLNode(serialized).body.children[0];

  test.each([
    ['plain fields', 'Translate me'],
    ['fields with options.gt.exclude: false', 'not-excluded-value'],
    ['siblings of an excluded field in an object type', 'SEO heading'],
    [
      'fields of alias types without exclusion options',
      'string-alias-included-value',
    ],
    [
      'siblings of an excluded field in an anonymous inline object',
      'inline-object-heading',
    ],
  ])('keeps %s', (_, value) => {
    expect(serialized.content).toContain(value);
  });

  test.each([
    ['options.gt.exclude fields', 'gt-excluded-value', 'gtExcluded'],
    [
      'options.documentInternationalization.exclude fields',
      'doc-i18n-excluded-value',
      'docI18nExcluded',
    ],
    [
      'options.aiAssist.exclude fields',
      'ai-assist-excluded-value',
      'aiAssistExcluded',
    ],
    ['fields nested inside object types', 'UA-12345'],
    [
      'whole types marked in the type definition options',
      'all-rights-reserved-text',
    ],
    [
      'fields whose string alias type is marked in options',
      'string-alias-excluded-value',
      'secret',
    ],
    [
      'fields whose array alias type is marked in options',
      'array-alias-excluded-value',
      'tags',
    ],
    [
      'fields through a chain of type aliases',
      'alias-chain-excluded-value',
      'aliasedSecret',
    ],
    [
      'object alias fields of an excluded object type',
      'object-alias-excluded-value',
    ],
    [
      'object alias array members of an excluded object type',
      'object-alias-in-array-excluded-value',
    ],
    [
      'fields nested inside anonymous inline objects',
      'inline-object-excluded-value',
    ],
  ])('excludes %s', (_, value, fieldName?: string) => {
    expect(serialized.content).not.toContain(value);
    if (fieldName) {
      expect(findByClass(docTree.children, fieldName)).toBeUndefined();
    }
  });

  test('fieldFilter drops fields excluded via options while keeping siblings', () => {
    const filtered = fieldFilter(
      { _type: 'optionsArticle', title: 'Hi', gtExcluded: 'secret' },
      articleType.fields as never,
      []
    );
    expect(filtered.title).toBe('Hi');
    expect(filtered.gtExcluded).toBeUndefined();
  });
});
