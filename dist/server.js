"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLocale = exports.tx = exports.T = void 0;
exports.getDefaultLocale = getDefaultLocale;
var T_1 = __importDefault(require("./server/inline/T"));
exports.T = T_1.default;
var tx_1 = __importDefault(require("./server/strings/tx"));
exports.tx = tx_1.default;
var getLocale_1 = __importDefault(require("./request/getLocale"));
exports.getLocale = getLocale_1.default;
var getI18NConfig_1 = __importDefault(require("./utils/getI18NConfig"));
function getDefaultLocale() {
    return (0, getI18NConfig_1.default)().getDefaultLocale();
}
//# sourceMappingURL=server.js.map