"use strict";var e=require("generaltranslation"),r={en:{"en-US":!0,"en-GB":!0,"en-CA":!0,"en-AU":!0,"en-NZ":!0}};exports.getSupportedLocale=function(n){if(!e.isValidLocale(n))return null;if(n=e.standardizeLocale(n),r[n])return n;var a=e.getLocaleProperties(n),t=a.languageCode,i=a.minimizedCode;if(r[t]){var l=r[t];return l[n]?n:l[i]?i:t}return null};
//# sourceMappingURL=index.cjs.min.cjs.map
