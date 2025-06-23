#!/usr/bin/env node

import 'dotenv-flow/config';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

// Configuration
const LOOP_CONFIG = {
  intervalMs: 30000, // Run test every 30 seconds
  maxConsecutiveFailures: 5,
  logFile: path.join(rootDir, 'visual-test-results.log'),
  summaryFile: path.join(rootDir, 'visual-test-summary.json'),
  testTimeoutMs: 90000 // 90 seconds max per test (should be longer than the test's own timeout)
};

/**
 * Run a single visual test
 */
async function runSingleTest() {
  return new Promise((resolve) => {
    const testProcess = spawn('node', ['scripts/visual-test.mjs'], {
      cwd: rootDir,
      stdio: 'pipe'
    });

    let stdout = '';
    let stderr = '';
    let processTimeout = null;
    let isTimedOut = false;

    // Set timeout to kill the test if it hangs
    processTimeout = setTimeout(() => {
      isTimedOut = true;
      console.log('⏱️  Test timeout - killing test process');
      try {
        testProcess.kill('SIGTERM');
        setTimeout(() => {
          if (!testProcess.killed) {
            testProcess.kill('SIGKILL');
          }
        }, 5000);
      } catch (error) {
        console.error('Error killing test process:', error);
      }
    }, LOOP_CONFIG.testTimeoutMs);

    testProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    testProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    testProcess.on('close', (code) => {
      clearTimeout(processTimeout);
      resolve({
        success: code === 0 && !isTimedOut,
        exitCode: code,
        stdout,
        stderr: isTimedOut ? stderr + '\nTest timed out' : stderr,
        timestamp: new Date().toISOString(),
        timedOut: isTimedOut
      });
    });

    testProcess.on('error', (error) => {
      clearTimeout(processTimeout);
      resolve({
        success: false,
        exitCode: -1,
        stdout,
        stderr: stderr + error.message,
        timestamp: new Date().toISOString(),
        timedOut: false
      });
    });
  });
}

/**
 * Log test result
 */
async function logResult(result) {
  const logEntry = `[${result.timestamp}] ${result.success ? 'PASS' : 'FAIL'} (exit: ${result.exitCode})\n`;
  
  try {
    await fs.appendFile(LOOP_CONFIG.logFile, logEntry);
  } catch (error) {
    console.error('Failed to write log:', error);
  }
}

/**
 * Update summary stats
 */
async function updateSummary(result, stats) {
  stats.totalRuns++;
  
  if (result.success) {
    stats.successCount++;
    stats.consecutiveFailures = 0;
    stats.lastSuccess = result.timestamp;
  } else {
    stats.failureCount++;
    stats.consecutiveFailures++;
    stats.lastFailure = result.timestamp;
  }
  
  stats.lastRun = result.timestamp;
  stats.successRate = ((stats.successCount / stats.totalRuns) * 100).toFixed(2);
  
  try {
    await fs.writeFile(LOOP_CONFIG.summaryFile, JSON.stringify(stats, null, 2));
  } catch (error) {
    console.error('Failed to write summary:', error);
  }
  
  return stats;
}

/**
 * Load existing summary or create new one
 */
