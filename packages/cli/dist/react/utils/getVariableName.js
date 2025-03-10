"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.baseVariablePrefix = void 0;
exports.getVariableName = getVariableName;
const defaultVariableNames = {
    variable: 'value',
    number: 'n',
    datetime: 'date',
    currency: 'cost',
};
exports.baseVariablePrefix = '_gt_';
function getVariableName(props = {}, variableType) {
    var _a;
    if (props.name)
        return props.name;
    if (props['data-_gt-variable-name'])
        return props['data-_gt-variable-name'];
    const baseVariableName = defaultVariableNames[variableType] || 'value';
    return `${exports.baseVariablePrefix}${baseVariableName}_${(_a = props['data-_gt']) === null || _a === void 0 ? void 0 : _a.id}`;
}
