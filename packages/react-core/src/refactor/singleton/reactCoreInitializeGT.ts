import { initializeState } from "../state/singleton-operations";
import { ReactI18nManagerConstructorParams } from "../state/ReactI18nManager";
import { initializeStores } from "../context/I18nStore/singleton-operations";

/**
 * Initialize GT for an SPA
 */
export function initializeGT({
  locale,
  ...config
}: {
  locale: string;
} & ReactI18nManagerConstructorParams): void {
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
  initializeStores({ reloadServerSideProps });
}
