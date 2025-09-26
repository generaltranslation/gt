import { createRequire } from 'module';
import { PortableTextBlock } from 'sanity';
import { expect, test } from 'vitest';
import { BaseDocumentMerger } from '../../index';
import { getNewDocument } from './utils';

const require = createRequire(import.meta.url);

const documentLevelArticle = require('../__fixtures__/documentLevelArticle.json');

/*
 * STYLE TAGS
 */
test('Merged document should maintain style tags', () => {
  const newDocument = getNewDocument();
  const mergedDocument = BaseDocumentMerger.documentLevelMerge(
    newDocument,
    documentLevelArticle
  );
  const origH1Block = documentLevelArticle.content.find(
    (block: PortableTextBlock) => block.style === 'h1'
  );
  const origH2Block = documentLevelArticle.content.find(
    (block: PortableTextBlock) => block.style === 'h2'
  );
  const mergedH1Block = mergedDocument.content.find(
    (block: PortableTextBlock) => block.style === 'h1'
  );
  const mergedH2Block = mergedDocument.content.find(
    (block: PortableTextBlock) => block.style === 'h2'
  );
  expect(mergedH1Block).toBeDefined();
  expect(mergedH2Block).toBeDefined();
  expect(mergedH1Block._key).toEqual(origH1Block._key);
  expect(mergedH2Block._key).toEqual(origH2Block._key);
});
