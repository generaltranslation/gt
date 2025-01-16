"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Plural = exports.Branch = exports.DateTime = exports.Currency = exports.Num = exports.Var = exports.useElement = exports.T = void 0;
exports.GTProvider = GTProvider;
var gt_react_1 = require("gt-react");
Object.defineProperty(exports, "useElement", { enumerable: true, get: function () { return gt_react_1.useElement; } });
Object.defineProperty(exports, "Var", { enumerable: true, get: function () { return gt_react_1.Var; } });
Object.defineProperty(exports, "Num", { enumerable: true, get: function () { return gt_react_1.Num; } });
Object.defineProperty(exports, "Currency", { enumerable: true, get: function () { return gt_react_1.Currency; } });
Object.defineProperty(exports, "DateTime", { enumerable: true, get: function () { return gt_react_1.DateTime; } });
Object.defineProperty(exports, "T", { enumerable: true, get: function () { return gt_react_1.T; } });
Object.defineProperty(exports, "Branch", { enumerable: true, get: function () { return gt_react_1.Branch; } });
Object.defineProperty(exports, "Plural", { enumerable: true, get: function () { return gt_react_1.Plural; } });
function GTProvider(params) {
    throw new Error("You're attempting to import <GTProvider> on the client. "
        + "Are you sure you want to do this? It's better to import <GTProvider> in a file not marked 'use client' so that it can fetch translations on the server. "
        + "If you really need to put <GTProvider> on the client, import <GTProvider> from 'gt-react' instead (discouraged in server-first apps).");
}
//# sourceMappingURL=index.client.js.map