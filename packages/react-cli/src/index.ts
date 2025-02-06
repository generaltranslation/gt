import { BaseCLI } from './BaseCLI';
import { WrapOptions, Options, Updates } from './types';

import scanForContent from './updates/scanForContent';
import createDictionaryUpdates from './updates/createDictionaryUpdates';
import createInlineUpdates from './updates/createInlineUpdates';

const framework = 'gt-react';
export class ReactCLI extends BaseCLI {
  constructor() {
    super(framework);
  }
  protected scanForContent(
    options: WrapOptions
  ): Promise<{ errors: string[]; filesUpdated: string[]; warnings: string[] }> {
    return scanForContent(options, framework);
  }

  protected createDictionaryUpdates(
    options: Options & { dictionary: string },
    esbuildConfig: any
  ): Promise<Updates> {
    return createDictionaryUpdates(options, esbuildConfig);
  }

  protected createInlineUpdates(
    options: Options
  ): Promise<{ updates: Updates; errors: string[] }> {
    return createInlineUpdates(options);
  }
}

export default function main() {
  const cli = new ReactCLI();
  cli.initialize();
}

export { BaseCLI };
