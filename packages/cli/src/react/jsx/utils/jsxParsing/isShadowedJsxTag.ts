import { NodePath } from '@babel/traverse';

/**
 * A tag name that an enclosing scope rebinds (a parameter, or a local variable
 * declared in the function or block) renders that binding, not the GT import.
 * Import names live on the module scope, so any other binding kind shadows it.
 */
export function isShadowedJsxTag(path: NodePath, typeName: string): boolean {
  const binding = path.scope.getBinding(typeName);
  return binding !== undefined && binding.kind !== 'module';
}
