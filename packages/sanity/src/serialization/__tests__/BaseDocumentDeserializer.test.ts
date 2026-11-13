// @vitest-environment jsdom

import { readFileSync } from 'fs';
import { PortableTextBlock } from 'sanity';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  BaseDocumentDeserializer,
  deserializeArray,
} from '../deserialize/BaseDocumentDeserializer';
import { BaseDocumentSerializer } from '../serialize/index';
import {
  customBlockDeserializers,
  defaultStopTypes,
} from '../BaseSerializationConfig';
import {
  addedBlockDeserializers,
  addedCustomDeserializers,
  addedCustomSerializers,
  annotationAndInlineBlocks,
  documentLevelArticle,
  fieldLevelArticle,
  getDeserialized,
  inlineDocumentLevelArticle,
  inlineSchema,
  schema,
  toPlainText,
  type ArticleFields,
} from './helpers';
import customStyles from './__fixtures__/customStyles.json';

const blockKeys = (blocks: Array<{ _key?: string }>) =>
  blocks.map((block) => block._key).sort();

const objectInArray = (content: ArticleFields['content']) =>
  content.find((block) => block._type === 'objectField')!;

/*
 * The same article at both translation levels. At field level every
 * translatable field is an object keyed by language.
 */
const levels = [
  {
    level: 'document' as const,
    article: documentLevelArticle,
    fieldsOf: (article: unknown) => article as ArticleFields,
  },
  {
    level: 'field' as const,
    article: fieldLevelArticle,
    fieldsOf: (article: unknown) => {
      const { title, snippet, config, content } =
        article as typeof fieldLevelArticle;
      return {
        title: title.en,
        snippet: snippet.en,
        config: config.en,
        content: content.en,
      } as unknown as ArticleFields;
    },
  },
];

for (const { level, article, fieldsOf } of levels) {
  describe(`${level}-level deserialization`, () => {
    const original = fieldsOf(article);
    let deserialized: typeof article;
    let fields: ArticleFields;

    // Deserialized inside each test, where the mocked block keys restart from
    // zero, so the snapshot stays the same whichever tests run.
    beforeEach(() => {
      deserialized = getDeserialized(article, level);
      fields = fieldsOf(deserialized);
    });

    test('matches the snapshot', () => {
      expect(deserialized).toMatchSnapshot();
    });

    test('deserializes top-level string and text fields', () => {
      expect(fields.title).toEqual(original.title);
      expect(fields.snippet).toEqual(original.snippet);
    });

    test('nested objects contain accurate values, at any depth', () => {
      expect(fields.config.title).toEqual(original.config.title);
      expect(blockKeys(fields.config.nestedArrayField)).toEqual(
        blockKeys(original.config.nestedArrayField)
      );
      expect(toPlainText(fields.config.nestedArrayField)).toEqual(
        toPlainText(original.config.nestedArrayField)
      );

      const nestedObject = fields.config.objectAsField;
      expect(nestedObject.title).toEqual(original.config.objectAsField.title);
      expect(blockKeys(nestedObject.content)).toEqual(
        blockKeys(original.config.objectAsField.content)
      );
      expect(toPlainText(nestedObject.content)).toEqual(
        toPlainText(original.config.objectAsField.content)
      );
    });

    test('arrays contain all serializable blocks with keys and their text', () => {
      expect(blockKeys(fields.content)).toEqual(blockKeys(original.content));
      expect(toPlainText(fields.content)).toEqual(
        toPlainText(original.content)
      );
    });

    test('objects in arrays contain accurate values in nested objects', () => {
      const originalObject = objectInArray(original.content).objectAsField;
      const deserializedObject = objectInArray(fields.content).objectAsField;
      expect(deserializedObject.title).toEqual(originalObject.title);
      expect(toPlainText(deserializedObject.content).trim()).toEqual(
        toPlainText(originalObject.content).trim()
      );
    });
  });
}

