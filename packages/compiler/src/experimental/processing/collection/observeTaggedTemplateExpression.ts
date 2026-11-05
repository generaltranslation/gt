import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import type { TransformState } from '../../../state/types';
import { transformTemplateLiteral } from '../../../transform/macro-expansion/transformTemplateLiteral';
import { isStringTranslationTaggedTemplate } from '../../../utils/parsing/isStringTranslationTaggedTemplate';
import type { LocaleTwinCollector } from '../../state/LocaleTwinCollector';

/**
 * Records a t`...` tagged template the regular collection pass just visited
 * (`processing/collection/processTaggedTemplateExpression.ts`, keep in sync).
 * Tagged templates are never hash-injected, so they cannot be looked up by
 * hash once stripped: they are hashed at runtime (`taggedTemplate`, or
 * `derive` when the message contains derive()).
 */
export function observeTaggedTemplateExpression(
  path: NodePath<t.TaggedTemplateExpression>,
  state: TransformState,
  collector: LocaleTwinCollector
): void {
  if (
    !isStringTranslationTaggedTemplate(
      path,
      state.settings.stringTranslationMacro
    )
  ) {
    return;
  }
  const { content, errors } = transformTemplateLiteral(path.get('quasi'));
  const message = content[0]?.message;
  if (errors.length > 0 || message == null) return;
  collector.addRuntimeHashed({
    api: 't',
    reason: t.isStringLiteral(message) ? 'taggedTemplate' : 'derive',
    node: path.node,
  });
}
