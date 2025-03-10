"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = getEntryAndMetadata;
function getEntryAndMetadata(value) {
    if (Array.isArray(value)) {
        if (value.length === 1) {
            return { entry: value[0] };
        }
        if (value.length === 2) {
            return { entry: value[0], metadata: value[1] };
        }
    }
    return { entry: value };
}
