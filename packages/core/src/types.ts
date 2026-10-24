export { HTML_CONTENT_PROPS } from '@generaltranslation/format/types';
export type {
  Content,
  CustomMapping,
  CustomRegionMapping,
  CutoffFormatOptions,
  DataFormat,
  FormatVariables,
  GTProp,
  HtmlContentPropKeysRecord,
  HtmlContentPropValuesRecord,
  I18nextMessage,
  IcuMessage,
  JsxChild,
  JsxChildren,
  JsxElement,
  LocaleProperties,
  StringContent,
  StringFormat,
  StringMessage,
  Variable,
  VariableType,
} from '@generaltranslation/format/types';
export type {
  ActionType as EntryActionType,
  EntryMetadata,
  TranslateManyEntry,
  TranslateOptions,
} from './types-dir/api/entry';
export type { RuntimeFileFormat } from '@generaltranslation/api';
export type { HashMetadata } from './id/types';
export type { PluralType } from './settings/plurals';
export type {
  GTCompilerOptions,
  GTConfig,
  GTFilesConfig,
  GTOutputFileConfig,
  GTParsingFlags,
} from './types-dir/config';
export type {
  JsonObject,
  JsonPrimitive,
  JsonValue,
} from './types-dir/api/json';

export type { Updates } from './types-dir/api/enqueueFiles';
export type { FileToUpload } from './types-dir/api/file';
export type { FileUpload } from './types-dir/api/uploadFiles';
export type { FileReference } from './types-dir/api/file';
export type { PublishFileEntry } from './translate/publishFiles';
export type { FileFormat } from './types-dir/api/file';
export { isBinaryFileFormat } from './types-dir/api/file';
export type { TranslateManyResult } from './types-dir/api/translateMany';
export type {
  TranslationResult,
  TranslationError,
} from './types-dir/api/translate';
export type { MoveMapping } from './translate/moveFiles';

export type {
  Transformation,
  TransformationPrefix,
  VariableTransformationSuffix,
  InjectionType,
} from './types-dir/transformations';
