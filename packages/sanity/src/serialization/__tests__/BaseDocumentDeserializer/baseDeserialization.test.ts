import { readFileSync } from 'fs';
import {
  PortableTextBlock,
  PortableTextObject,
  PortableTextSpan,
  PortableTextTextBlock,
} from 'sanity';
import { beforeEach, expect, test, vi } from 'vitest';
import {
  BaseDocumentDeserializer,
  BaseDocumentSerializer,
  customBlockDeserializers,
  defaultStopTypes,
} from '../../index';
import {
  annotationAndInlineBlocks,
  documentLevelArticle,
  inlineDocumentLevelArticle,
  inlineSchema,
  schema,
} from '../BaseDocumentSerializer/utils';
import {
  addedBlockDeserializers,
  addedCustomDeserializers,
  addedCustomSerializers,
  getDeserialized,
} from '../helpers';

const customStyles = require('../__fixtures__/customStyles');

let mockTestKey = 0;

vi.mock('@sanity/block-tools', async () => {
  const originalModule = await vi.importActual<
    typeof import('@sanity/block-tools')
  >('@sanity/block-tools');
  return {
    ...originalModule,
    //not ideal but vi.mock('@sanity/block-tools/src/util/randomKey.ts' is not working
    htmlToBlocks: (html: string, blockContentType: any, options: any) => {
      const blocks = originalModule.htmlToBlocks(
        html,
        blockContentType,
        options
      );
      const newBlocks = blocks.map((block) => {
        const newChildren = (
          block as unknown as PortableTextTextBlock<
            PortableTextSpan | PortableTextObject
          >
        ).children.map((child) => {
          return { ...child, _key: `randomKey-${mockTestKey++}` };
        });
        return {
          ...block,
          children: newChildren,
          _key: `randomKey-${mockTestKey++}`,
        };
      });
      return newBlocks;
    },
  };
});

beforeEach(() => {
  mockTestKey = 0;
});

test('Contains id of original document', () => {
  const deserialized = getDeserialized(documentLevelArticle, 'document');
  const id = deserialized._id;
  expect(id).toEqual(documentLevelArticle._id);
});

test('Contains rev of original document', () => {
  const deserialized = getDeserialized(documentLevelArticle, 'document');
  const rev = deserialized._rev;
  expect(rev).toEqual(documentLevelArticle._rev);
});

test('Contains type of original document', () => {
  const deserialized = getDeserialized(documentLevelArticle, 'document');
  const type = deserialized._type;
  expect(type).toEqual(documentLevelArticle._type);
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

  const deserialized = BaseDocumentDeserializer.deserializeDocument(
    serialized.content,
    addedCustomDeserializers,
    customBlockDeserializers
  );
  expect(deserialized.config.title).toEqual(documentLevelArticle.config.title);
  expect(deserialized.config._type).toEqual(documentLevelArticle.config._type);

  const origArrayObj = documentLevelArticle.content.find(
    (b: Record<string, any>) => b._type === 'objectField'
  );
  const deserializedArrayObj = deserialized.content.find(
    (b: Record<string, any>) => b._type === 'objectField'
  );

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

  const deserialized = BaseDocumentDeserializer.deserializeDocument(
    serialized.content
  );
  const origCustomStyleBlock = customStyledDocument.content.find(
    (b: Record<string, any>) => b._type === 'block' && b.style === 'custom1'
  );
  const origCustomStyleListItem = customStyledDocument.content.find(
    (b: Record<string, any>) =>
      b._type === 'block' && b.listItem === 'number' && b.style === 'custom1'
  );
  const deserializedCustomStyleBlock = deserialized.content.find(
    (b: Record<string, any>) => b._type === 'block' && b.style === 'custom1'
  );
  const deserializedCustomStyleListItem = deserialized.content.find(
    (b: Record<string, any>) =>
      b._type === 'block' && b.listItem === 'number' && b.style === 'custom1'
  );

  expect(deserializedCustomStyleBlock.children[0].text).toEqual(
    origCustomStyleBlock.children[0].text
  );

  expect(deserializedCustomStyleListItem.children[0].text).toEqual(
    origCustomStyleListItem.children[0].text
  );
});

//test -- unhandled annotations and inlines don't break when they get deserialized back
test('Handled inline objects should be accurately deserialized', () => {
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

  const deserialized = BaseDocumentDeserializer.deserializeDocument(
    serialized.content,
    addedCustomDeserializers,
    addedBlockDeserializers
  );

  const getInlineObj = (
    content: PortableTextBlock[],
    level: number | undefined = undefined
  ) => {
    let child: Record<string, any> = {};
    const blocks = content.filter((block: PortableTextBlock) => {
      if (level) {
        return block.level === level;
      }
      return !block.level;
    });

    blocks.forEach((block: PortableTextBlock) => {
      if (block.children && Array.isArray(block.children)) {
        child = block.children.find((span: Record<string, any>) => {
          if (level) {
            return span._type === 'childObjectField' && block.level === level;
          }
          return span._type === 'childObjectField' && !block.level;
        });
      }
    });

    return child;
  };
  const origInlineObject = getInlineObj(inlineDocument.content);
  const origInlineListObject = getInlineObj(inlineDocument.content, 1);

  const deserializedInlineObject = getInlineObj(deserialized.content);
  const deserializedInlineListObject = getInlineObj(deserialized.content, 1);

  expect(deserializedInlineObject.title).toEqual(origInlineObject.title);
  expect(deserializedInlineObject._type).toEqual(origInlineObject._type);

  expect(deserializedInlineListObject.title).toEqual(
    origInlineListObject.title
  );
  expect(deserializedInlineListObject._type).toEqual(
    origInlineListObject._type
  );
});

