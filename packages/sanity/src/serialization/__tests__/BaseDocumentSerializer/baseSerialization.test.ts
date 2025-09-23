import { PortableTextBlock } from 'sanity';
import { describe, expect, test, vi } from 'vitest';
import {
  BaseDocumentSerializer,
  customSerializers,
  defaultStopTypes,
} from '../../index';
import {
  addedCustomSerializers,
  createCustomInnerHTML,
  getSerialized,
  getValidFields,
} from '../helpers';
import {
  annotationAndInlineBlocks,
  documentLevelArticle,
  findByClass,
  getHTMLNode,
  inlineDocumentLevelArticle,
  inlineSchema,
  schema,
} from './utils';

/*
 * METADATA PRESENCE
 */
describe('Has all required metadata', () => {
  const serialized = getSerialized(documentLevelArticle, 'document');
  const docTree = getHTMLNode(serialized);
  test('Contains metadata field containing document id', () => {
    const idMetaTag = Array.from(docTree.head.children).find(
      (metaTag) => metaTag.getAttribute('name') === '_id'
    );
    const id = idMetaTag?.getAttribute('content');
    expect(id).toEqual(documentLevelArticle._id);
  });

  test('Contains metadata field containing document revision', () => {
    const revMetaTag = Array.from(docTree.head.children).find(
      (metaTag) => metaTag.getAttribute('name') === '_rev'
    );
    const rev = revMetaTag?.getAttribute('content');
    expect(rev).toEqual(documentLevelArticle._rev);
  });

  test('Contains metadata field containing document type', () => {
    const typeMetaTag = Array.from(docTree.head.children).find(
      (metaTag) => metaTag.getAttribute('name') === '_type'
    );
    const type = typeMetaTag?.getAttribute('content');
    expect(type).toEqual(documentLevelArticle._type);
  });

  test('Contains metadata field containing version', () => {
    const typeMetaTag = Array.from(docTree.head.children).find(
      (metaTag) => metaTag.getAttribute('name') === 'version'
    );
    const version = typeMetaTag?.getAttribute('content');
    expect(version).toEqual('3');
  });
});

/*
 * CUSTOM SETTINGS
 */

test('Custom serialization should manifest at all levels', () => {
  const serializer = BaseDocumentSerializer(schema);
  const serialized = serializer.serializeDocument(
    documentLevelArticle,
    'document',
    'en',
    defaultStopTypes,
    addedCustomSerializers
  );
  const docTree = getHTMLNode(serialized).body.children[0];

  const topLevelCustomSerialized = findByClass(docTree.children, 'config');
  const requiredTopLevelTitle = documentLevelArticle.config.title;
  expect(topLevelCustomSerialized?.innerHTML).toContain(
    createCustomInnerHTML(requiredTopLevelTitle)
  );

  const arrayField = findByClass(docTree.children, 'content');
  const nestedSerialized = findByClass(arrayField!.children, 'objectField');
  const requiredNestedTitle = documentLevelArticle.content.find(
    (b: Record<string, any>) => b._type === 'objectField'
  ).title;
  expect(nestedSerialized?.innerHTML).toContain(
    createCustomInnerHTML(requiredNestedTitle)
  );
});

test('Fields marked "localize: false" should not be serialized', () => {
  const serialized = getSerialized(documentLevelArticle, 'document');
  const docTree = getHTMLNode(serialized).body.children[0];
  //"meta" is localize: false field
  const meta = findByClass(docTree.children, 'meta');
  expect(documentLevelArticle.meta).toBeDefined();
  expect(meta).toBeUndefined();
});

test('Expect default stop types to be absent', () => {
  const serialized = getSerialized(documentLevelArticle, 'document');
  const docTree = getHTMLNode(serialized).body.children[0];
  //"hidden" is boolean field
  const hidden = findByClass(docTree.children, 'hidden');
  expect(documentLevelArticle.hidden).toBeDefined();
  expect(hidden).toBeUndefined();
});

