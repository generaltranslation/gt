// Base Intl polyfills — side-effect imports
// Import 'gt-polyfills' to load all base polyfills
import '@formatjs/intl-getcanonicallocales/polyfill';
import '@formatjs/intl-locale/polyfill';
import '@formatjs/intl-displaynames/polyfill';
import '@formatjs/intl-listformat/polyfill';
import '@formatjs/intl-pluralrules/polyfill-force'; // https://github.com/formatjs/formatjs/issues/4463
import '@formatjs/intl-numberformat/polyfill';
import '@formatjs/intl-relativetimeformat/polyfill';
import '@formatjs/intl-datetimeformat/polyfill';
import '@formatjs/intl-datetimeformat/add-all-tz';
