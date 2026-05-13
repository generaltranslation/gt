import {
  getTranslationsSnapshot,
  internalInitializeGTSPA,
} from "@generaltranslation/react-core/context";
import { setConditionStore } from "gt-i18n/internal";
import { BrowserConditionStore } from "../state/BrowserConditionStore";

type InitializeGTSPAParams = Omit<
  Parameters<typeof internalInitializeGTSPA>[0],
  "overrideSetLocale" | "locale"
>;

export async function initializeGTSPA(config: InitializeGTSPAParams) {
  const overrideSetLocale = (locale: string) => {
    window.location.reload();
  };
  internalInitializeGTSPA(
    { ...config, overrideSetLocale } as Parameters<
      typeof internalInitializeGTSPA
    >[0],
    undefined,
    BrowserConditionStore,
  );

  const initialLocale = navigator.language;

  const conditionStore = new BrowserConditionStore({
    ...config,
    locale: initialLocale,
  });
  setConditionStore(conditionStore);

  // Block until translations are loaded
  await getTranslationsSnapshot(initialLocale);
}
