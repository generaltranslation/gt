import { writeFileSync } from 'node:fs';
import path from 'node:path';

export function createReportFile(summary: string, workingDir: string) {
  const summaryFilePath = path.join(workingDir, 'locadex-report.md');
  writeFileSync(summaryFilePath, summary);
  return summaryFilePath;
}
