import { parseArgs } from 'node:util';
import { createCliArgumentError, createSeederError } from './diagnostics';

export type CliValues = {
  file?: string;
  code?: string;
  stdin?: boolean;
  out?: string;
  stdout?: boolean;
  locale?: string;
  help?: boolean;
};

export function parseCliArgs(args: string[]): CliValues {
  try {
    const values = parseArgs({
      args: args[0] === '--' ? args.slice(1) : args,
      options: {
        file: { type: 'string', short: 'f' },
        code: { type: 'string', short: 'c' },
        stdin: { type: 'boolean' },
        out: { type: 'string', short: 'o' },
        stdout: { type: 'boolean' },
        locale: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
      allowPositionals: false,
    }).values;
    if (values.out != null && values.out.trim() === '') {
      throw createSeederError({
        whatHappened: 'The runtime seed output path is empty',
        fix: 'Pass a writable path to --out, or use --stdout.',
      });
    }
    if (values.out != null && values.stdout) {
      throw createSeederError({
        whatHappened: '--out and --stdout cannot be used together',
        fix: 'Choose a candidate file or stdout as the output destination.',
      });
    }
    return values;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('gt-react-seed')) {
      throw error;
    }
    throw createCliArgumentError(error);
  }
}
