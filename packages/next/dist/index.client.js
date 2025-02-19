"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Plural = exports.Branch = exports.DateTime = exports.Currency = exports.Num = exports.Var = exports.T = void 0;
exports.GTProvider = GTProvider;
exports.Tx = Tx;
var client_1 = require("gt-react/client");
Object.defineProperty(exports, "Var", { enumerable: true, get: function () { return client_1.Var; } });
Object.defineProperty(exports, "Num", { enumerable: true, get: function () { return client_1.Num; } });
Object.defineProperty(exports, "Currency", { enumerable: true, get: function () { return client_1.Currency; } });
Object.defineProperty(exports, "DateTime", { enumerable: true, get: function () { return client_1.DateTime; } });
Object.defineProperty(exports, "T", { enumerable: true, get: function () { return client_1.T; } });
Object.defineProperty(exports, "Branch", { enumerable: true, get: function () { return client_1.Branch; } });
Object.defineProperty(exports, "Plural", { enumerable: true, get: function () { return client_1.Plural; } });
// Mock <GTProvider> which throws an error
function GTProvider(_a) {
    throw new Error("You're attempting to import the Next.js <GTProvider> in a client component. " +
        "Are you sure you want to do this? It's better to import <GTProvider> in a file not marked 'use client' so that it can fetch translations on the server. " +
        "If you really need to put <GTProvider> on the client, import <GTClientProvider> from 'gt-next/client' instead (discouraged when using the Next.js App Router).");
}
// Mock <TX> which throws an error
function Tx(_a) {
    throw new Error("You're attempting to use the <Tx> runtime translation component in a client component. " +
        "This is currently unsupported. Please use <T> with variables, " +
        "or make sure <Tx> rendered on the server only. ");
}
//# sourceMappingURL=index.client.js.map