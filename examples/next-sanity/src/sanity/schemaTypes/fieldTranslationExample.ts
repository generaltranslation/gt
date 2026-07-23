import { defineField, defineType } from 'sanity';

// Translation level: internationalizedArray. These plain fields intentionally
// stay unlocalized until gtPlugin generates the field types in a follow-up.
export const fieldTranslationExampleType = defineType({
  name: 'fieldTranslationExample',
  title: 'Field translation example',
  type: 'document',
  fields: [
    defineField({
      name: 'headline',
      title: 'Headline',
      type: 'string',
      // Translation: replace with internationalizedArrayString.
    }),
    defineField({
      name: 'summary',
      title: 'Summary',
      type: 'text',
      // Translation: replace with internationalizedArrayText.
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'array',
      // Translation: replace with internationalizedArrayBlock.
      of: [{ type: 'block' }],
    }),
    defineField({
      name: 'seo',
      title: 'SEO',
      type: 'seo',
      // Translation: generate a custom internationalizedArraySeo type.
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      // Translation: keep outside localized arrays.
      options: { source: 'headline' },
    }),
  ],
});
