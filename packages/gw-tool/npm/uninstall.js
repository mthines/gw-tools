#!/usr/bin/env node

/**
 * Preuninstall script for @gw-tools/gw
 * Removes shell integration before uninstalling the package
 */

const { existsSync, readFileSync, writeFileSync, unlinkSync, rmdirSync, readdirSync } = require('fs');
const { join } = require('path');
const { platform, homedir } = require('os');
const { spawnSync } = require('child_process');

/**
 * Remove shell integration manually (fallback)
 */
function manualRemoval() {
  const home = homedir();
  const shell = process.env.SHELL || '';
  const shellName = shell.split('/').pop() || '';

  let configFile;
  let scriptFile;
  let removed = false;

  if (shellName === 'zsh') {
    configFile = join(home, '.zshrc');
    scriptFile = join(home, '.gw', 'shell', 'integration.zsh');
  } else if (shellName === 'bash') {
    configFile = join(home, '.bashrc');
    scriptFile = join(home, '.gw', 'shell', 'integration.bash');
  } else if (shellName === 'fish') {
    scriptFile = join(home, '.config', 'fish', 'functions', 'gw.fish');
    configFile = null; // Fish doesn't need config file cleanup
  } else {
    console.log('  Could not detect shell for manual cleanup');
    return false;
  }

  // Remove the integration script file
  if (existsSync(scriptFile)) {
    try {
      unlinkSync(scriptFile);
      console.log(`  Removed: ${scriptFile}`);
      removed = true;
    } catch (error) {
      console.log(`  Could not remove: ${scriptFile}`);
    }
  }

  // Remove source line from config file (for bash/zsh)
  if (configFile && existsSync(configFile)) {
    try {
      const content = readFileSync(configFile, 'utf8');
      const lines = content.split('\n');
      const filtered = [];
      let skipNext = false;

      for (const line of lines) {
        if (line.includes('# gw-tools shell integration')) {
          skipNext = true;
          removed = true;
          continue;
        }
        if (skipNext && line.includes('source ~/.gw/shell/integration')) {
          skipNext = false;
          continue;
        }
        skipNext = false;
        filtered.push(line);
      }

      if (removed) {
        writeFileSync(configFile, filtered.join('\n'));
        console.log(`  Updated: ${configFile}`);
      }
    } catch (error) {
      console.log(`  Could not update: ${configFile}`);
    }
  }

  // Clean up empty directories
  try {
    const shellDir = join(home, '.gw', 'shell');
    if (existsSync(shellDir)) {
      const files = readdirSync(shellDir);
      if (files.length === 0) {
        rmdirSync(shellDir);
        console.log(`  Removed empty directory: ${shellDir}`);
      }
    }

    const gwDir = join(home, '.gw');
    if (existsSync(gwDir)) {
      const files = readdirSync(gwDir);
      if (files.length === 0) {
        rmdirSync(gwDir);
        console.log(`  Removed empty directory: ${gwDir}`);
      }
    }
  } catch (error) {
    // Ignore directory cleanup errors
  }

  return removed;
}

/**
 * Remove shell integration
 */
function uninstall() {
  const binDir = join(__dirname, 'bin');
  const binaryPath = join(binDir, platform() === 'win32' ? 'gw.exe' : 'gw');

  console.log('🧹 Removing shell integration...');

  // Try using the binary first
  if (existsSync(binaryPath)) {
    try {
      const result = spawnSync(binaryPath, ['install-shell', '--remove'], {
        stdio: ['inherit', 'pipe', 'pipe'],
        timeout: 5000,
        encoding: 'utf8',
      });

      if (result.status === 0) {
        // Show output from the command
        if (result.stdout) console.log(result.stdout);
        console.log('✓ Shell integration removed!');
        return;
      }

      // If failed, try manual removal
      if (result.stderr) {
        console.log('  Binary method failed, trying manual removal...');
      }
    } catch (error) {
      console.log('  Binary method failed, trying manual removal...');
    }
  }

  // Fallback to manual removal
  const removed = manualRemoval();

  if (removed) {
    console.log('✓ Shell integration removed!');
  } else {
    console.log('  Shell integration was not found or already removed.');
  }

  console.log('\nTip: Restart your terminal to complete the removal.');
}

// Run uninstall
uninstall();
