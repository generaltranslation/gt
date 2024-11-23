"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Plural = exports.Branch = exports.DateTime = exports.Currency = exports.Num = exports.Var = exports.useElement = exports.T = exports.GTProvider = void 0;
var Var_1 = __importDefault(require("./variables/Var"));
exports.Var = Var_1.default;
var Num_1 = __importDefault(require("./variables/Num"));
exports.Num = Num_1.default;
var Currency_1 = __importDefault(require("./variables/Currency"));
exports.Currency = Currency_1.default;
var DateTime_1 = __importDefault(require("./variables/DateTime"));
exports.DateTime = DateTime_1.default;
var getGT_1 = require("./server/getGT");
Object.defineProperty(exports, "useElement", { enumerable: true, get: function () { return getGT_1.useElement; } });
var GTProvider_1 = __importDefault(require("./provider/GTProvider"));
exports.GTProvider = GTProvider_1.default;
var T_1 = __importDefault(require("./server/inline/T"));
exports.T = T_1.default;
var Branch_1 = __importDefault(require("./branches/Branch"));
exports.Branch = Branch_1.default;
var Plural_1 = __importDefault(require("./branches/Plural"));
exports.Plural = Plural_1.default;
//# sourceMappingURL=index.server.js.map