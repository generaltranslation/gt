/**
 * Equivalent to the `<Var>` component, but used for auto insertion
 */
export function GtInternalVarJsx({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return <Var>{children}</Var>;
}