async function loadSummary() {
  try {
    const data = await fs.readFile(LOOP_CONFIG.summaryFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {
      totalRuns: 0,
      successCount: 0,
      failureCount: 0,
      consecutiveFailures: 0,
      successRate: '0.00',
      startTime: new Date().toISOString(),
      lastRun: null,
      lastSuccess: null,
      lastFailure: null
    };
  }
}

/**
 * Print status update
 */
function printStatus(result, stats) {
  const status = result.success ? '✅ PASS' : '❌ FAIL';
  const time = new Date().toLocaleTimeString();
  
  console.log(`\n[${time}] ${status}`);
  console.log(`📊 Stats: ${stats.successCount}/${stats.totalRuns} (${stats.successRate}% success)`);
  
  if (stats.consecutiveFailures > 0) {
    console.log(`⚠️  Consecutive failures: ${stats.consecutiveFailures}`);
  }
  
  if (result.timedOut) {
    console.log('⏱️  Test timed out after', LOOP_CONFIG.testTimeoutMs / 1000, 'seconds');
  }
  
  if (result.success) {
    console.log('🎉 App is rendering correctly');
  } else {
    console.log('🚨 Skybox detected (renderer not rendering) or error');
    if (result.stderr) {
      console.log('Error details:', result.stderr.split('\n')[0]);
    }
  }
  
  console.log(`⏰ Next test in ${LOOP_CONFIG.intervalMs / 1000} seconds...`);
}

/**
 * Check if we should stop due to consecutive failures
 */
function shouldStop(stats) {
  if (stats.consecutiveFailures >= LOOP_CONFIG.maxConsecutiveFailures) {
    console.log(`\n🛑 Stopping due to ${LOOP_CONFIG.maxConsecutiveFailures} consecutive failures`);
    console.log('📋 Check the logs for details:');
    console.log(`   - Log file: ${LOOP_CONFIG.logFile}`);
    console.log(`   - Summary: ${LOOP_CONFIG.summaryFile}`);
    return true;
  }
  return false;
}

/**
 * Main loop
 */
async function runLoop() {
  console.log('🔄 Starting Hyperfy Visual Test Loop');
  console.log('====================================');
  console.log(`⚙️  Configuration:`);
  console.log(`   - Test interval: ${LOOP_CONFIG.intervalMs / 1000}s`);
  console.log(`   - Max consecutive failures: ${LOOP_CONFIG.maxConsecutiveFailures}`);
  console.log(`   - Log file: ${LOOP_CONFIG.logFile}`);
  console.log(`   - Summary file: ${LOOP_CONFIG.summaryFile}`);
  console.log('');
  console.log('Press Ctrl+C to stop the loop');
  console.log('');
  
  let stats = await loadSummary();
  
  // Print initial stats if resuming
  if (stats.totalRuns > 0) {
    console.log('📈 Resuming from previous session:');
    console.log(`   - Total runs: ${stats.totalRuns}`);
    console.log(`   - Success rate: ${stats.successRate}%`);
    console.log(`   - Last run: ${stats.lastRun}`);
    console.log('');
  }
  
  while (true) {
    try {
      console.log('🏃 Running visual test...');
      const result = await runSingleTest();
      
      await logResult(result);
      stats = await updateSummary(result, stats);
      
      printStatus(result, stats);
      
      if (shouldStop(stats)) {
        break;
      }
      
      // Wait for next iteration
      await new Promise(resolve => setTimeout(resolve, LOOP_CONFIG.intervalMs));
      
    } catch (error) {
      console.error('💥 Loop error:', error);
      await new Promise(resolve => setTimeout(resolve, LOOP_CONFIG.intervalMs));
    }
  }
}

/**
 * Generate final report
 */
async function generateReport() {
  try {
    const stats = await loadSummary();
    
    console.log('\n📊 Final Test Report');
    console.log('====================');
    console.log(`Total runs: ${stats.totalRuns}`);
    console.log(`Successful: ${stats.successCount}`);
    console.log(`Failed: ${stats.failureCount}`);
    console.log(`Success rate: ${stats.successRate}%`);
    console.log(`Started: ${stats.startTime}`);
    console.log(`Last run: ${stats.lastRun}`);
    
    if (stats.lastSuccess) {
      console.log(`Last success: ${stats.lastSuccess}`);
    }
    
    if (stats.lastFailure) {
      console.log(`Last failure: ${stats.lastFailure}`);
    }
    
    console.log(`\n📁 Files:`);
    console.log(`- Log: ${LOOP_CONFIG.logFile}`);
    console.log(`- Summary: ${LOOP_CONFIG.summaryFile}`);
    
  } catch (error) {
    console.error('Failed to generate report:', error);
  }
}

// Handle cleanup
process.on('SIGINT', async () => {
  console.log('\n🛑 Received interrupt signal');
  await generateReport();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received termination signal');
  await generateReport();
  process.exit(0);
});

// Run the loop
runLoop().catch(error => {
  console.error('💥 Loop failed:', error);
  generateReport().finally(() => process.exit(1));
}); 