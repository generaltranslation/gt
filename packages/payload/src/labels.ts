// A Payload config label as plain text: the string, or the English entry of a
// label given per admin language. Undefined for labels given as functions.
export function labelText(label: unknown): string | undefined {
  if (typeof label === 'string') return label;
  if (!label || typeof label !== 'object') return undefined;
  const labels = label as Record<string, unknown>;
  const text = labels.en ?? Object.values(labels)[0];
  return typeof text === 'string' ? text : undefined;
}
