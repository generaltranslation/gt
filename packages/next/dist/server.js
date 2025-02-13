"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useElement = exports.getGT = exports.getLocale = exports.tx = exports.TX = exports.T = void 0;
exports.getDefaultLocale = getDefaultLocale;
var T_1 = __importDefault(require("./server-dir/inline/T"));
exports.T = T_1.default;
var tx_1 = __importDefault(require("./server-dir/strings/tx"));
exports.tx = tx_1.default;
var getLocale_1 = __importDefault(require("./request/getLocale"));
exports.getLocale = getLocale_1.default;
var getI18NConfig_1 = __importDefault(require("./config-dir/getI18NConfig"));
var getGT_1 = require("./server-dir/getGT");
Object.defineProperty(exports, "getGT", { enumerable: true, get: function () { return getGT_1.getGT; } });
var useElement_1 = __importDefault(require("./server-dir/useElement"));
exports.useElement = useElement_1.default;
var TX_1 = __importDefault(require("./server-dir/inline/TX"));
exports.TX = TX_1.default;
function getDefaultLocale() {
    return (0, getI18NConfig_1.default)().getDefaultLocale();
}
//# sourceMappingURL=server.js.map