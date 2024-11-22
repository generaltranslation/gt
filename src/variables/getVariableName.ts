import getGTProp from "../provider/helpers/getGTProp";

const defaultVariableNames: {
    "variable": "value",
    "number": "n",
    "datetime": "date",
    "currency": "cost"
} = {
    "variable": "value",
    "number": "n",
    "datetime": "date",
    "currency": "cost"
};

export function getFallbackVariableName(variableType: string = "variable"): string {
    return (defaultVariableNames as any)[variableType] || "variable";
}

export default function getVariableName(props: Record<string, any> = {}, variableType: string): string {
    if (props.name) return props.name;
    if (props['data-_gt-variable-name']) return props['data-_gt-variable-name'];
    const baseVariableName = (defaultVariableNames as any)[variableType] || "value";
    return `_gt_${baseVariableName}_${props['data-_gt'].id}`
}