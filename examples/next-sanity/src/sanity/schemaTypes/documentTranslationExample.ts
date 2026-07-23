import { defineArrayMember, defineField, defineType } from 'sanity';

// Translation level: document. gt-sanity will create one document per locale.
export const documentTranslationExampleType = defineType({
  name: 'documentTranslationExample',
  title: 'Document translation example',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      // Translation: top-level string.
    }),
    defineField({
      name: 'summary',
      title: 'Summary',
      type: 'text',
      // Translation: top-level multi-line text.
    }),
    defineField({
      name: 'tags',
      title: 'Tags',
      type: 'array',
      // Translation: array of strings.
      of: [defineArrayMember({ type: 'string' })],
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'array',
      // Translation: Portable Text blocks, marks, lists, and headings.
      of: [defineArrayMember({ type: 'block' })],
    }),
    defineField({
      name: 'sections',
      title: 'Sections',
      type: 'array',
      // Translation: strings and text nested inside array objects.
      of: [defineArrayMember({ type: 'contentSection' })],
    }),
    defineField({
      name: 'callout',
      title: 'Callout',
      type: 'object',
      // Translation: strings nested inside an inline object.
      fields: [
        defineField({ name: 'heading', title: 'Heading', type: 'string' }),
        defineField({ name: 'copy', title: 'Copy', type: 'text' }),
      ],
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      // Translation: add localize: false to preserve routing metadata.
      options: { source: 'title' },
    }),
    defineField({
      name: 'author',
      title: 'Author',
      type: 'reference',
      // Translation: excluded stop type; preserve the reference.
      to: [{ type: 'author' }],
    }),
    defineField({
      name: 'heroImage',
      title: 'Hero image',
      type: 'image',
      // Translation: excluded stop type; preserve the asset and crop.
      options: { hotspot: true },
    }),
    defineField({
      name: 'publishedAt',
      title: 'Published at',
      type: 'datetime',
      // Translation: excluded stop type.
    }),
    defineField({
      name: 'featured',
      title: 'Featured',
      type: 'boolean',
      // Translation: excluded stop type.
    }),
    defineField({
      name: 'readingMinutes',
      title: 'Reading minutes',
      type: 'number',
      // Translation: excluded stop type.
    }),
    defineField({
      name: 'sourceUrl',
      title: 'Source URL',
      type: 'url',
      // Translation: excluded stop type.
    }),
  ],
});
