import { defineField, defineType } from 'sanity';

export const contentSectionType = defineType({
  name: 'contentSection',
  title: 'Content section',
  type: 'object',
  fields: [
    defineField({
      name: 'heading',
      title: 'Heading',
      type: 'string',
      // Translation: nested string in document-level serialization.
    }),
    defineField({
      name: 'copy',
      title: 'Copy',
      type: 'text',
      // Translation: nested text in document-level serialization.
    }),
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      // Translation: excluded stop type; preserve the shared asset.
      options: { hotspot: true },
    }),
  ],
});
