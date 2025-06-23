#!/usr/bin/env node

import { spawn } from 'child_process';

console.log('Starting e2e test with 1 minute timeout...');

const proc = spawn('npm', ['run', 'test:e2e', '--', 'rpg-world.test.ts'], {
  stdio: 'inherit',
  shell: true
});

// Set 1 minute timeout
const timeout = setTimeout(() => {
  console.log('\n⏰ Test timeout reached (1 minute). Terminating...');
  proc.kill('SIGTERM');
  setTimeout(() => {
    if (!proc.killed) {
      console.log('Force killing test process...');
      proc.kill('SIGKILL');
    }
    process.exit(1);
  }, 5000);
}, 60000);

proc.on('exit', (code) => {
  clearTimeout(timeout);
  process.exit(code || 0);
}); 