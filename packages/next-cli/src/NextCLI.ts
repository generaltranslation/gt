import { BaseCLI } from 'gt-react-cli';
import { WrapOptions, Options, Updates } from 'gt-react-cli/types';

import scanForContent from 'gt-react-cli/updates/scanForContent';
import createDictionaryUpdates from 'gt-react-cli/updates/createDictionaryUpdates';
import createInlineUpdates from 'gt-react-cli/updates/createInlineUpdates';

const framework = 'gt-next';
export class NextCLI extends BaseCLI {
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
  const cli = new NextCLI();
  cli.initialize();
}

export { BaseCLI };