test('Handled annotations should be accurately deserialized', () => {
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

  const deserialized = BaseDocumentDeserializer.deserializeDocument(
    serialized.content,
    addedCustomDeserializers,
    addedBlockDeserializers
  );

  let origAnnotation: Record<string, any> | null = null;
  let deserializedAnnotation: Record<string, any> | null = null;

  inlineDocument.content.forEach((block: PortableTextBlock) => {
    if (block.children && Array.isArray(block.children)) {
      block.children.forEach((span: Record<string, any>) => {
        if (span.marks && span.marks.length) {
          origAnnotation = span;
        }
      });
    }
  });

  deserialized.content.forEach((block: PortableTextBlock) => {
    if (block.children && Array.isArray(block.children)) {
      block.children.forEach((span: Record<string, any>) => {
        if (span.marks && span.marks.length) {
          deserializedAnnotation = span;
        }
      });
    }
  });

  expect(deserializedAnnotation!.text).toEqual(origAnnotation!.text);
});

/*
 * STYLE TAGS
 */
test('Deserialized content should preserve style tags', () => {
  const deserialized = getDeserialized(documentLevelArticle, 'document');
  const origH1 = documentLevelArticle.content.find(
    (block: PortableTextBlock) => block.style === 'h1'
  );
  const deserializedH1 = deserialized.content.find(
    (block: PortableTextBlock) => block.style === 'h1'
  );
  const origH2 = documentLevelArticle.content.find(
    (block: PortableTextBlock) => block.style === 'h2'
  );
  const deserializedH2 = deserialized.content.find(
    (block: PortableTextBlock) => block.style === 'h2'
  );
  expect(deserializedH1).toBeDefined();
  expect(deserializedH2).toBeDefined();
  expect(deserializedH1._key).toEqual(origH1._key);
  expect(deserializedH2._key).toEqual(origH2._key);
  expect(deserializedH1.children[0].text).toEqual(origH1.children[0].text);
  expect(deserializedH2.children[0].text).toEqual(origH2.children[0].text);
});

/*
 * LIST ITEMS
 */
test('Deserialized list items should preserve level, style and tag', () => {
  const deserialized = getDeserialized(documentLevelArticle, 'document');
  const origListItem = documentLevelArticle.content.find(
    (block: PortableTextBlock) =>
      block.listItem === 'bullet' && block.style === 'h2'
  );
  const deserializedListItem = deserialized.content.find(
    (block: PortableTextBlock) =>
      block.listItem === 'bullet' && block.style === 'h2'
  );
  const origNestedListItem = documentLevelArticle.content.find(
    (block: PortableTextBlock) =>
      block.listItem === 'bullet' && block.level === 2
  );
  const deserializedNestedListItem = deserialized.content.find(
    (block: PortableTextBlock) =>
      block.listItem === 'bullet' && block.level === 2
  );
  expect(deserializedListItem).toBeDefined();
  expect(deserializedNestedListItem).toBeDefined();
  expect(deserializedListItem._key).toEqual(origListItem._key);
  expect(deserializedNestedListItem._key).toEqual(origNestedListItem._key);
  expect(deserializedListItem.children[0].text).toEqual(
    origListItem.children[0].text
  );
  expect(deserializedNestedListItem.children[0].text).toEqual(
    origNestedListItem.children[0].text
  );
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
  const result = BaseDocumentDeserializer.deserializeDocument(content);
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

  const deserialized = BaseDocumentDeserializer.deserializeDocument(
    serialized.content
  );
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
  expect(deserialized.tabs.content.map((block: any) => block._key)).toEqual(
    inlineDocumentLevelArticle.tabs.content.map((block: any) => block._key)
  );

  //object in array
  const origObj = inlineDocumentLevelArticle.tabs.content.find(
    (block: any) => block._type === 'objectField'
  );
  const deserializedObj = deserialized.tabs.content.find(
    (block: any) => block._type === 'objectField'
  );

  expect(deserializedObj.title).toEqual(origObj.title);
  expect(deserializedObj.objectAsField.content[0].children[0].text).toEqual(
    origObj.objectAsField.content[0].children[0].text
  );

  //anonymous object in array
  const origArray = inlineDocumentLevelArticle.tabs.arrayWithAnonymousObjects;
  const deserializedArray = deserialized.tabs.arrayWithAnonymousObjects;
  expect(deserializedArray.length).toEqual(origArray.length);
  expect(deserializedArray[0]._key).toEqual(origArray[0]._key);
  expect(Object.keys(deserializedArray[0])).not.toContain('span');
});
