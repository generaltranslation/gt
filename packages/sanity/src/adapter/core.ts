import { GT } from 'generaltranslation';
import { Secrets } from 'sanity-translations-tab';

export const gt = new GT();

export function overrideConfig(secrets: Secrets | null) {
  gt.setConfig({
    ...(secrets?.project && { projectId: secrets?.project }),
    ...(secrets?.secret && { apiKey: secrets?.secret }),
  });
}

export class GTConfig {
  locales: string[];
  private static instance: GTConfig;
  constructor(locales: string[]) {
    this.locales = locales;
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new GTConfig([]);
    }
    return this.instance;
  }

  setLocales(locales: string[]) {
    this.locales = locales;
  }
  getLocales() {
    return this.locales;
  }
}
export const gtConfig = GTConfig.getInstance();
