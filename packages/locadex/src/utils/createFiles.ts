import { writeFileSync } from 'node:fs';
import path from 'node:path';

export function createReportFile(summary: string) {
  const cwd = process.cwd();
  const summaryFilePath = path.join(cwd, 'locadex-report.md');
  writeFileSync(summaryFilePath, summary);
  return summaryFilePath;
}
