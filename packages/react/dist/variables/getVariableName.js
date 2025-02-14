const defaultVariableNames = {
    variable: "value",
    number: "n",
    datetime: "date",
    currency: "cost",
};
export function getFallbackVariableName(variableType = "variable") {
    return defaultVariableNames[variableType] || "variable";
}
export const baseVariablePrefix = "_gt_";
export default function getVariableName(props = {}, variableType) {
    var _a;
    if (props.name)
        return props.name;
    if (props["data-_gt-variable-name"])
        return props["data-_gt-variable-name"];
    const baseVariableName = defaultVariableNames[variableType] || "value";
    return `${baseVariablePrefix}${baseVariableName}_${(_a = props["data-_gt"]) === null || _a === void 0 ? void 0 : _a.id}`;
}
