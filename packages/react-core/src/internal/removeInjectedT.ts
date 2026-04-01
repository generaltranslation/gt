import { isAcceptedPluralForm } from 'generaltranslation/internal';
import {
  TransformationPrefix,
  VariableInjectionType,
} from 'generaltranslation/types';
import {
  ReactNode,
  ReactElement,
  isValidElement,
  cloneElement,
  Children,
} from 'react';

/**
 * Remove injected _T components at runtime. This is only for i18n-context T components to use.
 * This is necessary because when dealing with deriving fragmented content. The compiler will always
 * inject a `_T` component.
 *
 * Only remove if within a `<Derive>` or `<Static>` component as this scopes this behavior
 * to only where it can actually appear.
 */
export function removeInjectedT(children: ReactNode): ReactNode {
  return handleChildren(children, 0);
}

// ----- Core Logic ----- //

/**
 * Traverses a single child element and removes the injected _T component.
 * @param child - The child element to traverse.
 * @param derivationDepth - The depth of the derivation.
 * @returns The traversed child element.
 *
 * Derivation depth is used for tracking whether or not to apply the _T removal transformation.
 *
 * Rules:
 * 1. Variable components (Var, Num, Currency, DateTime) - hands off
 * 2. Branching components (Branch, Plural) - explore respective branches
 * 3. Derivation components (Derive, Static) - add/remove derivation depth
 * 4. Translation components (T) - remove _T if within a derivation context
 * 5. Then move on to processing the element's children
 */
function handleSingleChildElement(
  child: ReactElement,
  derivationDepth: number
): ReactNode {
  const { type: elementType, props: elementProps } = child;
  const transformation = getTransformation(elementType);
  if (typeof elementProps !== 'object' || elementProps === null) {
    // TODO: gracefully fail + warn here
    throw new Error(
      'DEBUG: handleSingleChildElement - encountered an element with props that cannot be processed'
    );
    // return child;
  }

  if (transformation) {
    const { componentType, injectionType } = transformation;

    // (1) If the element is a variable component, hands off
    if (componentType === 'variable') {
      return child;
    }

    // (2) If the element is a branching component, explore respective branches
    else if (componentType === 'branch') {
      // Traverse into each branch (this also includes the children property)
      const newProps = Object.entries(elementProps).reduce<
        Record<string, unknown>
      >((acc, [branchName, branch]) => {
        if (branchName !== 'branch' && !branchName.startsWith('data-')) {
          acc[branchName] = handleSingleChild(branch, derivationDepth);
        } else {
          // Skip recursion on non-translated branches
          acc[branchName] = branch;
        }
        return acc;
      }, {});

      return cloneElement(child, {
        ...newProps,
      });
    } else if (componentType === 'plural') {
      // Traverse into each branch (this also includes the children property)
      const newProps = Object.entries(elementProps).reduce<
        Record<string, unknown>
      >((acc, [branchName, branch]) => {
        if (isAcceptedPluralForm(branchName)) {
          acc[branchName] = handleSingleChild(branch, derivationDepth);
        } else {
          // Skip Recursion on non-translated branches
          acc[branchName] = branch;
        }
        return acc;
      }, {});

      return cloneElement(child, {
        ...newProps,
      });
    }

    // (3) If the element is a derivation component, add/remove derivation depth
    else if (componentType === 'derive') {
      return cloneElement(child, {
        ...elementProps,
        ...('children' in elementProps && {
          children: handleChildren(
            elementProps.children as ReactNode,
            derivationDepth + 1
          ),
        }),
      });
    }

    // (4) If the element is a translation component, remove _T if within a derivation context, just return the children
    else if (
      componentType === 'translate' &&
      injectionType === 'automatic' &&
      derivationDepth > 0
    ) {
      return 'children' in elementProps
        ? handleChildren(elementProps.children as ReactNode, derivationDepth)
        : undefined;
    } else if (componentType === 'translate' && injectionType === 'manual') {
      // TODO: remove
      console.warn(
        `DEBUG: removeInjectedT - found a ${injectionType} <${injectionType === 'manual' ? 'T' : '_T'}> component as a child of a <T> or <_T> component`
      );
    } else if (componentType === 'translate' && derivationDepth === 0) {
      // TODO: gracefully fail
      throw new Error(
        'DEBUG: removeInjectedT - encountered an injected <T> component that was not inside of a <Derive> context. This is a bug in the compiler.'
      );
    }
  }

  // (5) Recurse into children
  return cloneElement(child, {
    ...elementProps,
    ...('children' in elementProps && {
      children: handleChildren(
        elementProps.children as ReactNode,
        derivationDepth
      ),
    }),
  });
}

// ----- Traversal ----- //

/**
 * Traverses a single child react node and removes the injected _T component.
 */
function handleSingleChild(
  child: ReactNode,
  derivationDepth: number
): ReactNode {
  if (isValidElement(child)) {
    return handleSingleChildElement(child, derivationDepth);
  }
  return child;
}

/**
 * Traverses an array of children and removes the injected _T component.
 *
 */
function handleChildren(
  children: ReactNode,
  derivationDepth: number
): ReactNode {
  if (Array.isArray(children)) {
    return Children.map(children, (child) =>
      handleSingleChild(child, derivationDepth)
    );
  }
  return handleSingleChild(children, derivationDepth);
}

// ----- Helper Functions ----- //

/**
 * Extracts the transformation from the element type.
 * @param elementType - The element type to extract the transformation from.
 * @returns The transformation.
 */
function getTransformation(elementType: ReactElement['type']):
  | {
      componentType: TransformationPrefix;
      injectionType: VariableInjectionType;
    }
  | undefined {
  // Extract transformation string
  const transformation =
    typeof elementType === 'function' && '_gtt' in elementType
      ? elementType._gtt
      : undefined;
  if (transformation == null || typeof transformation !== 'string')
    return undefined;

  // Extract metadata from transformation string
  const parts = transformation.split('-');
  const componentType = parts[0] as TransformationPrefix;
  const injectionType =
    parts[1] === 'automatic' || parts[2] === 'automatic'
      ? 'automatic'
      : 'manual';

  return {
    componentType,
    injectionType,
  };
}
