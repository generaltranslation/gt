import { TraverseOptions } from '@babel/traverse';
import * as t from '@babel/types';
import { isUnstableGTImportSource } from 'generaltranslation/internal';
import { TransformState } from '../state/types';
import {
  injectUnstableTaggedTemplateHash,
  type TemplateSourceReplacer,
} from '../transform/injection/injectUnstableTaggedTemplateHash';
import { buildInlineTranslations } from '../transform/injection/inline-translations/injectInlineTranslations';
import { replaceTemplateSource } from '../transform/injection/inline-translations/replaceTemplateSource';
import { createErrorLocation } from '../utils/errors';

/**
 * Unstable hash injection pass — injects `$_hash` into statically analyzable
 * unstable tagged templates (t`...`), and in production builds with
 * `files.gt.inlineTranslations` the translations embedded at the call site.
 * Each template is hashed and rewritten in the same visit, so this pass needs
 * no collection counters.
 */
export function unstableHashInjectionPass(
  state: TransformState
): TraverseOptions {
  const buildInline = state.settings.inlineTranslationsTable
    ? (hash: string) => buildInlineTranslations(hash, state)
    : undefined;
  const replaceSource = getTemplateSourceReplacer(state);
  return {
    TaggedTemplateExpression(path) {
      if (
        injectUnstableTaggedTemplateHash(
          path,
          buildInline,
          replaceSource,
          state.settings.inlineTranslationsHelpers
        )
      ) {
        state.statistics.unstableHashInjectionsCount += 1;
      }
    },
  };
}

/**
 * How this build replaces the source content of templates: with the static
 * locale's embedded translations, or with the source text itself when that
 * locale renders the source.
 */
function getTemplateSourceReplacer(
  state: TransformState
): TemplateSourceReplacer | undefined {
  const { sourceReplacement, inlineTranslationsTable } = state.settings;
  if (!sourceReplacement) return undefined;
  const translations =
    sourceReplacement.locale === undefined
      ? undefined
      : inlineTranslationsTable?.[sourceReplacement.locale];
  if (sourceReplacement.locale !== undefined && !translations) return undefined;

  const keep = (message: string, quasi: t.TemplateLiteral) => {
    state.statistics.sourceReplacementFallbacksCount += 1;
    state.logger.logDebug(
      message +
        createErrorLocation(quasi).replace(
          '{filename}',
          state.settings.filename ?? ''
        )
    );
    return undefined;
  };
  return {
    getText(hash, source, { maxChars }, quasi) {
      const text = translations ? translations[hash] : source;
      if (typeof text !== 'string') return undefined;
      if (maxChars !== undefined) {
        // An embedded template still has its text replaced
        return translations
          ? undefined
          : keep(
              `Kept template ${hash} as a call: maxChars cuts its text off at runtime`,
              quasi
            );
      }
      state.statistics.sourceReplacementsCount += 1;
      return text;
    },
    replaceTemplate: translations
      ? (hash, quasi) => {
          if (translations[hash] === undefined) return undefined;
          const replacement = replaceTemplateSource(quasi, translations[hash]);
          if (replacement.quasi) {
            state.statistics.sourceReplacementsCount += 1;
            return replacement.quasi;
          }
          return keep(
            `Kept the source of template ${hash}, with its embedded translation: ${replacement.reason}`,
            quasi
          );
        }
      : undefined,
  };
}

/** Whether a file imports an unstable source, so the pass can be skipped. */
export function importsUnstableSource(ast: t.File): boolean {
  return ast.program.body.some(
    (statement) =>
      t.isImportDeclaration(statement) &&
      isUnstableGTImportSource(statement.source.value)
  );
}
