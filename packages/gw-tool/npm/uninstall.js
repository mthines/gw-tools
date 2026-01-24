#!/usr/bin/env node

/**
 * Preuninstall script for @gw-tools/gw
 * Removes shell integration before uninstalling the package
 */

const { existsSync } = require('fs');
const { join } = require('path');
const { platform } = require('os');
const { spawnSync } = require('child_process');

/**
 * Remove shell integration
 */
function uninstall() {
  const binDir = join(__dirname, 'bin');
  const binaryPath = join(binDir, platform() === 'win32' ? 'gw.exe' : 'gw');

  // Check if binary exists
  if (!existsSync(binaryPath)) {
    console.log('Binary not found, skipping shell integration removal.');
    return;
  }

  console.log('🧹 Removing shell integration...');

  try {
    const result = spawnSync(binaryPath, ['install-shell', '--remove', '--quiet'], {
      stdio: 'inherit',
      timeout: 5000
    });

    if (result.error) {
      console.log('  (Could not remove shell integration automatically)');
      console.log('  You can manually remove it with: gw install-shell --remove');
    } else if (result.status === 0) {
      console.log('✓ Shell integration removed!');
    } else {
      console.log('  (Shell integration may not have been installed)');
    }
  } catch (error) {
    console.log('  (Could not remove shell integration)');
  }

  console.log('\nTip: Restart your terminal to complete the removal.');
}

// Run uninstall
uninstall();
