import { describe, expect, it } from 'vitest';

import { androidLocaleQualifier } from '../androidLocale.js';
import { localeForFilePath } from '../localePath.js';

// Every platform locale with the directory name aapt2 2.19 accepts for it,
// each one confirmed by compiling `res/values-<qualifier>`. A change here is a
// claim about what the Android build accepts.
const PLATFORM_LOCALES: [locale: string, qualifier: string][] = [
  ['af', 'af'],
  ['am', 'am'],
  ['ar', 'ar'],
  ['ar-AE', 'ar-rAE'],
  ['ar-EG', 'ar-rEG'],
  ['ar-LB', 'ar-rLB'],
  ['ar-MA', 'ar-rMA'],
  ['ar-OM', 'ar-rOM'],
  ['ar-SA', 'ar-rSA'],
  ['az', 'az'],
  ['bg', 'bg'],
  ['bn', 'bn'],
  ['bs', 'bs'],
  ['ca', 'ca'],
  ['ca-ES', 'ca-rES'],
  ['cnr', 'cnr'],
  ['cs', 'cs'],
  ['cy', 'cy'],
  ['da', 'da'],
  ['de', 'de'],
  ['de-DE', 'de-rDE'],
  ['de-AT', 'de-rAT'],
  ['de-CH', 'de-rCH'],
  ['el', 'el'],
  ['el-EL', 'el-rEL'],
  ['el-CY', 'el-rCY'],
  ['en', 'en'],
  ['en-AU', 'en-rAU'],
  ['en-CA', 'en-rCA'],
  ['en-GB', 'en-rGB'],
  ['en-NZ', 'en-rNZ'],
  ['en-US', 'en-rUS'],
  ['eo', 'eo'],
  ['es', 'es'],
  ['es-ES', 'es-rES'],
  ['es-419', 'b+es+419'],
  ['es-AR', 'es-rAR'],
  ['es-CL', 'es-rCL'],
  ['es-CO', 'es-rCO'],
  ['es-MX', 'es-rMX'],
  ['es-PE', 'es-rPE'],
  ['es-US', 'es-rUS'],
  ['es-VE', 'es-rVE'],
  ['et', 'et'],
  ['eu', 'eu'],
  ['eu-ES', 'eu-rES'],
  ['fa', 'fa'],
  ['fi', 'fi'],
  ['fil', 'fil'],
  ['fr', 'fr'],
  ['fr-FR', 'fr-rFR'],
  ['fr-BE', 'fr-rBE'],
  ['fr-CM', 'fr-rCM'],
  ['fr-CA', 'fr-rCA'],
  ['fr-CH', 'fr-rCH'],
  ['fr-SN', 'fr-rSN'],
  ['gl', 'gl'],
  ['gl-ES', 'gl-rES'],
  ['gu', 'gu'],
  ['ha', 'ha'],
  ['hi', 'hi'],
  ['he', 'he'],
  ['hr', 'hr'],
  ['hu', 'hu'],
  ['hy', 'hy'],
  ['id', 'id'],
  ['ig', 'ig'],
  ['is', 'is'],
  ['it', 'it'],
  ['it-IT', 'it-rIT'],
  ['it-CH', 'it-rCH'],
  ['ja', 'ja'],
  ['ka', 'ka'],
  ['kk', 'kk'],
  ['kn', 'kn'],
  ['ko', 'ko'],
  ['la', 'la'],
  ['lt', 'lt'],
  ['lv', 'lv'],
  ['mk', 'mk'],
  ['ml', 'ml'],
  ['mn', 'mn'],
  ['mr', 'mr'],
  ['ms', 'ms'],
  ['my', 'my'],
  ['nl', 'nl'],
  ['nl-NL', 'nl-rNL'],
  ['nl-BE', 'nl-rBE'],
  ['nb', 'nb'],
  ['nb-NO', 'nb-rNO'],
  ['no', 'no'],
  ['no-NO', 'no-rNO'],
  ['nn', 'nn'],
  ['nn-NO', 'nn-rNO'],
  ['pa', 'pa'],
  ['pl', 'pl'],
  ['pt', 'pt'],
  ['pt-BR', 'pt-rBR'],
  ['pt-PT', 'pt-rPT'],
  ['ro', 'ro'],
  ['ru', 'ru'],
  ['sk', 'sk'],
  ['sl', 'sl'],
  ['so', 'so'],
  ['sq', 'sq'],
  ['sr', 'sr'],
  ['sv', 'sv'],
  ['sw', 'sw'],
  ['sw-KE', 'sw-rKE'],
  ['sw-TZ', 'sw-rTZ'],
  ['ta', 'ta'],
  ['te', 'te'],
  ['th', 'th'],
  ['tl', 'tl'],
  ['tr', 'tr'],
  ['uk', 'uk'],
  ['ur', 'ur'],
  ['uz', 'uz'],
  ['vi', 'vi'],
  ['yo', 'yo'],
  ['zgh', 'zgh'],
  ['zh', 'zh'],
  ['zh-CN', 'zh-rCN'],
  ['zh-Hans', 'b+zh+Hans'],
  ['zh-Hant', 'b+zh+Hant'],
  ['zh-HK', 'zh-rHK'],
  ['zh-SG', 'zh-rSG'],
  ['zh-TW', 'zh-rTW'],
  ['qbr', 'qbr'],
];

describe('androidLocaleQualifier', () => {
  it.each(PLATFORM_LOCALES)('%s -> values-%s', (locale, qualifier) => {
    expect(androidLocaleQualifier(locale)).toBe(qualifier);
  });

  it('uses the legacy form wherever one exists', () => {
    // `b+` requires API 24. Only a script subtag and a numeric region lack a
    // narrower spelling.
    const needsBcp47 = PLATFORM_LOCALES.filter(([, q]) => q.startsWith('b+'));
    expect(needsBcp47.map(([locale]) => locale).sort()).toEqual([
      'es-419',
      'zh-Hans',
      'zh-Hant',
    ]);
  });

  it('does not respell a language the way CLDR would', () => {
    // `Intl.Locale` resolves `tl` to `fil` and `cnr` to `sr-ME`. Android
    // accepts all four as written, and older devices report `tl`.
    expect(androidLocaleQualifier('tl')).toBe('tl');
    expect(androidLocaleQualifier('cnr')).toBe('cnr');
  });

  it('normalises case the way the platform writes it', () => {
    expect(androidLocaleQualifier('fr-ca')).toBe('fr-rCA');
    expect(androidLocaleQualifier('ZH-hans')).toBe('b+zh+Hans');
  });

  it('leaves a tag it cannot parse exactly as written', () => {
    // A bad tag names a bad directory. It must not fail the run.
    for (const bad of ['', 'not a locale', '!!']) {
      expect(androidLocaleQualifier(bad)).toBe(bad);
    }
  });
});

describe('localeForFilePath', () => {
  it('applies the Android spelling only to Android paths', () => {
    expect(localeForFilePath('androidStrings', 'fr-CA')).toBe('fr-rCA');
  });

  it('leaves every other file type verbatim', () => {
    // The registry is opt-in. Only Android is listed.
    for (const fileType of [
      'json',
      'strings',
      'stringsdict',
      'pot',
      'mdx',
    ] as const) {
      expect(localeForFilePath(fileType, 'fr-CA'), fileType).toBe('fr-CA');
    }
  });
});
