// Adapted from https://github.com/sanity-io/sanity-naive-html-serializer

import { ObjectField, TypedObject } from 'sanity';

const META_FIELDS = ['_key', '_type', '_id'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Schema `options` namespaces that can exclude a field from translation.
 * `gt.exclude` is gt-sanity's own; `documentInternationalization.exclude`
 * (@sanity/document-internationalization) and `aiAssist.exclude`
 * (@sanity/assist) are honored so studios don't have to maintain a second
 * exclusion pattern for GT.
 */
type FieldExclusionOptions = {
  gt?: { exclude?: boolean };
  documentInternationalization?: { exclude?: boolean };
  aiAssist?: { exclude?: boolean };
};

export const isFieldExcludedByOptions = (options: unknown): boolean => {
  if (!isRecord(options)) return false;
  const exclusionOptions = options as FieldExclusionOptions;
  return (
    exclusionOptions.gt?.exclude === true ||
    exclusionOptions.documentInternationalization?.exclude === true ||
    exclusionOptions.aiAssist?.exclude === true
  );
};

/** Resolves a schema type name to its raw type definition, if registered. */
export type SchemaTypeResolver = (
  typeName: string
) => { type?: unknown; options?: unknown } | undefined;

const getFieldTypeName = (field: ObjectField): string | undefined => {
  const fieldType = (
    field as ObjectField & { type?: string | { name?: string } }
  ).type;
  return typeof fieldType === 'string' ? fieldType : fieldType?.name;
};

/**
 * Exclusion options on a type definition apply to every value of that type,
 * including through chains of type aliases. Walks the named type and each
 * alias target until a definition is excluded or the chain ends.
 */
export const isTypeExcludedByOptions = (
  typeName: string | undefined,
  resolveType: SchemaTypeResolver | undefined
): boolean => {
  if (!resolveType) return false;
  const seen = new Set<string>();
  let current = typeName;
  while (current && !seen.has(current)) {
    seen.add(current);
    const typeDef = resolveType(current);
    if (!typeDef) return false;
    if (isFieldExcludedByOptions(typeDef.options)) return true;
    current = typeof typeDef.type === 'string' ? typeDef.type : undefined;
  }
  return false;
};

/**
 * A schema field is excluded from translation by the legacy `localize: false`
 * field property, by one of the `options` namespaces on the field itself, or
 * by exclusion options on the type definition the field references.
 */
export const isFieldExcludedFromTranslation = (
  field: ObjectField,
  resolveType?: SchemaTypeResolver
): boolean => {
  const fieldMetadata = field as ObjectField & {
    localize?: boolean;
    options?: unknown;
  };
  return (
    fieldMetadata.localize === false ||
    isFieldExcludedByOptions(fieldMetadata.options) ||
    isTypeExcludedByOptions(getFieldTypeName(field), resolveType)
  );
};

/*
 * Eliminates stop-types and non-localizable fields
 * for document-level translation.
 */
export const fieldFilter = (
  obj: Record<string, unknown>,
  objFields: ObjectField[],
  stopTypes: string[],
  resolveType?: SchemaTypeResolver
): TypedObject => {
  const filteredObj: TypedObject = {
    _type: typeof obj._type === 'string' ? obj._type : '',
  };

  const fieldFilterFunc = (field: ObjectField): boolean => {
    const fieldType = getFieldTypeName(field);

    if (isFieldExcludedFromTranslation(field, resolveType)) {
      return false;
    } else if (fieldType === 'string' || fieldType === 'text') {
      return true;
    } else if (Array.isArray(obj[field.name])) {
      return true;
    } else if (fieldType && !stopTypes.includes(fieldType)) {
      return true;
    }
    return false;
  };

  const validFields = [
    ...META_FIELDS,
    ...objFields.filter(fieldFilterFunc).map((field) => field.name),
  ];
  validFields.forEach((field) => {
    if (obj[field]) {
      filteredObj[field] = obj[field];
    }
  });
  return filteredObj;
};
