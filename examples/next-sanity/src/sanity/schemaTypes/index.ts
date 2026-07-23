import { authorType } from './author';
import { contentSectionType } from './contentSection';
import { documentTranslationExampleType } from './documentTranslationExample';
import { fieldTranslationExampleType } from './fieldTranslationExample';
import { seoType } from './seo';

// Future mixed mode: route fieldTranslationExample through
// internationalized arrays and documentTranslationExample through documents.
export const schemaTypes = [
  authorType,
  contentSectionType,
  seoType,
  documentTranslationExampleType,
  fieldTranslationExampleType,
];
