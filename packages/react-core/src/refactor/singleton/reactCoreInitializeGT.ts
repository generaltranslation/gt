import { initializeState } from "../i18n-manager/singleton-operations";
import { ReactI18nManagerConstructorParams } from "../i18n-manager/ReactI18nManager";
import { initializeContextStores } from "../context/provider/initializeContextStores";

/**
 * Initialize GT for an SPA
 */
export function initializeGT({
  locale,
  ...config
}: {
  locale: string;
} & ReactI18nManagerConstructorParams): void {
  // TODO: this is not envrionment agnostic, this function (or check) should be moved to gt-react
  if (typeof window === "undefined") {
    throw new Error(
      'initializeGT() failed. You have imported initializeGT() from the "/browser" entrypoint. Did you mean to import initializeGT() from the main entrypoint?',
    );
  }
  initializeState({
    locale,
    config,
    renderStrategy: "SPA",
  });
  initializeContextStores({ reloadServerSideProps });
  throw new Error(
    "TODO: this is not envrionment agnostic, this function (or check) should be moved to gt-react",
  );
}
