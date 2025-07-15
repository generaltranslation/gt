import {
  Content,
  DataFormat,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  JsxChildren,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  IcuMessage,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  I18nextMessage,
} from '../types';

/**
 * ActionType is the type of action to perform on the request.
 *
 * @param standard - The standard action type (standard model).
 * @param fast - The fast action type (mini model).
 * @param string - Other model
 */
export type ActionType = 'standard' | 'fast' | string;

/**
 * GTRequestMetadata is the metadata for a GTRequest.
 *
 * @param context - The context of the request.
 * @param id - The id of the request.
 * @param hash - The hash of the request.
 */
export type EntryMetadata = {
  context?: string;
  id?: string;
  hash?: string;
  dataFormat?: DataFormat;
  sourceLocale?: string;
  actionType?: ActionType;
  timeout?: number;
};

/**
 * GTRequest is a translation request object for {@link JsxChildren} | {@link IcuMessage} | {@link I18nextMessage}
 *
 * @param source - The source content to translate.
 * @param targetLocale - The target locale to translate to.
 * @param requestMetadata - The metadata for the request.
 */
export type Entry = {
  source: Content;
  targetLocale?: string;
  requestMetadata?: EntryMetadata;
};
