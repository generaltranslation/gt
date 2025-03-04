import { BaseCLI } from './cli/BaseCLI';

export default function main() {
  const cli = new BaseCLI();
  cli.initialize();
}

export { BaseCLI };
