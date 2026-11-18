import { TraverseOptions } from '@babel/traverse';
import * as t from '@babel/types';
import { isUnstableGTImportSource } from 'generaltranslation/internal';
import { TransformState } from '../state/types';
import { injectUnstableTaggedTemplateHash } from '../transform/injection/injectUnstableTaggedTemplateHash';
import { buildInlineTranslations } from '../transform/injection/inline-translations/injectInlineTranslations';

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
  return {
    TaggedTemplateExpression(path) {
      if (injectUnstableTaggedTemplateHash(path, buildInline)) {
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
