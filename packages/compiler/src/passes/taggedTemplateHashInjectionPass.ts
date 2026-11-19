import { TraverseOptions } from '@babel/traverse';
import * as t from '@babel/types';
import { isGTMessageImportSource } from 'generaltranslation/internal';
import { TransformState } from '../state/types';
import { injectTaggedTemplateHash } from '../transform/injection/injectTaggedTemplateHash';
import type { MessageTree } from '@generaltranslation/icu';
import {
  keepUnsplit,
  recordChunkHash,
  recordRuntimeReader,
} from '../transform/chunk-translations/chunkTranslationsModule';

/**
 * Tagged template hash injection pass — injects `$_hash` into statically
 * analyzable tagged templates (t`...`). Each template is hashed and rewritten
 * in the same visit, so this pass needs no collection counters. With
 * `precomputeMessages`, a static t template is replaced by a call that
 * passes its precomputed message. `findPrecompute` decides that where the
 * option is left out: it is asked once, at the file's first static t
 * template, since every file that imports a GT entry runs this pass.
 */
export function taggedTemplateHashInjectionPass(
  state: TransformState,
  findPrecompute?: () => boolean
): TraverseOptions {
  // A build with chunk translations splits t templates by chunk; m() renders
  // a msg away from its call site, so its translation stays unsplit
  const onHash = state.settings.chunkTranslations
    ? (hash: string, isMsg: boolean, tree: MessageTree) => {
        if (!isMsg) return recordChunkHash(hash, state, tree);
        keepUnsplit(hash, state);
        return hash;
      }
    : undefined;
  // A build with short ids keeps what a template hashed at runtime can read
  const onRuntimeTree = state.settings.chunkTranslations?.runtimeReaders
    ? (tree: MessageTree | undefined) => recordRuntimeReader(tree, state)
    : undefined;
  let found: boolean | undefined;
  const precompute = findPrecompute
    ? () => (found ??= findPrecompute())
    : () => state.settings.precomputeMessages;
  return {
    TaggedTemplateExpression(path) {
      if (injectTaggedTemplateHash(path, onHash, precompute, onRuntimeTree)) {
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
