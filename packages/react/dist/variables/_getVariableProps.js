import getVariableName from "./getVariableName";
export default function getVariableProps(props) {
    var _a;
    const variableType = ((_a = props["data-_gt"]) === null || _a === void 0 ? void 0 : _a.variableType) || "variable";
    const result = {
        variableType,
        variableName: getVariableName(props, variableType),
        variableValue: (() => {
            if (typeof props.value !== "undefined")
                return props.value;
            if (typeof props["data-_gt-unformatted-value"] !== "undefined")
                return props["data-_gt-unformatted-value"];
            if (typeof props.children !== "undefined")
                return props.children;
            return undefined;
        })(),
        variableOptions: (() => {
            const variableOptions = Object.assign(Object.assign({}, (props.currency && { currency: props.currency })), (props.options && Object.assign({}, props.options)));
            if (Object.keys(variableOptions).length)
                return variableOptions;
            if (typeof props["data-_gt-variable-options"] === "string")
                return JSON.parse(props["data-_gt-variable-options"]);
            return props["data-_gt-variable-options"] || undefined;
        })(),
    };
    return result;
}
