import { parseArgs } from 'node:util';
import { createCliArgumentError } from './diagnostics';

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
    return parseArgs({
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
  } catch (error) {
    throw createCliArgumentError(error);
  }
}
