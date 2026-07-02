import {
  baseVariablePrefix,
  getVariableName as getVariableNameBase,
} from 'gt-i18n/internal';
import type { VariableTransformationSuffix } from 'generaltranslation/types';

export { baseVariablePrefix };

export function getVariableName(
  props: Record<string, unknown> = {},
  variableType: VariableTransformationSuffix
): string {
  const gtTag = props['data-_gt'] as { id?: number } | undefined;
  return getVariableNameBase(props, variableType, gtTag?.id);
}