describe('document-level article', () => {
  const deserialized = getDeserialized(documentLevelArticle, 'document');

  test('contains the id, rev and type of the original document', () => {
    expect(deserialized._id).toEqual(documentLevelArticle._id);
    expect(deserialized._rev).toEqual(documentLevelArticle._rev);
    expect(deserialized._type).toEqual(documentLevelArticle._type);
  });

  /*
   * STYLE TAGS
   */
  test('Deserialized content should preserve style tags', () => {
    for (const style of ['h1', 'h2']) {
      const original = documentLevelArticle.content.find(
        (block: PortableTextBlock) => block.style === style
      )!;
      const result = deserialized.content.find(
        (block: PortableTextBlock) => block.style === style
      )!;
      expect(result).toBeDefined();
      expect(result._key).toEqual(original._key);
      expect(result.children![0]!.text).toEqual(original.children![0]!.text);
    }
  });

  /*
   * LIST ITEMS
   */
  test('Deserialized list items should preserve level, style and tag', () => {
    const isStyledListItem = (block: PortableTextBlock) =>
      block.listItem === 'bullet' && block.style === 'h2';
    const isNestedListItem = (block: PortableTextBlock) =>
      block.listItem === 'bullet' && block.level === 2;

    for (const isListItem of [isStyledListItem, isNestedListItem]) {
      const original = documentLevelArticle.content.find(isListItem)!;
      const result = deserialized.content.find(isListItem)!;
      expect(result).toBeDefined();
      expect(result._key).toEqual(original._key);
      expect(result.children![0]!.text).toEqual(original.children![0]!.text);
    }
  });
});

/*
 * CUSTOM SETTINGS
 */

test('Custom deserialization should manifest at all levels', () => {
  const serialized = BaseDocumentSerializer(schema).serializeDocument(
    documentLevelArticle,
    'document',
    'en',
    defaultStopTypes,
    addedCustomSerializers
  );

  const deserialized = BaseDocumentDeserializer.deserializeDocument<
    typeof documentLevelArticle
  >(serialized.content, addedCustomDeserializers, customBlockDeserializers);
  expect(deserialized.config.title).toEqual(documentLevelArticle.config.title);
  expect(deserialized.config._type).toEqual(documentLevelArticle.config._type);

  const origArrayObj = documentLevelArticle.content.find(
    (b: Record<string, unknown>) => b._type === 'objectField'
  )!;
  const deserializedArrayObj = deserialized.content.find(
    (b: Record<string, unknown>) => b._type === 'objectField'
  )!;

  expect(deserializedArrayObj.title).toEqual(origArrayObj.title);
  expect(deserializedArrayObj._key).toEqual(origArrayObj._key);
});

test('Content with custom styles deserializes correctly and maintains style', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});

  const customStyledDocument = {
    ...documentLevelArticle,
    ...customStyles,
  };

  const serialized = BaseDocumentSerializer(schema).serializeDocument(
    customStyledDocument,
    'document'
  );

  const deserialized = BaseDocumentDeserializer.deserializeDocument<
    typeof customStyledDocument
  >(serialized.content);
  const isCustomStyleBlock = (b: Record<string, unknown>) =>
    b._type === 'block' && b.style === 'custom1';
  const isCustomStyleListItem = (b: Record<string, unknown>) =>
    b._type === 'block' && b.listItem === 'number' && b.style === 'custom1';

  for (const isCustomStyle of [isCustomStyleBlock, isCustomStyleListItem]) {
    expect(deserialized.content.find(isCustomStyle)!.children[0].text).toEqual(
      customStyledDocument.content.find(isCustomStyle)!.children[0].text
    );
  }
});

//test -- unhandled annotations and inlines don't break when they get deserialized back
describe('handled inline objects and annotations', () => {
  const inlineDocument = {
    ...documentLevelArticle,
    ...annotationAndInlineBlocks,
  };

  const serialized = BaseDocumentSerializer(schema).serializeDocument(
    inlineDocument,
    'document',
    'en',
    defaultStopTypes,
    addedCustomSerializers
  );

  const deserialized = BaseDocumentDeserializer.deserializeDocument<
    typeof inlineDocument
  >(serialized.content, addedCustomDeserializers, addedBlockDeserializers);

  test('Handled inline objects should be accurately deserialized', () => {
    const getInlineObj = (
      content: PortableTextBlock[],
      level: number | undefined = undefined
    ) => {
      let child: Record<string, unknown> = {};
      const blocks = content.filter((block: PortableTextBlock) => {
        if (level) {
          return block.level === level;
        }
        return !block.level;
      });

      blocks.forEach((block: PortableTextBlock) => {
        if (block.children && Array.isArray(block.children)) {
          child = block.children.find((span: Record<string, unknown>) => {
            if (level) {
              return span._type === 'childObjectField' && block.level === level;
            }
            return span._type === 'childObjectField' && !block.level;
          });
        }
      });

      return child;
    };

    for (const level of [undefined, 1]) {
      const original = getInlineObj(inlineDocument.content, level);
      const result = getInlineObj(deserialized.content, level);
      expect(result.title).toEqual(original.title);
      expect(result._type).toEqual(original._type);
    }
  });

  test('Handled annotations should be accurately deserialized', () => {
    const lastAnnotatedSpan = (content: PortableTextBlock[]) =>
      content
        .flatMap(
          (block) =>
            (Array.isArray(block.children) ? block.children : []) as Record<
              string,
              unknown
            >[]
        )
        .filter((span) => Array.isArray(span.marks) && span.marks.length > 0)
        .at(-1)!;

    expect(lastAnnotatedSpan(deserialized.content).text).toEqual(
      lastAnnotatedSpan(inlineDocument.content).text
    );
  });
});

