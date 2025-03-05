// packages/gt-cli-core/src/BaseCLI.ts
import { program } from 'commander';

export class BaseCLI {
  public constructor() {}
  public init() {}
  public execute() {
    program.parse();
  }
}
