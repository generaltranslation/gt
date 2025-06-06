export class AgentStats {
  private totalFiles: number = 0;
  private processedFiles: number = 0;
  private totalCost: number = 0;
  private totalToolCalls: number = 0;
  private totalApiDuration: number = 0;
  private totalWallDuration: number = 0;

  constructor() {}

  updateStats(stats: {
    newProcessedFiles?: number;
    newCost?: number;
    newToolCalls?: number;
    newApiDuration?: number;
    newWallDuration?: number;
  }) {
    if (stats.newProcessedFiles) {
      this.processedFiles += stats.newProcessedFiles;
    }
    if (stats.newCost) {
      this.totalCost += stats.newCost;
    }
    if (stats.newToolCalls) {
      this.totalToolCalls += stats.newToolCalls;
    }
    if (stats.newApiDuration) {
      this.totalApiDuration += stats.newApiDuration;
    }
    if (stats.newWallDuration) {
      this.totalWallDuration += stats.newWallDuration;
    }
  }

  getStats(): {
    totalFiles: number;
    processedFiles: number;
    totalCost: number;
    totalToolCalls: number;
    totalApiDuration: number;
    totalWallDuration: number;
  } {
    return {
      totalFiles: this.totalFiles,
      processedFiles: this.processedFiles,
      totalCost: this.totalCost,
      totalToolCalls: this.totalToolCalls,
      totalApiDuration: this.totalApiDuration,
      totalWallDuration: this.totalWallDuration,
    };
  }
}
