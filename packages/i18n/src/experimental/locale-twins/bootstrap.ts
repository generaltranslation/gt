import { LOCALE_TWIN_DOCUMENT_DATA_ID } from './documentConstants';

/**
 * The SPA bootstrap: a classic script that the build puts in place of the
 * entry `<script type="module">` of a locale twin document (inline, or as an
 * external file). It reads the `#gt-locale-twins-data` block, picks the
 * locale, sets `<html lang>`, modulepreloads that locale's entry twin and
 * twinned dependencies right away, and adds the entry twin's module script
 * once the document is parsed (the deferred timing of the tag it replaces).
 *
 * Locale order mirrors the browser runtime (`createBrowserConditionStore`):
 * the locale cookie, then `navigator.languages`, then the default locale. A
 * visitor who disabled i18n (enable-i18n cookie `false`) gets the default
 * locale, whose twins carry the source text. `selectLocale` is
 * `LocaleConfig.determineLocale` without the `Intl.DisplayNames` validity
 * checks: an exact configured locale, else a same-language locale matching
 * the full code, language-region, language-script or minimized code, else
 * the same through the bare language. Custom locale aliases match through
 * their `customMapping` codes.
 *
 * The entry script's `nonce` (Vite `html.cspNonce`) is copied to the
 * modulepreloads it adds; the script tags keep all their built attributes.
 *
 * Plain ES5 so it runs unchanged in any browser; it is inserted verbatim (never
 * transpiled). It never contains `</script` or `<!--`.
 */
export const LOCALE_TWIN_BOOTSTRAP_SCRIPT = `(function () {
  var block = document.getElementById(${JSON.stringify(LOCALE_TWIN_DOCUMENT_DATA_ID)});
  if (!block) return;
  var data = JSON.parse(block.textContent);
  var candidates = [];
  var cookie = readCookie(document.cookie, data.localeCookieName);
  if (cookie) candidates.push(cookie);
  var languages = navigator.languages || [];
  for (var i = 0; i < languages.length; i++) candidates.push(languages[i]);
  var mapping = data.customMapping || {};
  var locale = readCookie(document.cookie, data.enableI18nCookieName) === 'false'
    ? data.defaultLocale
    : selectLocale(candidates, data.locales) || data.defaultLocale;
  document.documentElement.lang = locale;

  var scripts = [];
  for (var t = 0; t < data.tags.length; t++) {
    var tag = data.tags[t];
    var url = tag.urls[locale];
    if (!url) continue;
    var crossorigin = tag.attributes.crossorigin;
    var nonce = tag.attributes.nonce;
    if (tag.tag === 'script') {
      scripts.push(createElement('script', tag.attributes, 'src', url));
      var preload = { rel: 'modulepreload' };
      if (crossorigin !== undefined) preload.crossorigin = crossorigin;
      if (nonce !== undefined) preload.nonce = nonce;
      document.head.appendChild(createElement('link', preload, 'href', url));
    } else {
      document.head.appendChild(createElement('link', tag.attributes, 'href', url));
    }
  }
  function loadScripts() {
    for (var s = 0; s < scripts.length; s++) document.head.appendChild(scripts[s]);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadScripts);
  } else {
    loadScripts();
  }

  function createElement(name, attributes, urlAttribute, url) {
    var element = document.createElement(name);
    for (var key in attributes) {
      if (Object.prototype.hasOwnProperty.call(attributes, key)) {
        element.setAttribute(key, attributes[key]);
      }
    }
    element.setAttribute(urlAttribute, url);
    return element;
  }

  function readCookie(header, name) {
    if (!name) return undefined;
    var prefix = name + '=';
    var parts = (header || '').split(';');
    for (var c = 0; c < parts.length; c++) {
      var part = parts[c].trim();
      if (part.indexOf(prefix) !== 0) continue;
      var value = part.slice(prefix.length);
      try {
        return decodeURIComponent(value);
      } catch (error) {
        return value;
      }
    }
    return undefined;
  }

  function selectLocale(candidates, locales) {
    for (var c = 0; c < candidates.length; c++) {
      var candidate = candidates[c];
      if (locales.indexOf(candidate) !== -1) return candidate;
      var code = standardize(canonical(candidate));
      if (!code) continue;
      var language = matchCodes(code).language;
      var approved = {};
      for (var l = 0; l < locales.length; l++) {
        var approvedCode = standardize(canonical(locales[l]));
        if (!approvedCode || has(approved, approvedCode)) continue;
        if (matchCodes(approvedCode).language === language) {
          approved[approvedCode] = locales[l];
        }
      }
      var match = findMatch(code, approved) || findMatch(language, approved);
      if (match) return locales.indexOf(match) !== -1 ? match : approved[match];
    }
    return undefined;
  }

  function findMatch(code, approved) {
    if (has(approved, code)) return code;
    var codes = matchCodes(code);
    var options = [
      codes.language + '-' + codes.region,
      codes.language + '-' + codes.script,
      codes.minimized
    ];
    for (var o = 0; o < options.length; o++) {
      if (has(approved, options[o])) return options[o];
    }
    return undefined;
  }

  function matchCodes(code) {
    try {
      var parsed = new Intl.Locale(code);
      var region = parsed.region || '';
      var script = parsed.script || '';
      if (!region || !script) {
        var maximized = parsed.maximize();
        region = region || maximized.region || '';
        script = script || maximized.script || '';
      }
      return {
        language: parsed.language,
        region: region,
        script: script,
        minimized: parsed.minimize().toString()
      };
    } catch (error) {
      var parts = code.split('-');
      return {
        language: parts[0] || code,
        region: parts.length > 2 ? parts[2] : parts[1] || '',
        script: parts[3] || '',
        minimized: code
      };
    }
  }

  function standardize(code) {
    try {
      return Intl.getCanonicalLocales(code)[0];
    } catch (error) {
      return undefined;
    }
  }

  function canonical(locale) {
    var custom = has(mapping, locale) ? mapping[locale] : undefined;
    return custom && typeof custom === 'object' && custom.code
      ? custom.code
      : locale;
  }

  function has(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }
})();
`;
