import { getRootParam } from '@generaltranslation/next-internal';
import { rootLocaleResolutionError } from '../../errors/createErrors';
import { defaultExperimentalLocaleResolutionParam } from '../../utils/constants';

export function getRootLocale(
  isValidLocale: (locale: string) => boolean
): string | undefined {
  try {
    const locale = getRootParam(
      process.env._GENERALTRANSLATION_EXPERIMENTAL_LOCALE_RESOLUTION_PARAM ??
        defaultExperimentalLocaleResolutionParam
    );
    return locale && isValidLocale(locale) ? locale : undefined;
  } catch (error) {
    console.warn(rootLocaleResolutionError + error);
    return undefined;
  }
}
