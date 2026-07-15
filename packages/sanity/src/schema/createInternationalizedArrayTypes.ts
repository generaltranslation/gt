import { getLocaleProperties } from 'generaltranslation';
import { FieldProps, SchemaTypeDefinition } from 'sanity';
import {
  InternationalizedArrayInput,
  InternationalizedValueItem,
} from './InternationalizedArrayInput';
import {
  FieldLevelFieldType,
  FieldLevelUIComponents,
  GTFieldLevelLocalizationConfig,
} from './types';

const DEFAULT_TYPE_PREFIX = 'internationalizedArray';

export type CreateInternationalizedArrayTypesOptions = {
  sourceLocale: string;
  locales: string[];
  fieldTypes: FieldLevelFieldType[];
  languageTitles?: Record<string, string>;
  getLanguageTitle?: (locale: string) => string;
  typePrefix?: string;
  includeCompatibilityTypes?: boolean;
  components?: FieldLevelUIComponents;
};

/**
 * Resolve the components to attach to generated types. Each slot can be a
 * custom component, `false` (detach — Sanity's default rendering), or
 * undefined (GT's default). The `field` level-reset wrapper only makes sense
 * alongside GT's inline input, so its default follows the resolved `input`.
 */
function resolveComponents(overrides: FieldLevelUIComponents | undefined): {
  input?: unknown;
  item?: unknown;
  field?: unknown;
} {
  const input =
    overrides?.input === false
      ? undefined
      : (overrides?.input ?? InternationalizedArrayInput);
  const item =
    overrides?.item === false
      ? undefined
      : (overrides?.item ?? InternationalizedValueItem);
  const defaultField =
    input === InternationalizedArrayInput
      ? // Reset the field level so inline per-locale inputs don't inherit
        // nested-object indentation.
        (fieldProps: FieldProps) =>
          fieldProps.renderDefault({ ...fieldProps, level: 0 })
      : undefined;
  const field =
    overrides?.field === false ? undefined : (overrides?.field ?? defaultField);
  return { input, item, field };
}

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
  const { languageTitles, getLanguageTitle, sourceLocale } = options;
  return (locale: string) =>
    getLanguageTitle?.(locale) ??
    languageTitles?.[locale] ??
    getLocaleProperties(locale, sourceLocale).name ??
    locale;
}

function buildTypesForPrefix(
  prefix: string,
  options: CreateInternationalizedArrayTypesOptions
): SchemaTypeDefinition[] {
  const { sourceLocale, locales, fieldTypes } = options;
  const languageTitle = makeLanguageTitle(options);
  const components = resolveComponents(options.components);

  return fieldTypes.map((fieldType) => {
    const typeName = `${prefix}${capitalize(fieldTypeName(fieldType))}`;
    const valueTypeName = `${typeName}Value`;

    // Locale identity comes from gtPlugin (sourceLocale + locales); surfaced
    // on both the array type (per-locale add buttons) and the value object
    // (inline item label + source-locale remove guard).
    const gtInternationalizedArray = {
      sourceLocale,
      locales,
      titles: Object.fromEntries(
        [sourceLocale, ...locales].map((locale) => [
          locale,
          languageTitle(locale),
        ])
      ),
    };

    const valueObject = {
      type: 'object',
      name: valueTypeName,
      ...(components.item ? { components: { item: components.item } } : {}),
      fields: [
        {
          name: 'language',
          type: 'string',
          title: 'Language',
          readOnly: true,
          // GT's inline item shows the locale as the value field's label;
          // with a custom or detached item, keep the field visible so the
          // locale is still discoverable in default/dialog rendering.
          hidden: components.item === InternationalizedValueItem,
        },
        valueField(fieldType),
      ],
      options: { gtInternationalizedArray },
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

    const arrayComponents = {
      ...(components.input ? { input: components.input } : {}),
      ...(components.field ? { field: components.field } : {}),
    };

    return {
      name: typeName,
      type: 'array',
      ...(Object.keys(arrayComponents).length
        ? { components: arrayComponents }
        : {}),
      of: [valueObject],
      options: { gtInternationalizedArray },
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
