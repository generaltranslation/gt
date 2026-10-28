// `generaltranslation` language toolkit
// © 2026, General Translation, Inc.

// ----- IMPORTS ----- //

import type { LocaleConfig } from '@generaltranslation/format';
import { snapshotLocaleConfig } from '@generaltranslation/format/internal';
import type { UserTokenProvider } from '@generaltranslation/api';
import type { TranslateManyResult } from './types-dir/api/translateMany';
import type { TranslationResult } from './types-dir/api/translate';
import type {
  TranslateManyEntry,
  TranslateOptions,
} from './types-dir/api/entry';
import type { GTProjectConfig } from './clientConfig';
import { noScopeIdProvidedError } from './logging/errors';
import { translateEntries } from './translate/runtimeTranslate';

export type { GTCredentials, GTProjectConfig } from './clientConfig';

// ============================================================ //
//                       Runtime Class                          //
// ============================================================ //

/**
 * Runtime translation for one project: `translate` and `translateMany`.
 *
 * Browser-facing SDK code constructs this class (via `generaltranslation/runtime`)
 * so production bundles do not ship the project/file management API client
 * that `GT` uses. For formatting and locale helpers, use `GTIntl`.
 *
 * @example
 * const runtime = new GTRuntime({ apiKey, projectId, localeConfig: { defaultLocale: 'en' } });
 * const result = await runtime.translate('Hello, world!', 'es');
 */
export class GTRuntime {
  readonly projectId: string;
  readonly apiKey?: string;
  readonly userTokenProvider?: UserTokenProvider;
  readonly baseUrl?: string;
  /** A frozen copy of the locale configuration this instance was created with. */
  readonly localeConfig: Readonly<LocaleConfig>;

  /**
   * @param params - Credentials, the project, and optionally the locale configuration and base URL.
   * @throws {Error} If `projectId` is not a non-empty string.
   */
  constructor(params: GTProjectConfig) {
    const { projectId } = params;
    if (typeof projectId !== 'string' || !projectId.trim())
      throw new Error(noScopeIdProvidedError('project'));
    this.projectId = projectId;
    this.apiKey = params.apiKey;
    this.userTokenProvider = params.userTokenProvider;
    this.baseUrl = params.baseUrl;
    this.localeConfig = snapshotLocaleConfig(params.localeConfig);
    // Subclasses freeze themselves after assigning their own fields.
    if (new.target === GTRuntime) Object.freeze(this);
  }

  /**
   * Translates a single source string to the target locale.
   *
   * @param {string} source - The source string to translate.
   * @param {object} options - The target locale, or options including targetLocale.
   * @param {number} [timeout] - Timeout in milliseconds; omitted selects the runtime default.
   * @returns {Promise<TranslationResult>} The translated content.
   *
   * @example
   * const result = await runtime.translate('Hello, world!', 'es');
   *
   * @example
   * const result = await runtime.translate(
   *   {
   *     source: 'Hello, world!',
   *     metadata: { dataFormat: 'ICU', context: 'A formal greeting' },
   *   },
   *   'es'
   * );
   */
  async translate(
    source: TranslateManyEntry,
    options: string | TranslateOptions,
    timeout?: number
  ): Promise<TranslationResult> {
    const [result] = (await translateEntries(
      this,
      'translate',
      [source],
      options,
      timeout
    )) as TranslateManyResult;
    return result;
  }

  /**
   * Translates multiple source strings to the target locale.
   * Each entry can be a plain string or an object with source and metadata fields.
   *
   * @param {TranslateManyEntry[] | Record<string, TranslateManyEntry>} sources - The source entries to translate. Can be an array or a record keyed by hash.
   * @param {object} options - The target locale, or options including targetLocale.
   * @param {number} [timeout] - Timeout in milliseconds; omitted selects the runtime default.
   * @returns {Promise<TranslateManyResult | Record<string, TranslationResult>>} The translated contents. An array if sources was an array, a record if sources was a record.
   *
   * @example
   * const result = await runtime.translateMany(['Hello, world!', 'Goodbye, world!'], 'es');
   *
   * @example
   * const result = await runtime.translateMany(
   *   { 'my-hash': 'Hello, world!' },
   *   { targetLocale: 'es' }
   * );
   */
  async translateMany(
    sources: TranslateManyEntry[],
    options: string | TranslateOptions,
    timeout?: number
  ): Promise<TranslateManyResult>;
  async translateMany(
    sources: Record<string, TranslateManyEntry>,
    options: string | TranslateOptions,
    timeout?: number
  ): Promise<Record<string, TranslationResult>>;
  async translateMany(
    sources: TranslateManyEntry[] | Record<string, TranslateManyEntry>,
    options: string | TranslateOptions,
    timeout?: number
  ): Promise<TranslateManyResult | Record<string, TranslationResult>> {
    return translateEntries(this, 'translateMany', sources, options, timeout);
  }
}
