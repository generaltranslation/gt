import { TraverseOptions } from '@babel/traverse';
import * as t from '@babel/types';
import { isGTMessageImportSource } from 'generaltranslation/internal';
import { TransformState } from '../state/types';
import { injectTaggedTemplateHash } from '../transform/injection/injectTaggedTemplateHash';
import {
  keepUnsplit,
  recordChunkHash,
} from '../transform/chunk-translations/chunkTranslationsModule';

/**
 * Tagged template hash injection pass — injects `$_hash` into statically
 * analyzable tagged templates (t`...`). Each template is hashed and rewritten
 * in the same visit, so this pass needs no collection counters.
 */
export function taggedTemplateHashInjectionPass(
  state: TransformState
): TraverseOptions {
  // A build with chunk translations splits t templates by chunk; m() renders
  // a msg away from its call site, so its translation stays unsplit
  const onHash = state.settings.chunkTranslations
    ? (hash: string, isMsg: boolean) =>
        isMsg ? keepUnsplit(hash, state) : recordChunkHash(hash, state)
    : undefined;
  return {
    TaggedTemplateExpression(path) {
      if (injectTaggedTemplateHash(path, onHash)) {
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
