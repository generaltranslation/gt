import { isAcceptedPluralForm } from 'generaltranslation/internal';
import {
  ReactNode,
  ReactElement,
  isValidElement,
  cloneElement,
  Children,
} from 'react';
import { getMarker } from '../marker';

/**
 * Remove injected _T components at runtime. This is only for i18n-context T components to use.
 * This is necessary because when dealing with deriving fragmented content. The compiler will always
 * inject a `_T` component.
 *
 * Only remove if within a `<Derive>` component as this scopes this behavior
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
 * 2. Branching components (Select, Plural) - explore respective branches
 * 3. Derivation components (Derive) - add/remove derivation depth
 * 4. Translation components (T) - remove _T if within a derivation context
 * 5. Then move on to processing the element's children
 */
function handleSingleChildElement(
  child: ReactElement<object>,
  derivationDepth: number
): ReactNode {
  const { type: elementType, props: elementProps } = child;
  const marker = getMarker(elementType);

  if (marker) {
    const { kind, automatic } = marker;

    // (1) If the element is a variable component, hands off
    if (kind === 'variable') {
      return child;
    }

    // (2) If the element is a branching component, explore respective branches
    else if (kind === 'select') {
      // Traverse into each branch
      const newProps = Object.entries(elementProps).reduce<
        Record<string, unknown>
      >((acc, [branchName, branch]) => {
        if (branchName !== 'value' && !branchName.startsWith('data-')) {
          acc[branchName] = handleChildren(
            branch as ReactNode,
            derivationDepth
          );
        } else {
          // Skip recursion on non-translated branches
          acc[branchName] = branch;
        }
        return acc;
      }, {});

      return cloneElement(child, {
        ...newProps,
      });
    } else if (kind === 'plural' || kind === 'ordinal') {
      // Traverse into each branch
      const newProps = Object.entries(elementProps).reduce<
        Record<string, unknown>
      >((acc, [branchName, branch]) => {
        // The children are the fallback branch.
        if (isAcceptedPluralForm(branchName) || branchName === 'children') {
          acc[branchName] = handleChildren(
            branch as ReactNode,
            derivationDepth
          );
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
    else if (kind === 'derive') {
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
    else if (kind === 'translate' && automatic && derivationDepth > 0) {
      return 'children' in elementProps
        ? handleChildren(elementProps.children as ReactNode, derivationDepth)
        : undefined;
    }

    // Note: kind === 'translate': means that there is a <_T> inside of a <T>/<_T>
    else if (kind === 'translate' && automatic) {
      console.warn(warnNestedInternalTComponent);
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
  // React element props are always an object.
  if (isValidElement<object>(child)) {
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

const warnNestedInternalTComponent = `'@generaltranslation/react-core Warning: A <_T> component was found injected outside of a <Derive> boundary. This may affect translation resolution for this component.`;
