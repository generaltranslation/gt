import { ArrayOfObjectsInputProps } from 'sanity';

/**
 * v1 input for generated `internationalizedArray*` fields.
 *
 * Intentionally minimal: it renders Sanity's default array input so editors can
 * inspect and edit each locale's value directly, while the generated schema
 * keeps the `language` field read-only. Richer UX (one section per locale,
 * source first, auto-created source row, status badges, copy-from-source,
 * single-field translate) is deferred to a follow-up — this component is the
 * wiring point those features will grow into.
 */
export function InternationalizedArrayInput(props: ArrayOfObjectsInputProps) {
  return props.renderDefault(props);
}
