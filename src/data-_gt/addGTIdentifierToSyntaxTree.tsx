import { getVariableName } from "gt-react/internal";
import { isAcceptedPluralForm, pluralForms } from "generaltranslation/internal";

// recreates addGTIdentifier and writeChildrenAsObjects
export default function addGTIdentifierToSyntaxTree(
  tree: any,
  startingIndex = 0
) {
  // Object to keep track of the current index for GT IDs
  let indexObject: { index: number } = { index: startingIndex };

  const handleSingleChild = (child: any) => {
    if (child && typeof child === "object") {
      const { type, props } = child;
      indexObject.index += 1;

      let generaltranslation: any = { id: indexObject.index };

      if (type === "Var") {
        return {
          variable: "variable",
          key: getVariableName(
            { ...props, "data-_gt": generaltranslation },
            "variable"
          ),
        };
      } else if (type === "Num") {
        return {
          variable: "number",
          key: getVariableName(
            { ...props, "data-_gt": generaltranslation },
            "number"
          ),
        };
      } else if (type === "Currency") {
        return {
          variable: "currency",
          key: getVariableName(
            { ...props, "data-_gt": generaltranslation },
            "currency"
          ),
        };
      } else if (type === "DateTime") {
        return {
          variable: "datetime",
          key: getVariableName(
            { ...props, "data-_gt": generaltranslation },
            "datetime"
          ),
        };
      }

      if (type === "Plural") {
        generaltranslation.transformation = "plural";
        const pluralBranches = Object.entries(props).reduce(
          (acc, [branchName, branch]) => {
            if (isAcceptedPluralForm(branchName)) {
              (acc as Record<string, any>)[branchName] =
                addGTIdentifierToSyntaxTree(branch as any, indexObject.index);
            }
            return acc;
          },
          {}
        );
        if (Object.keys(pluralBranches).length)
          generaltranslation.branches = pluralBranches;
      } else if (type === "Branch") {
        generaltranslation.transformation = "branch";
        const { children, branch, ...branches } = props;
        const resultBranches = Object.entries(branches).reduce(
          (acc, [branchName, branch]) => {
            (acc as Record<string, any>)[branchName] =
              addGTIdentifierToSyntaxTree(branch as any, indexObject.index);
            return acc;
          },
          {}
        );
        if (Object.keys(resultBranches).length)
          generaltranslation.branches = resultBranches;
      }

      return {
        type: type || `C${generaltranslation.id}`,
        props: {
          "data-_gt": generaltranslation,
          ...(typeof props.children !== "undefined" && {
            children: handleChildren(props.children),
          }),
        },
      };
    }
    return child.toString();
  };

  const handleChildren = (children: any): any => {
    return Array.isArray(children)
      ? children.map(handleSingleChild)
      : handleSingleChild(children);
  };

  return handleChildren(tree);
}
