import { defineField, defineType } from 'sanity';

export const authorType = defineType({
  name: 'author',
  title: 'Author',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      // Translation: proper name; add localize: false when gt-sanity is enabled.
    }),
    defineField({
      name: 'bio',
      title: 'Biography',
      type: 'text',
      // Translation: document-level text if authors are translated later.
    }),
    defineField({
      name: 'portrait',
      title: 'Portrait',
      type: 'image',
      // Translation: excluded stop type; only asset metadata may need localization.
      options: { hotspot: true },
    }),
  ],
});
