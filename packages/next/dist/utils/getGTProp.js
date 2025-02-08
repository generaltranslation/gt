'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.default = getGTProp;
function getGTProp(child) {
  var _a;
  if (
    child &&
    typeof child === 'object' &&
    ((_a = child.props) === null || _a === void 0 ? void 0 : _a['data-_gt'])
  ) {
    return child.props['data-_gt'];
  }
  return null;
}
//# sourceMappingURL=getGTProp.js.map
