import { BaseCLI } from './BaseCLI';
import { WrapOptions, Options, Updates, SupportedFrameworks } from './types';

import scanForContent from './updates/scanForContent';
import createDictionaryUpdates from './updates/createDictionaryUpdates';
import createInlineUpdates from './updates/createInlineUpdates';

const pkg = 'gt-react';
export class ReactCLI extends BaseCLI {
  constructor() {
    super();
  }
  protected scanForContent(
    options: WrapOptions,
    framework: SupportedFrameworks
  ): Promise<{ errors: string[]; filesUpdated: string[]; warnings: string[] }> {
    return scanForContent(options, pkg, framework);
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
    return createInlineUpdates(options, pkg);
  }
}

export default function main() {
  const cli = new ReactCLI();
  cli.initialize();
}

export { BaseCLI };