test('Expect custom stop types to be absent at all levels', () => {
  const customStopTypes = [...defaultStopTypes, 'objectField'];
  const serializer = BaseDocumentSerializer(schema);
  const serialized = serializer.serializeDocument(
    documentLevelArticle,
    'document',
    'en',
    customStopTypes,
    customSerializers
  );

  const docTree = getHTMLNode(serialized).body.children[0];
  const config = findByClass(docTree.children, 'config');
  expect(documentLevelArticle.config).toBeDefined();
  expect(config).toBeUndefined();

  const arrayField = findByClass(docTree.children, 'content');
  const nestedSerialized = findByClass(arrayField!.children, 'objectField');
  const nestedObjField = documentLevelArticle.content.find(
    (b: Record<string, any>) => b._type === 'objectField'
  );
  expect(nestedObjField).toBeDefined();
  expect(nestedSerialized).toBeUndefined();
});

/*
 * ANNOTATION AND INLINE BLOCK CONTENT
 */

test('Unhandled inline objects and annotations should not hinder translation flows', () => {
  //eslint-disable-next-line no-empty-function -- we're just silencing the console.warn
  vi.spyOn(console, 'warn').mockImplementation(() => {});

  const inlineDocument = {
    ...documentLevelArticle,
    ...annotationAndInlineBlocks,
  };
  const serialized = getSerialized(inlineDocument, 'document');
  const docTree = getHTMLNode(serialized).body.children[0];
  const arrayField = findByClass(docTree.children, 'content');

  //expect annotated object to have underlying text
  const blockWithAnnotation = Array.from(arrayField!.children).find(
    (node) => node.id === '0e55995095df'
  );
  const unhandledAnnotation = findByClass(
    blockWithAnnotation!.children,
    'unknown__pt__mark__annotation'
  );
  expect(unhandledAnnotation?.innerHTML).toContain('text');

  //expect unknown inline object to be present but empty
  //(this allows it to be merged back safely, but not sent to translation)
  const inlineObject = findByClass(arrayField!.children, 'childObjectField');
  expect(inlineObject?.innerHTML.length).toEqual(0);
});

test('Handled inline objects should be accurately represented per serializer', () => {
  const inlineDocument = {
    ...documentLevelArticle,
    ...annotationAndInlineBlocks,
  };

  const serializer = BaseDocumentSerializer(schema);
  const serialized = serializer.serializeDocument(
    inlineDocument,
    'document',
    'en',
    defaultStopTypes,
    addedCustomSerializers
  );
  const docTree = getHTMLNode(serialized).body.children[0];
  const arrayField = findByClass(docTree.children, 'content');
  let inlineObject: Element | null = null;
  let inlineObjectBlock: Record<string, any> | null = null;

  Array.from(arrayField!.children).forEach((block: any) => {
    if (!inlineObject) {
      inlineObject =
        findByClass(block.children, 'childObjectField') ?? inlineObject;
    }
  });

  inlineDocument.content.forEach((block: Record<string, any>) => {
    if (block.children) {
      block.children.forEach((span: Record<string, any>) => {
        if (span._type === 'childObjectField') {
          inlineObjectBlock = span;
        }
      });
    }
  });

  expect(inlineObject!.innerHTML).toContain(
    createCustomInnerHTML(inlineObjectBlock!.title)
  );
});

test('Handled annotations should be accurately represented per serializer', () => {
  const inlineDocument = {
    ...documentLevelArticle,
    ...annotationAndInlineBlocks,
  };

  const serializer = BaseDocumentSerializer(schema);
  const serialized = serializer.serializeDocument(
    inlineDocument,
    'document',
    'en',
    defaultStopTypes,
    addedCustomSerializers
  );
  const docTree = getHTMLNode(serialized).body.children[0];
  const arrayField = findByClass(docTree.children, 'content');
  let annotation: Element | null = null;
  let annotationBlock: Record<string, any> | null = null;

  Array.from(arrayField!.children).forEach((block: any) => {
    if (!annotation) {
      annotation = findByClass(block.children, 'annotation') ?? annotation;
    }
  });

  inlineDocument.content.forEach((block: PortableTextBlock) => {
    if (block.children && Array.isArray(block.children)) {
      block.children.forEach((span: Record<string, any>) => {
        if (span.marks && span.marks.length) {
          annotationBlock = span;
        }
      });
    }
  });

  expect(annotation!.innerHTML).toEqual(annotationBlock!.text);
});

/*
 * STYLE TAGS
 */
