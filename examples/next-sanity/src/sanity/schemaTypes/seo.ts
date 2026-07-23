import { defineField, defineType } from 'sanity';

export const seoType = defineType({
  name: 'seo',
  title: 'SEO',
  type: 'object',
  fields: [
    defineField({
      name: 'title',
      title: 'Search title',
      type: 'string',
      // Translation: string inside the future custom localized object.
    }),
    defineField({
      name: 'description',
      title: 'Search description',
      type: 'text',
      // Translation: text inside the future custom localized object.
    }),
    defineField({
      name: 'socialImage',
      title: 'Social image',
      type: 'image',
      // Translation: excluded stop type inside the custom object.
    }),
  ],
});
