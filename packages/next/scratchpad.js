/*

Main functions

'config': initGT

'client': 
    GTProvider
    useGT, useDefaultLocale, useLocale, 
    useBrowserLocale
- use hooks, client-side only

'index':
    GTProvider,
    getGT, getDefaultLocale, getLocale,
    Var, Num, Currency, DateTime
- get functions. Technically hooks when used on the client side, but not when used on the server.
- This ambiguity is worth it for the ease of use. If in doubt just use them like hooks.
- Var, Num, Currency, DateTime work on both the client and server.

'server':
    <T>, translate
- Server-side functions that will error on the client as they need to access I18NConfig.

'middleware':
    createMiddleware
- Routing middleware for i18n routing and SEO

*/
