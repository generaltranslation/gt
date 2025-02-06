import { BaseCLI } from './BaseCLI';

export class ReactCLI extends BaseCLI {
  constructor() {
    super('gt-react');
  }
}

export default function main() {
  const cli = new ReactCLI();
  cli.initialize();
}

export { BaseCLI };
