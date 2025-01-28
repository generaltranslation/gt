"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleChildrenWhitespace = void 0;
exports.trimJsxStringChild = trimJsxStringChild;
function trimJsxStringChild(child, index, childrenTypes) {
    // Normalize line endings to \n for consistency across platforms
    let result = child.replace(/\r\n|\r/g, '\n');
    // Collapse multiple spaces/tabs into a single space
    result = result.replace(/[\t ]+/g, ' ');
    // If it's the first child, trim the start
    if (index === 0) {
        result = result.trimStart();
    }
    // If it's the last child, trim the end
    if (index === childrenTypes.length - 1) {
        result = result.trimEnd();
    }
    let newResult = '';
    let newline = false;
    for (const char of result) {
        if (char === '\n') {
            if (newResult.trim())
                newResult += ' ';
            else
                newResult = '';
            newline = true;
            continue;
        }
        if (!newline) {
            newResult += char;
            continue;
        }
        if (char.trim() === '')
            continue;
        newResult += char;
        newline = false;
    }
    if (newline)
        newResult = newResult.trimEnd();
    result = newResult;
    // Collapse multiple spaces/tabs into a single space
    result = result.replace(/[\t ]+/g, ' ');
    return result;
}
/**
 * Handles whitespace in children of a JSX element.
 * @param currentTree - The current tree to handle
 * @returns The processed tree with whitespace handled
 */
const handleChildrenWhitespace = (currentTree) => {
    var _a;
    if (Array.isArray(currentTree)) {
        const childrenTypes = currentTree.map((child) => {
            if (typeof child === 'string')
                return 'text';
            if (typeof child === 'object' && 'expression' in child)
                return 'expression';
            return 'element';
        });
        const newChildren = [];
        currentTree.forEach((child, index) => {
            if (childrenTypes[index] === 'text') {
                const string = trimJsxStringChild(child, index, childrenTypes);
                if (string)
                    newChildren.push(string);
            }
            else if (childrenTypes[index] === 'expression') {
                newChildren.push(child.result);
            }
            else {
                newChildren.push((0, exports.handleChildrenWhitespace)(child));
            }
        });
        return newChildren.length === 1 ? newChildren[0] : newChildren;
    }
    else if ((_a = currentTree === null || currentTree === void 0 ? void 0 : currentTree.props) === null || _a === void 0 ? void 0 : _a.children) {
        const currentTreeChildren = (0, exports.handleChildrenWhitespace)(currentTree.props.children);
        return Object.assign(Object.assign({}, currentTree), { props: Object.assign(Object.assign({}, currentTree.props), (currentTreeChildren && { children: currentTreeChildren })) });
    }
    else if (typeof currentTree === 'object' &&
        'expression' in currentTree === true) {
        return currentTree.result;
    }
    else if (typeof currentTree === 'string') {
        return trimJsxStringChild(currentTree, 0, ['text']);
    }
    return currentTree;
};
exports.handleChildrenWhitespace = handleChildrenWhitespace;
