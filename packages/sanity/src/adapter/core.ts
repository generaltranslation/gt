import { GT } from 'generaltranslation';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import type { Secrets } from '../types';

export const gt = new GT();

export function overrideConfig(secrets: Secrets | null) {
  gt.setConfig({
    ...(secrets?.project && { projectId: secrets?.project }),
    ...(secrets?.secret && { apiKey: secrets?.secret }),
  });
}

export class GTConfig {
  sourceLocale: string;
  locales: string[];
  singletons: string[];
  singletonMapping: (sourceDocumentId: string, locale: string) => string;
  private static instance: GTConfig;
  constructor(
    sourceLocale: string,
    locales: string[],
    singletons: string[],
    singletonMapping: (sourceDocumentId: string, locale: string) => string
  ) {
    this.sourceLocale = sourceLocale;
    this.locales = locales;
    this.singletons = singletons;
    this.singletonMapping = singletonMapping;
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new GTConfig(
        gt.sourceLocale || libraryDefaultLocale,
        [],
        [],
        () => ''
      );
    }
    return this.instance;
  }

  setSourceLocale(sourceLocale: string) {
    this.sourceLocale = sourceLocale;
  }
  getSourceLocale() {
    return this.sourceLocale;
  }

  setLocales(locales: string[]) {
    this.locales = locales;
  }
  getLocales() {
    return this.locales;
  }
  setSingletons(singletons: string[]) {
    this.singletons = singletons;
  }
  getSingletons() {
    return this.singletons;
  }
  setSingletonMapping(
    singletonMapping: (sourceDocumentId: string, locale: string) => string
  ) {
    this.singletonMapping = singletonMapping;
  }
  getSingletonMapping() {
    return this.singletonMapping;
  }
}
export const gtConfig = GTConfig.getInstance();
