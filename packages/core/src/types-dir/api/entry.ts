import {
  Content,
  DataFormat,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  JsxChildren,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  IcuMessage,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  I18nextMessage,
} from '../../types';

/**
 * ActionType is the type of action to perform on the request.
 *
 * @param standard - The standard action type (standard model).
 * @param fast - The fast action type (mini model).
 * @param string - Other model
 */
export type ActionType = 'fast';

/**
 * EntryMetadata is the metadata for a GTRequest.
 *
 * @param context - The context of the request.
 * @param id - The id of the request.
 * @param maxChars - The maxChars of the request.
 * @param hash - The hash of the request.
 */
export type EntryMetadata = {
  id?: string;
  hash?: string;
  context?: string;
  maxChars?: number;
  dataFormat?: DataFormat;
  actionType?: ActionType;
};

export type SharedMetadata = {
  modelProvider?: string;
};

/**
 * Entry is a single translation request entry for {@link JsxChildren} | {@link IcuMessage} | {@link I18nextMessage}
 *
 * @param source - The source content to translate.
 * @param metadata - The metadata for the request.
 */
export type Entry = {
  source: Content;
  sourceLocale?: string;
  targetLocale?: string;
  metadata?: EntryMetadata;
};

/**
 * TranslateManyEntry is the input type for translateMany.
 * Can be a plain string or an object with source and entry metadata fields.
 */
export type TranslateManyEntry = string | ({ source: Content } & EntryMetadata);