test('Serialized content should preserve style tags from Portable Text', () => {
  const serialized = getSerialized(documentLevelArticle, 'document');
  const docTree = getHTMLNode(serialized).body.children[0];
  const arrayField = findByClass(docTree.children, 'content');
  const blockH1 = documentLevelArticle.content.find(
    (block: PortableTextBlock) => block.style === 'h1'
  );
  const serializedH1 = arrayField?.querySelector('h1');
  const blockH2 = documentLevelArticle.content.find(
    (block: PortableTextBlock) => block.style === 'h2'
  );
  const serializedH2 = arrayField?.querySelector('h2');
  expect(serializedH1?.innerHTML).toEqual(blockH1.children[0].text);
  expect(serializedH2?.innerHTML).toEqual(blockH2.children[0].text);
});

/*
 * V2 functionality -- be able to operate without a strict schema
 */

test('Content with anonymous inline objects serializes all fields, at any depth', () => {
  const serialized = BaseDocumentSerializer(inlineSchema).serializeDocument(
    inlineDocumentLevelArticle,
    'document'
  );
  const docTree = getHTMLNode(serialized).body.children[0];
  const tabs = findByClass(docTree.children, 'tabs')!.children[0];
  const config = findByClass(tabs!.children, 'config')!.children[0];
  const fieldNames = getValidFields(inlineDocumentLevelArticle.tabs.config);
  const foundFieldNames = Array.from(config!.children).map(
    (child) => child.className
  );
  expect(foundFieldNames.sort()).toEqual(fieldNames.sort());
  const nestedObjHTML = findByClass(config!.children, 'objectAsField')!
    .children[0];
  const nestedObj = inlineDocumentLevelArticle.tabs.config.objectAsField;
  const nestedFieldNames = Array.from(nestedObjHTML!.children).map(
    (child) => child.className
  );
  expect(nestedFieldNames.sort()).toEqual(getValidFields(nestedObj).sort());

  const content = findByClass(tabs!.children, 'content')!;
  const keysHTML = Array.from(content.children).map((child) => child.id);
  const keysJSON = inlineDocumentLevelArticle.tabs.content.map(
    (child: any) => child._key
  );
  expect(keysHTML.sort()).toEqual(keysJSON.sort());

  const objectInArrayHTML = findByClass(content.children, 'objectField');
  const objectInArrayHTMLFieldNames = Array.from(
    objectInArrayHTML!.children
  ).map((child) => child.className);
  const objectInArray = inlineDocumentLevelArticle.tabs.content.find(
    (obj: any) => obj._type === 'objectField'
  );
  expect(objectInArrayHTMLFieldNames.sort()).toEqual(
    getValidFields(objectInArray).sort()
  );
});

/*
 * LIST ITEMS
 */
test('Serialized content should preserve list style and depth from Portable text', () => {
  const serialized = getSerialized(documentLevelArticle, 'document');
  const docTree = getHTMLNode(serialized).body.children[0];
  const arrayField = findByClass(docTree.children, 'content');
  const listItem = documentLevelArticle.content.find(
    (block: PortableTextBlock) =>
      block.listItem === 'bullet' && block.style === 'h2'
  );

  const serializedListItem = arrayField?.querySelectorAll('li')[2];
  const nestedListItem = documentLevelArticle.content.find(
    (block: PortableTextBlock) =>
      block.listItem === 'bullet' && block.level === 2
  );
  const serializedNestedListItem = arrayField?.querySelectorAll('li')[1];
  //include quote style for completeness
  expect(serializedListItem?.innerHTML).toContain(listItem.children[0].text);
  expect(serializedListItem?.innerHTML).toContain('h2');

  expect(serializedNestedListItem?.innerHTML).toEqual(
    nestedListItem.children[0].text
  );
});

test('Values in a field are not repeated (indicating serializers are stateless)', () => {
  const serialized = getSerialized(documentLevelArticle, 'document');
  const docTree = getHTMLNode(serialized).body.children[0];
  const HTMLList = findByClass(docTree.children, 'tags');
  const tags = documentLevelArticle.tags;
  expect(HTMLList?.innerHTML).toContain(tags[0]);
  expect(HTMLList?.innerHTML).toContain(tags[1]);
  expect(HTMLList?.innerHTML).toContain(tags[2]);
});
