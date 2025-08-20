/**
 * Given an ISO string, validates that all the variables are present
 * @deprecated
 */
export function validateString(
  string: string,
  variables: Record<string, string>
) {
  const variableNames = string.match(/{([^}]+)}/g);
  if (!variableNames) return true;

  for (const variableName of Object.keys(variables)) {
    if (variables[variableName] === undefined) return false;
  }
  return true;
}
