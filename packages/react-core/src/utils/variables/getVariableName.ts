import { report } from '../plurals/getPluralBranch';

const baseVariablePrefix = '_gt_';

export function getVariableName(props: Record<string, unknown> = {}): string {
  if (typeof props.name === 'string') {
    if (props.name.startsWith(baseVariablePrefix)) {
      report({
        whatHappened: `A variable name starts with the reserved "${baseVariablePrefix}" prefix`,
        fix: 'Pick another name',
        rendered: 'The variable was rendered under that name',
        details: `name: ${props.name}`,
      });
    }
    return props.name;
  }
  const gtTag = props['data-_gt'] as { id?: number } | undefined;
  return `${baseVariablePrefix}${gtTag?.id}`;
}
