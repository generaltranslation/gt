"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDict = exports.getLocale = exports.Tx = exports.tx = exports.getGT = exports.T = exports.GTProvider = void 0;
exports.getDefaultLocale = getDefaultLocale;
var T_1 = __importDefault(require("./server-dir/buildtime/T"));
exports.T = T_1.default;
var tx_1 = __importDefault(require("./server-dir/runtime/tx"));
exports.tx = tx_1.default;
var getLocale_1 = __importDefault(require("./request/getLocale"));
exports.getLocale = getLocale_1.default;
var getI18NConfig_1 = __importDefault(require("./config-dir/getI18NConfig"));
var getDict_1 = __importDefault(require("./server-dir/buildtime/getDict"));
exports.getDict = getDict_1.default;
var GTProvider_1 = __importDefault(require("./provider/GTProvider"));
exports.GTProvider = GTProvider_1.default;
var _Tx_1 = __importDefault(require("./server-dir/runtime/_Tx"));
exports.Tx = _Tx_1.default;
var getGT_1 = __importDefault(require("./server-dir/buildtime/getGT"));
exports.getGT = getGT_1.default;
function getDefaultLocale() {
    return (0, getI18NConfig_1.default)().getDefaultLocale();
}
//# sourceMappingURL=server.js.map