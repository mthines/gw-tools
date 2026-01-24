#!/usr/bin/env node

/**
 * Wrapper script for the gw binary
 * This script launches the appropriate binary for the current platform
 */

const { spawn } = require('child_process');
const { join } = require('path');
const { platform } = require('os');

// Path to the binary
const binaryName = platform() === 'win32' ? 'gw.exe' : 'gw';
const binaryPath = join(__dirname, binaryName);

// Spawn the binary with all arguments
const child = spawn(binaryPath, process.argv.slice(2), {
  stdio: 'inherit',
  windowsHide: false,
});

// Forward exit code
child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code || 0);
  }
});

// Handle errors
child.on('error', (err) => {
  console.error('Failed to start gw:', err.message);
  console.error('\nThe binary may not be installed correctly.');
  console.error('Try reinstalling: npm install -g @gw-tools/gw');
  process.exit(1);
});
