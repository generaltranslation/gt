import { TraverseOptions } from '@babel/traverse';
import * as t from '@babel/types';
import { isUnstableGTImportSource } from 'generaltranslation/internal';
import { TransformState } from '../state/types';
import { injectUnstableTaggedTemplateHash } from '../transform/injection/injectUnstableTaggedTemplateHash';

/**
 * Unstable hash injection pass — injects `$_hash` into statically analyzable
 * unstable tagged templates (gt`...`). Each template is hashed and rewritten
 * in the same visit, so this pass needs no collection counters.
 */
export function unstableHashInjectionPass(
  state: TransformState
): TraverseOptions {
  return {
    TaggedTemplateExpression(path) {
      if (injectUnstableTaggedTemplateHash(path)) {
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
