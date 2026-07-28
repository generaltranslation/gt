/**
 * GT schema options, declaration-merged into Sanity's per-type `options`
 * interfaces (the same pattern `@sanity/document-internationalization` and
 * `@sanity/assist` use) so `options: { gt: { exclude: true } }` type-checks
 * on any field definition.
 */
export interface GTSchemaFieldOptions {
  gt?: {
    /** Set to true to exclude this field from GT translation. */
    exclude?: boolean;
  };
}

declare module 'sanity' {
  interface ArrayOptions extends GTSchemaFieldOptions {}
  interface BlockOptions extends GTSchemaFieldOptions {}
  interface BooleanOptions extends GTSchemaFieldOptions {}
  interface CrossDatasetReferenceOptions extends GTSchemaFieldOptions {}
  interface DateOptions extends GTSchemaFieldOptions {}
  interface DatetimeOptions extends GTSchemaFieldOptions {}
  interface EmailOptions extends GTSchemaFieldOptions {}
  interface FileOptions extends GTSchemaFieldOptions {}
  interface GeopointOptions extends GTSchemaFieldOptions {}
  interface ImageOptions extends GTSchemaFieldOptions {}
  interface NumberOptions extends GTSchemaFieldOptions {}
  interface ObjectOptions extends GTSchemaFieldOptions {}
  interface ReferenceBaseOptions extends GTSchemaFieldOptions {}
  interface SlugOptions extends GTSchemaFieldOptions {}
  interface StringOptions extends GTSchemaFieldOptions {}
  interface TextOptions extends GTSchemaFieldOptions {}
  interface UrlOptions extends GTSchemaFieldOptions {}
}
