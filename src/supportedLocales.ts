const supportedLocales = {
    "af": {}, // Afrikaans
    "am": {}, // Amharic
    "ar": { // Arabic
        "ar-AE": true, // United Arab Emirates
        "ar-EG": true, // Egypt
        "ar-LB": true, // Lebanon
        "ar-MA": true, // Morocco
        "ar-SA": true, // Saudi Arabia
    },
    "bg": {}, // Bulgarian
    "bn": { // Bengali
        "bn-BD": true, // Bangladesh
        "bn-IN": true, // India
    },
    "bs": {}, // Bosnian
    "ca": {}, // Catalan
    "cs": {}, // Czech
    "cy": {}, // Welsh
    "da": {}, // Danish
    "de": { // German
        "de-AT": true, // Austria
        "de-CH": true, // Switzerland
        "de-DE": true, // Germany
    },
    "el": { // Greek
        "el-CY": true, // Cyprus
        "el-GR": true, // Greece
    },
    "en": { // English
        "en-AU": true, // Australia
        "en-CA": true, // Canada
        "en-GB": true, // United Kingdom
        "en-NZ": true, // New Zealand
        "en-US": true, // United States
    },
    "es": { // Spanish
        "es-419": true, // Latin America
        "es-AR": true, // Argentina
        "es-CL": true, // Chile
        "es-CO": true, // Colombia
        "es-ES": true, // Spain
        "es-MX": true, // Mexico
        "es-PE": true, // Peru
        "es-US": true, // United States
        "es-VE": true, // Venezuela
    },
    "et": {}, // Estonian
    "fa": {}, // Persian
    "fi": {}, // Finnish
    "fr": { // French
        "fr-BE": true, // Belgium
        "fr-CM": true, // Cameroon
        "fr-CA": true, // Canada
        "fr-CH": true, // Switzerland
        "fr-FR": true, // France
        "fr-SN": true, // Senegal
    },
    "gu": {}, // Gujarati
    "hi": {}, // Hindi
    "he": {}, // Hebrew
    "hr": {}, // Croatian
    "hu": {}, // Hungarian
    "hy": {}, // Armenian
    "id": {}, // Indonesian
    "is": {}, // Icelandic
    "it": { // Italian
        "it-CH": true, // Switzerland
        "it-IT": true, // Italy
    },
    "ja": {}, // Japanese
    "ka": {}, // Georgian
    "kk": {}, // Kazakh
    "kn": {}, // Kannada
    "ko": {}, // Korean
    "la": {}, // Latin
    "lt": {}, // Lithuanian
    "lv": {}, // Latvian
    "mk": {}, // Macedonian
    "ml": {}, // Malayalam
    "mn": {}, // Mongolian
    "mr": {}, // Marathi
    "ms": {}, // Malay
    "my": {}, // Burmese
    "nl": { // Dutch
        "nl-BE": true, // Belgium
        "nl-NL": true, // Netherlands
    },
    "no": {}, // Norwegian
    "pa": {}, // Punjabi
    "pl": {}, // Polish
    "pt": { // Portuguese
        "pt-BR": true, // Brazil
        "pt-PT": true, // Portugal
    },
    "ro": {}, // Romanian
    "ru": {}, // Russian
    "sk": {}, // Slovak
    "sl": {}, // Slovenian
    "so": {}, // Somali
    "sq": {}, // Albanian
    "sr": {}, // Serbian
    "sv": {}, // Swedish
    "sw": { // Swahili
        "sw-KE": true, // Kenya
        "sw-TZ": true, // Tanzania
    },
    "ta": {}, // Tamil
    "te": {}, // Telugu
    "th": {}, // Thai
    "tl": {}, // Tagalog
    "tlh": {}, // Klingon
    "tr": {}, // Turkish
    "uk": {}, // Ukrainian
    "ur": {}, // Urdu
    "vi": {}, // Vietnamese
    "zh": { // Chinese
        "zh-CN": true, // China
        "zh-HK": true, // Hong Kong
        "zh-SG": true, // Singapore
        "zh-TW": true, // Taiwan
    }
} as {
    [language: string]: {
        [locale: string]: true
    }
};

export default supportedLocales;