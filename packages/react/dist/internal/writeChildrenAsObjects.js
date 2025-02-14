import getVariableName from "../variables/getVariableName";
import { isValidTaggedElement } from "../utils/utils";
/**
 * Gets the tag name of a React element.
 * @param {ReactElement} child - The React element.
 * @returns {string} - The tag name of the React element.
 */
const getTagName = (child) => {
    var _a;
    if (!child)
        return "";
    const { type, props } = child;
    if (type && typeof type === "function") {
        if ("displayName" in type &&
            typeof type.displayName === "string" &&
            type.displayName)
            return type.displayName;
        if ("name" in type && typeof type.name === "string" && type.name)
            return type.name;
    }
    if (type && typeof type === "string")
        return type;
    if (props.href)
        return "a";
    if ((_a = props["data-_gt"]) === null || _a === void 0 ? void 0 : _a.id)
        return `C${props["data-_gt"].id}`;
    return "function";
};
const handleSingleChildElement = (child) => {
    const { type, props } = child;
    let objectElement = {
        type: getTagName(child),
        props: {},
    };
    if (props["data-_gt"]) {
        const generaltranslation = props["data-_gt"];
        let newGTProp = Object.assign({}, generaltranslation);
        const transformation = generaltranslation.transformation;
        if (transformation === "variable") {
            const variableType = generaltranslation.variableType || "variable";
            const variableName = getVariableName(props, variableType);
            return {
                variable: variableType,
                key: variableName,
                id: generaltranslation.id,
            };
        }
        if (transformation === "plural" && generaltranslation.branches) {
            objectElement.type = "Plural";
            let newBranches = {};
            Object.entries(generaltranslation.branches).forEach(([key, value]) => {
                newBranches[key] = writeChildrenAsObjects(value);
            });
            newGTProp = Object.assign(Object.assign({}, newGTProp), { branches: newBranches });
        }
        if (transformation === "branch" && generaltranslation.branches) {
            objectElement.type = "Branch";
            let newBranches = {};
            Object.entries(generaltranslation.branches).forEach(([key, value]) => {
                newBranches[key] = writeChildrenAsObjects(value);
            });
            newGTProp = Object.assign(Object.assign({}, newGTProp), { branches: newBranches });
        }
        objectElement.props["data-_gt"] = newGTProp;
    }
    if (props.children) {
        objectElement.props.children = writeChildrenAsObjects(props.children);
    }
    return objectElement;
};
const handleSingleChild = (child) => {
    if (isValidTaggedElement(child)) {
        return handleSingleChildElement(child);
    }
    if (typeof child === "number")
        return child.toString();
    return child;
};
/**
 * Transforms children elements into objects, processing each child recursively if needed.
 * @param {Children} children - The children to process.
 * @returns {object} The processed children as objects.
 */
export default function writeChildrenAsObjects(children) {
    return Array.isArray(children)
        ? children.map(handleSingleChild)
        : handleSingleChild(children);
}
