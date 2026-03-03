#!/usr/bin/env node

/**
 * Postinstall script for @gw-tools/gw
 * Downloads the appropriate binary for the current platform
 */

const { existsSync, mkdirSync, chmodSync, openSync, fsyncSync, closeSync } = require('fs');
const { join } = require('path');
const { arch, platform } = require('os');
const https = require('https');
const { createWriteStream } = require('fs');

// Package version - this will be updated by the build process
const VERSION = require('./package.json').version;

// GitHub repository details
const REPO_OWNER = 'mthines';
const REPO_NAME = 'gw-tools';

/**
 * Get the binary name for the current platform
 */
function getBinaryName() {
  const platformMap = {
    darwin: 'macos',
    linux: 'linux',
    win32: 'windows',
  };

  const archMap = {
    x64: 'x64',
    arm64: 'arm64',
  };

  const os = platformMap[platform()];
  const cpu = archMap[arch()];

  if (!os || !cpu) {
    console.error(
      `Unsupported platform: ${platform()}-${arch()}\n` +
        'Supported platforms: macOS (x64, arm64), Linux (x64, arm64), Windows (x64, arm64)'
    );
    process.exit(1);
  }

  const extension = platform() === 'win32' ? '.exe' : '';
  return `gw-${os}-${cpu}${extension}`;
}

/**
 * Download file from URL
 */
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);

    https
      .get(url, { headers: { 'User-Agent': 'gw-npm-installer' } }, (response) => {
        // Handle redirects
        if (response.statusCode === 302 || response.statusCode === 301) {
          return download(response.headers.location, dest).then(resolve).catch(reject);
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
          return;
        }

        response.pipe(file);

        file.on('finish', () => {
          file.close((err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
      })
      .on('error', (err) => {
        reject(err);
      });

    file.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Main installation function
 */
async function install() {
  const binaryName = getBinaryName();
  const binDir = join(__dirname, 'bin');
  const binaryPath = join(binDir, platform() === 'win32' ? 'gw.exe' : 'gw');

  // Create bin directory if it doesn't exist
  if (!existsSync(binDir)) {
    mkdirSync(binDir, { recursive: true });
  }

  console.log(`Installing @gw-tools/gw v${VERSION}...`);
  console.log(`Platform: ${platform()}-${arch()}`);
  console.log(`Binary: ${binaryName}`);

  // Download URL for the binary from GitHub releases
  const downloadUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/v${VERSION}/${binaryName}`;

  try {
    console.log(`Downloading from: ${downloadUrl}`);
    await download(downloadUrl, binaryPath);

    // Ensure file is fully written to disk before chmod
    // This prevents ETXTBSY errors on Linux systems
    if (platform() !== 'win32') {
      const fd = openSync(binaryPath, 'r+');
      fsyncSync(fd);
      closeSync(fd);

      // Small delay after fsync before chmod
      await new Promise((resolve) => setTimeout(resolve, 100));

      chmodSync(binaryPath, 0o755);

      // Additional delay after chmod to prevent ETXTBSY
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    console.log('✓ Installation complete!');

    // Try to install shell integration, but don't fail if it errors
    console.log('\n⚙️  Setting up shell integration...');
    try {
      installShellIntegration();
    } catch (error) {
      console.log('  Shell integration setup encountered an issue.');
      console.log('  You can add it manually: eval \'"$(gw install-shell)"\' in your shell config');
    }

    console.log('\nRun "gw --help" to get started.');
  } catch (error) {
    console.error('\n✗ Installation failed:', error.message);
    console.error('\nYou can manually download the binary from:');
    console.error(`  ${downloadUrl}`);
    console.error('\nOr build from source:');
    console.error('  git clone https://github.com/mthines/gw-tools.git');
    console.error('  cd gw-tools');
    console.error('  nx run gw:compile');
    process.exit(1);
  }
}

/**
 * Install shell integration by appending eval line to shell config
 */
function installShellIntegration() {
  const { existsSync: fsExists, readFileSync: fsRead, writeFileSync: fsWrite, mkdirSync: fsMkdir } = require('fs');

  const home = process.env.HOME || process.env.USERPROFILE;
  const shell = process.env.SHELL || '';
  const shellName = shell.split('/').pop() || '';

  if (!home) {
    console.log('  Skipping shell integration: HOME environment variable not set');
    console.log('  Add eval \'"$(gw install-shell)"\' to your shell config manually');
    return;
  }

  if (!shellName) {
    console.log('  Skipping shell integration: SHELL environment variable not set');
    console.log('  Add eval \'"$(gw install-shell)"\' to your shell config manually');
    return;
  }

  let configFile;
  let evalLine;

  if (shellName === 'zsh') {
    configFile = join(home, '.zshrc');
    evalLine = 'eval "$(gw install-shell)"';
  } else if (shellName === 'bash') {
    configFile = join(home, '.bashrc');
    evalLine = 'eval "$(gw install-shell)"';
  } else if (shellName === 'fish') {
    const configDir = join(home, '.config', 'fish');
    if (!fsExists(configDir)) {
      fsMkdir(configDir, { recursive: true });
    }
    configFile = join(configDir, 'config.fish');
    evalLine = 'gw install-shell | source';
  } else {
    console.log(`  Unsupported shell: ${shellName}`);
    console.log('  Add eval \'"$(gw install-shell)"\' to your shell config manually');
    return;
  }

  // Check if already present
  if (fsExists(configFile)) {
    const content = fsRead(configFile, 'utf8');
    if (content.includes('gw install-shell')) {
      console.log('✓ Shell integration already configured!');
      return;
    }
  }

  // Append eval line
  fsWrite(configFile, '\n' + evalLine + '\n', { flag: 'a' });
  console.log(`✓ Shell integration added to ${configFile}`);
  console.log('  Restart your terminal or source your shell config to activate.');
}

// Run installation
install();
