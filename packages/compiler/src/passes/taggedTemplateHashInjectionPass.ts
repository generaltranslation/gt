import { TraverseOptions } from '@babel/traverse';
import * as t from '@babel/types';
import { isGTMessageImportSource } from 'generaltranslation/internal';
import { TransformState } from '../state/types';
import { injectTaggedTemplateHash } from '../transform/injection/injectTaggedTemplateHash';

/**
 * Tagged template hash injection pass — injects `$_hash` into statically
 * analyzable tagged templates (t`...`). Each template is hashed and rewritten
 * in the same visit, so this pass needs no collection counters.
 */
export function taggedTemplateHashInjectionPass(
  state: TransformState
): TraverseOptions {
  return {
    TaggedTemplateExpression(path) {
      if (injectTaggedTemplateHash(path)) {
        state.statistics.taggedTemplateHashInjectionsCount += 1;
      }
    },
  };
}

/** Whether a file imports a message helper source, so the pass can be skipped. */
export function importsMessageSource(ast: t.File): boolean {
  return ast.program.body.some(
    (statement) =>
      t.isImportDeclaration(statement) &&
      isGTMessageImportSource(statement.source.value)
  );
}
