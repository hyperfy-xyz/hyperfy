import type { Reporter, File, TaskResultPack } from 'vitest';

interface GameMetrics {
  frameTime: {
    avg: number;
    min: number;
    max: number;
    p95: number;
  };
  entityCount: {
    avg: number;
    max: number;
  };
  physicsSteps: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
  };
}

export default class GameMetricsReporter implements Reporter {
  private metrics: Map<string, GameMetrics> = new Map();
  private startTime = 0;

  onInit() {
    this.startTime = Date.now();
    console.log('\n🎮 Game Engine Test Suite\n');
  }

  onCollected() {
    // Called when test collection is done
  }

  onTaskUpdate(packs: TaskResultPack[]) {
    // Process test results
    for (const pack of packs) {
      const [taskId, result] = pack;
      
      if (result?.state === 'fail') {
        console.error(`❌ Test failed: ${taskId}`);
        if (result.errors?.length) {
          console.error(result.errors[0]);
        }
      }
    }
  }

  onFinished(_files?: File[], errors?: unknown[]) {
    const duration = Date.now() - this.startTime;
    
    console.log('\n📊 Game Engine Metrics Summary\n');
    console.log(`Total Duration: ${(duration / 1000).toFixed(2)}s`);
    
    if (this.metrics.size > 0) {
      console.log('\nPerformance Metrics:');
      console.log('─'.repeat(60));
      
      for (const [testName, metrics] of this.metrics) {
        console.log(`\n${testName}:`);
        console.log(`  Frame Time: avg=${metrics.frameTime.avg.toFixed(2)}ms, p95=${metrics.frameTime.p95.toFixed(2)}ms`);
        console.log(`  Entity Count: avg=${metrics.entityCount.avg}, max=${metrics.entityCount.max}`);
        console.log(`  Physics Steps: ${metrics.physicsSteps}`);
        console.log(`  Memory: ${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB / ${(metrics.memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`);
      }
    }
    
    // Check for physics performance issues
    const performanceIssues: string[] = [];
    
    for (const [testName, metrics] of this.metrics) {
      if (metrics.frameTime.p95 > 16.67) {
        performanceIssues.push(`${testName}: Frame time p95 (${metrics.frameTime.p95.toFixed(2)}ms) exceeds 60fps target`);
      }
      
      if (metrics.memoryUsage.heapUsed > 500 * 1024 * 1024) {
        performanceIssues.push(`${testName}: High memory usage (${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB)`);
      }
    }
    
    if (performanceIssues.length > 0) {
      console.log('\n⚠️  Performance Issues:');
      performanceIssues.forEach(issue => console.log(`  - ${issue}`));
    }
    
    if (errors?.length) {
      console.log('\n❌ Test Errors:');
      errors.forEach(error => console.error(error));
    }
    
    console.log('\n' + '═'.repeat(60) + '\n');
  }

  // Custom method to record game metrics
  recordMetrics(testName: string, metrics: Partial<GameMetrics>) {
    const existing = this.metrics.get(testName) || {
      frameTime: { avg: 0, min: Infinity, max: 0, p95: 0 },
      entityCount: { avg: 0, max: 0 },
      physicsSteps: 0,
      memoryUsage: { heapUsed: 0, heapTotal: 0 }
    };
    
    // Merge metrics
    if (metrics.frameTime) {
      existing.frameTime = { ...existing.frameTime, ...metrics.frameTime };
    }
    if (metrics.entityCount) {
      existing.entityCount = { ...existing.entityCount, ...metrics.entityCount };
    }
    if (metrics.physicsSteps !== undefined) {
      existing.physicsSteps = metrics.physicsSteps;
    }
    if (metrics.memoryUsage) {
      existing.memoryUsage = { ...existing.memoryUsage, ...metrics.memoryUsage };
    }
    
    this.metrics.set(testName, existing);
  }
}

// Export a singleton instance
export const gameMetricsReporter = new GameMetricsReporter();

// Helper to record metrics from tests
export function recordGameMetrics(testName: string, metrics: Partial<GameMetrics>) {
  if (gameMetricsReporter) {
    gameMetricsReporter.recordMetrics(testName, metrics);
  }
} 