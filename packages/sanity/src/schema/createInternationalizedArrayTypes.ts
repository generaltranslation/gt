import { SchemaTypeDefinition } from 'sanity';
import { InternationalizedArrayInput } from './InternationalizedArrayInput';
import { FieldLevelFieldType, GTFieldLevelLocalizationConfig } from './types';

const DEFAULT_TYPE_PREFIX = 'internationalizedArray';

export type CreateInternationalizedArrayTypesOptions = {
  sourceLocale: string;
  locales: string[];
  fieldTypes: FieldLevelFieldType[];
  languageTitles?: Record<string, string>;
  getLanguageTitle?: (locale: string) => string;
  typePrefix?: string;
  includeCompatibilityTypes?: boolean;
};

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function fieldTypeName(fieldType: FieldLevelFieldType): string {
  return typeof fieldType === 'string' ? fieldType : fieldType.name;
}

/** Build the generated `value` field definition for a localizable field type. */
function valueField(fieldType: FieldLevelFieldType): Record<string, unknown> {
  if (fieldType === 'string' || fieldType === 'text') {
    return { name: 'value', type: fieldType, title: 'Value' };
  }
  if (fieldType === 'block') {
    return {
      name: 'value',
      type: 'array',
      title: 'Value',
      of: [{ type: 'block' }],
    };
  }
  // Custom object form: pass the user definition through under `value`.
  const { name: _name, ...rest } = fieldType;
  return { name: 'value', title: 'Value', ...rest };
}

function makeLanguageTitle(
  options: CreateInternationalizedArrayTypesOptions
): (locale: string) => string {
  const { languageTitles, getLanguageTitle } = options;
  return (locale: string) =>
    getLanguageTitle?.(locale) ?? languageTitles?.[locale] ?? locale;
}

function buildTypesForPrefix(
  prefix: string,
  options: CreateInternationalizedArrayTypesOptions
): SchemaTypeDefinition[] {
  const { sourceLocale, locales, fieldTypes } = options;
  const languageTitle = makeLanguageTitle(options);

  return fieldTypes.map((fieldType) => {
    const typeName = `${prefix}${capitalize(fieldTypeName(fieldType))}`;
    const valueTypeName = `${typeName}Value`;

    const valueObject = {
      type: 'object',
      name: valueTypeName,
      fields: [
        {
          name: 'language',
          type: 'string',
          title: 'Language',
          readOnly: true,
        },
        valueField(fieldType),
      ],
      preview: {
        select: { language: 'language', value: 'value' },
        prepare(selection: { language?: string; value?: unknown }) {
          const localeLabel = selection.language
            ? languageTitle(selection.language)
            : 'Unknown';
          return {
            title:
              typeof selection.value === 'string'
                ? selection.value
                : localeLabel,
            subtitle: localeLabel,
          };
        },
      },
    };

    return {
      name: typeName,
      type: 'array',
      components: { input: InternationalizedArrayInput },
      of: [valueObject],
      // Locale identity comes from gtPlugin (sourceLocale + locales); surfaced
      // here so the input component can render per-locale affordances later.
      options: {
        gtInternationalizedArray: { sourceLocale, locales },
      },
    } as unknown as SchemaTypeDefinition;
  });
}

/**
 * Generate `internationalizedArray*` schema types from gtPlugin locale config.
 *
 * Each generated type is an array of `{ _key, _type, language, value }` objects
 * matching `sanity-plugin-internationalized-array`, giving zero-migration
 * interop with existing internationalized-array data.
 *
 * When `typePrefix` is customized and `includeCompatibilityTypes` is true, the
 * standard `internationalizedArray*` names are also generated so existing
 * content keeps resolving.
 */
export function createInternationalizedArrayTypes(
  options: CreateInternationalizedArrayTypesOptions
): SchemaTypeDefinition[] {
  const prefix = options.typePrefix ?? DEFAULT_TYPE_PREFIX;
  const includeCompatibilityTypes = options.includeCompatibilityTypes ?? true;

  const types = buildTypesForPrefix(prefix, options);

  if (includeCompatibilityTypes && prefix !== DEFAULT_TYPE_PREFIX) {
    types.push(...buildTypesForPrefix(DEFAULT_TYPE_PREFIX, options));
  }

  return types;
}

export function resolveFieldLevelConfig(
  config: GTFieldLevelLocalizationConfig | undefined
): Required<Pick<GTFieldLevelLocalizationConfig, 'enabled' | 'fieldTypes'>> &
  GTFieldLevelLocalizationConfig {
  return {
    enabled: false,
    fieldTypes: ['string', 'text'],
    typePrefix: DEFAULT_TYPE_PREFIX,
    includeCompatibilityTypes: true,
    ...config,
  };
}