/*
 * MESSY INPUT
 */
test('&nbsp; whitespace should not be escaped', () => {
  vi.spyOn(console, 'debug').mockImplementation(() => {});

  const content = readFileSync(
    'src/serialization/__tests__/__fixtures__/messy-html.html',
    {
      encoding: 'utf-8',
    }
  );
  const result = BaseDocumentDeserializer.deserializeDocument<{
    title: string;
    content: Array<{
      nestedArrayField: Array<{ title: string }>;
    }>;
  }>(content);
  expect(result.title).toEqual('Här är artikel titeln');
  expect(result.content[1].nestedArrayField[0].title).toEqual(
    'Det här är en dragspels titeln'
  );
});

/*
 * V2 functionality -- be able to operate without a strict schema
 */
test('Content with anonymous inline objects deserializes all fields, at any depth', () => {
  vi.spyOn(console, 'debug').mockImplementation(() => {});

  const serialized = BaseDocumentSerializer(inlineSchema).serializeDocument(
    inlineDocumentLevelArticle,
    'document'
  );

  const deserialized = BaseDocumentDeserializer.deserializeDocument<
    typeof inlineDocumentLevelArticle
  >(serialized.content);
  //object in field
  expect(deserialized.tabs.config.title).toEqual(
    inlineDocumentLevelArticle.tabs.config.title
  );

  //array in object in object
  expect(
    deserialized.tabs.config.objectAsField.content[0].children[0].text
  ).toEqual(
    inlineDocumentLevelArticle.tabs.config.objectAsField.content[0].children[0]
      .text
  );

  //arrays
  expect(deserialized.tabs.content).toBeInstanceOf(Array);
  expect(
    deserialized.tabs.content.map((block: { _key: string }) => block._key)
  ).toEqual(
    inlineDocumentLevelArticle.tabs.content.map(
      (block: { _key: string }) => block._key
    )
  );

  //object in array
  const origObj = inlineDocumentLevelArticle.tabs.content.find(
    (block: { _type?: string }) => block._type === 'objectField'
  )!;
  const deserializedObj = deserialized.tabs.content.find(
    (block: { _type?: string }) => block._type === 'objectField'
  )!;

  expect(deserializedObj.title).toEqual(origObj.title);
  expect(deserializedObj.objectAsField!.content[0].children![0]!.text).toEqual(
    origObj.objectAsField!.content[0].children![0]!.text
  );

  //anonymous object in array
  const origArray = inlineDocumentLevelArticle.tabs.arrayWithAnonymousObjects;
  const deserializedArray = deserialized.tabs.arrayWithAnonymousObjects;
  expect(deserializedArray.length).toEqual(origArray.length);
  expect(deserializedArray[0]._key).toEqual(origArray[0]._key);
  expect(Object.keys(deserializedArray[0])).not.toContain('span');
});

test('A <pre> array member from a custom serializer goes to its custom deserializer', () => {
  const array = new DOMParser().parseFromString(
    '<div class="items" data-type="array"><pre class="snippet" id="snippet-1">const a = 1;\n  return a;</pre><pre data-gt-string="">Plain\ntext</pre></div>',
    'text/html'
  ).body.firstElementChild!;
  const snippet = (element: HTMLElement) => ({
    _type: 'snippet',
    code: element.textContent,
  });

  expect(deserializeArray(array, { types: { snippet } })).toEqual([
    { _type: 'snippet', _key: 'snippet-1', code: 'const a = 1;\n  return a;' },
    'Plain\ntext',
  ]);
});

test('A <pre> array member without a class goes to the block deserializers', () => {
  const array = new DOMParser().parseFromString(
    '<div class="items" data-type="array"><pre id="snippet-1">Hello</pre></div>',
    'text/html'
  ).body.firstElementChild!;
  const snippetRule = {
    deserialize(node: Node) {
      if ((node as Element).tagName?.toLowerCase() !== 'pre') return undefined;
      return { _type: 'snippet', code: node.textContent };
    },
  };

  const [item] = deserializeArray(array, { types: {} }, [
    snippetRule,
    ...customBlockDeserializers,
  ]) as Array<{ _key: string; children: unknown[] }>;
  expect(item._key).toBe('snippet-1');
  expect(item.children).toEqual([
    expect.objectContaining({ _type: 'snippet', code: 'Hello' }),
  ]);
});
