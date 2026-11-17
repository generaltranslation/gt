import { TraverseOptions } from '@babel/traverse';
import * as t from '@babel/types';
import { isUnstableGTImportSource } from 'generaltranslation/internal';
import { TransformState } from '../state/types';
import { injectUnstableTaggedTemplateHash } from '../transform/injection/injectUnstableTaggedTemplateHash';
import { buildInlineTranslations } from '../transform/injection/inline-translations/injectInlineTranslations';
import { replaceTemplateSource } from '../transform/injection/inline-translations/replaceTemplateSource';
import { createErrorLocation } from '../utils/errors';

/**
 * Unstable hash injection pass — injects `$_hash` into statically analyzable
 * unstable tagged templates (gt`...`), and in production builds with
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
  const { sourceReplacement, inlineTranslationsTable } = state.settings;
  const translations =
    sourceReplacement && inlineTranslationsTable?.[sourceReplacement.locale];
  const replaceSource = translations
    ? (hash: string, quasi: t.TemplateLiteral) => {
        if (translations[hash] === undefined) return undefined;
        const replacement = replaceTemplateSource(quasi, translations[hash]);
        if (replacement.quasi) {
          state.statistics.sourceReplacementsCount += 1;
          return replacement.quasi;
        }
        state.statistics.sourceReplacementFallbacksCount += 1;
        state.logger.logDebug(
          `Kept the source of template ${hash}, with its embedded translation: ${replacement.reason}` +
            createErrorLocation(quasi).replace(
              '{filename}',
              state.settings.filename ?? ''
            )
        );
        return undefined;
      }
    : undefined;
  return {
    TaggedTemplateExpression(path) {
      if (injectUnstableTaggedTemplateHash(path, buildInline, replaceSource)) {
        state.statistics.unstableHashInjectionsCount += 1;
      }
    },
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
