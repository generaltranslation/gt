import { CSRGTProvider } from "./refactor/provider/CSRGTProvider";

/**
 * Wrap GTProvider around the content that you want to translate
 */
export const GTProvider: typeof CSRGTProvider = () => {
  throw new Error(
    "gt-react: You have imported a function from the dedicated types entrypoint. If you are seeing this error, it means something has gone wrong.",
  );
};

/**
 * TODO: throw error if any of these functions are called
 */
export {
  Branch,
  Plural,
  Derive,
  LocaleSelector,
  T,
  Currency,
  DateTime,
  RelativeTime,
  Var,
  Num,
  useLocale,
  useSetLocale,
  useCustomMapping,
  useDefaultLocale,
  useEnableI18n,
  useLocales,
  useLocaleSelector,
  useFormatLocales,
} from "@generaltranslation/react-core/context";
