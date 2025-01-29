"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = getPluralBranch;
const internal_1 = require("generaltranslation/internal");
/**
 * Main function to get the appropriate branch based on the provided number and branches.
 *
 * @param {number} n - The number to determine the branch for.
 * @param {any} branches - The object containing possible branches.
 * @returns {any} The determined branch.
 */
function getPluralBranch(n, locales, branches) {
    let branchName = "";
    let branch = null;
    if (typeof n === "number" && !branch && branches)
        branchName = (0, internal_1.getPluralForm)(n, Object.keys(branches), locales);
    if (branchName && !branch)
        branch = branches[branchName];
    return branch;
}
//# sourceMappingURL=getPluralBranch.js.map