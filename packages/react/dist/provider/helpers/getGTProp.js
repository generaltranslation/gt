"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = getGTProp;
function getGTProp(child) {
    if (child && child.props && child.props["data-_gt"]) {
        return child.props["data-_gt"];
    }
    return null;
}
//# sourceMappingURL=getGTProp.js.map