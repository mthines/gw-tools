#!/bin/bash
#
# CI Release Script for @gw-tools/gw
#
# This script is designed to run in GitHub Actions after tests pass.
# It handles: building binaries, GitHub release, Homebrew, AUR, and npm publish.
#
# Prerequisites:
#   - Triggered by a tag push (v*)
#   - GITHUB_TOKEN with contents:write permission
#   - HOMEBREW_TAP_TOKEN secret (PAT with repo access to homebrew-gw-tools)
#   - AUR_SSH_KEY secret (optional, for AUR publishing)
#   - npm trusted publishing configured (OIDC)
#
# Usage:
#   ./release-ci.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Dry run mode (for testing)
if [ "$DRY_RUN" = "true" ]; then
  echo -e "${YELLOW}🧪 DRY RUN MODE - No actual publishing will occur${NC}\n"
fi

# Ensure we're in CI
if [ -z "$CI" ]; then
  echo -e "${RED}❌ This script is designed to run in CI only${NC}"
  echo -e "${RED}   For local releases, use: nx run gw-tool:release${NC}"
  exit 1
fi

# Get version from tag
if [ -z "$GITHUB_REF_NAME" ]; then
  echo -e "${RED}❌ GITHUB_REF_NAME not set. This script must be triggered by a tag push.${NC}"
  exit 1
fi

# Extract version from tag (remove 'v' prefix)
VERSION="${GITHUB_REF_NAME#v}"
echo -e "${BLUE}📦 CI Release for @gw-tools/gw v${VERSION}${NC}\n"

# Determine if prerelease
IS_PRERELEASE=false
PRERELEASE_TAG=""
NPM_TAG="latest"

if [[ "$VERSION" == *"-"* ]]; then
  IS_PRERELEASE=true
  PRERELEASE_TAG=$(echo "$VERSION" | sed -E 's/.*-([^.]+)\..*/\1/')
  NPM_TAG="$PRERELEASE_TAG"
  echo -e "${YELLOW}⚠️  Pre-release detected: $PRERELEASE_TAG${NC}"
fi

# Find workspace root
WORKSPACE_ROOT="$(git rev-parse --show-toplevel)"
PACKAGE_DIR="$WORKSPACE_ROOT/packages/gw-tool"
DIST_DIR="$WORKSPACE_ROOT/dist/packages/gw-tool"
BINARIES_DIR="$DIST_DIR/binaries"

cd "$WORKSPACE_ROOT"

# =============================================================================
# Step 1: Build binaries for all platforms
# =============================================================================
echo -e "\n${BLUE}🔨 Building binaries for all platforms...${NC}"

mkdir -p "$BINARIES_DIR"

# On Linux CI, compile Linux natively and cross-compile others
echo -e "${BLUE}  Compiling Linux x64...${NC}"
deno compile --allow-all --no-check --no-npm \
  --target x86_64-unknown-linux-gnu \
  --output "$BINARIES_DIR/gw-linux-x64" \
  "$PACKAGE_DIR/src/main.ts"

echo -e "${BLUE}  Compiling Linux arm64...${NC}"
deno compile --allow-all --no-check --no-npm \
  --target aarch64-unknown-linux-gnu \
  --output "$BINARIES_DIR/gw-linux-arm64" \
  "$PACKAGE_DIR/src/main.ts"

echo -e "${BLUE}  Compiling macOS x64...${NC}"
deno compile --allow-all --no-check --no-npm \
  --target x86_64-apple-darwin \
  --output "$BINARIES_DIR/gw-macos-x64" \
  "$PACKAGE_DIR/src/main.ts"

echo -e "${BLUE}  Compiling macOS arm64...${NC}"
deno compile --allow-all --no-check --no-npm \
  --target aarch64-apple-darwin \
  --output "$BINARIES_DIR/gw-macos-arm64" \
  "$PACKAGE_DIR/src/main.ts"

echo -e "${BLUE}  Compiling Windows x64...${NC}"
deno compile --allow-all --no-check --no-npm \
  --target x86_64-pc-windows-msvc \
  --output "$BINARIES_DIR/gw-windows-x64.exe" \
  "$PACKAGE_DIR/src/main.ts"

echo -e "${GREEN}✅ All binaries compiled${NC}"
ls -lh "$BINARIES_DIR/"

# =============================================================================
# Step 2: Calculate SHA256 hashes
# =============================================================================
echo -e "\n${BLUE}🔐 Calculating SHA256 hashes...${NC}"

LINUX_X64_SHA256=$(sha256sum "$BINARIES_DIR/gw-linux-x64" | awk '{print $1}')
LINUX_ARM64_SHA256=$(sha256sum "$BINARIES_DIR/gw-linux-arm64" | awk '{print $1}')
MACOS_X64_SHA256=$(sha256sum "$BINARIES_DIR/gw-macos-x64" | awk '{print $1}')
MACOS_ARM64_SHA256=$(sha256sum "$BINARIES_DIR/gw-macos-arm64" | awk '{print $1}')

echo -e "  Linux x64:   ${GREEN}$LINUX_X64_SHA256${NC}"
echo -e "  Linux arm64: ${GREEN}$LINUX_ARM64_SHA256${NC}"
echo -e "  macOS x64:   ${GREEN}$MACOS_X64_SHA256${NC}"
echo -e "  macOS arm64: ${GREEN}$MACOS_ARM64_SHA256${NC}"

# =============================================================================
# Step 3: Create GitHub Release
# =============================================================================
echo -e "\n${BLUE}🚀 Creating GitHub release...${NC}"

# Get the previous tag for changelog
PREVIOUS_TAG=$(git tag -l "v*" --sort=-version:refname | grep -v "^v${VERSION}$" | head -n 1)

# Generate changelog
if [ -z "$PREVIOUS_TAG" ]; then
  CHANGELOG=$(git log --pretty=format:"* %s (%h)" --no-merges -- packages/gw-tool/)
else
  CHANGELOG=$(git log "${PREVIOUS_TAG}..v${VERSION}" --pretty=format:"* %s (%h)" --no-merges -- packages/gw-tool/)
fi

# Create release
PRERELEASE_FLAG=""
if [ "$IS_PRERELEASE" = true ]; then
  PRERELEASE_FLAG="--prerelease"
fi

if [ "$DRY_RUN" = "true" ]; then
  echo -e "${YELLOW}[DRY RUN] Would create GitHub release v${VERSION}${NC}"
  echo -e "${YELLOW}[DRY RUN] Changelog:${NC}"
  echo "$CHANGELOG" | head -10
else
  gh release create "v${VERSION}" \
    $PRERELEASE_FLAG \
    --title "v${VERSION}" \
    --notes "$CHANGELOG" \
    "$BINARIES_DIR"/*
  echo -e "${GREEN}✅ GitHub release created${NC}"
fi

# =============================================================================
# Step 4: Update Homebrew formula
# =============================================================================
echo -e "\n${BLUE}🍺 Updating Homebrew formula...${NC}"

if [ -z "$HOMEBREW_TAP_TOKEN" ]; then
  echo -e "${YELLOW}⚠️  HOMEBREW_TAP_TOKEN not set, skipping Homebrew update${NC}"
elif [ "$DRY_RUN" = "true" ]; then
  echo -e "${YELLOW}[DRY RUN] Would update Homebrew formula with:${NC}"
  echo -e "  Version: $VERSION"
  echo -e "  macOS arm64 SHA: $MACOS_ARM64_SHA256"
  echo -e "  macOS x64 SHA: $MACOS_X64_SHA256"
else
  HOMEBREW_TAP_DIR="/tmp/homebrew-gw-tools"

  # Clone with token auth
  rm -rf "$HOMEBREW_TAP_DIR"
  git clone "https://x-access-token:${HOMEBREW_TAP_TOKEN}@github.com/mthines/homebrew-gw-tools.git" "$HOMEBREW_TAP_DIR"

  cd "$HOMEBREW_TAP_DIR"

  # Determine formula file
  if [ "$IS_PRERELEASE" = true ]; then
    FORMULA_FILE="Formula/gw-beta.rb"

    # Create beta formula if it doesn't exist
    if [ ! -f "$FORMULA_FILE" ]; then
      echo -e "${YELLOW}Creating new beta formula...${NC}"
      cp "Formula/gw.rb" "$FORMULA_FILE"
      sed -i 's/class Gw < Formula/class GwBeta < Formula/' "$FORMULA_FILE"
    fi
  else
    FORMULA_FILE="Formula/gw.rb"
  fi

  # Update version
  sed -i "s|version \"[^\"]*\"|version \"$VERSION\"|g" "$FORMULA_FILE"

  # Update download URLs
  sed -i "s|/v[^/]*/gw-macos-arm64|/v$VERSION/gw-macos-arm64|g" "$FORMULA_FILE"
  sed -i "s|/v[^/]*/gw-macos-x64|/v$VERSION/gw-macos-x64|g" "$FORMULA_FILE"
  sed -i "s|/v[^/]*/gw-linux-arm64|/v$VERSION/gw-linux-arm64|g" "$FORMULA_FILE"
  sed -i "s|/v[^/]*/gw-linux-x64|/v$VERSION/gw-linux-x64|g" "$FORMULA_FILE"

  # Update SHA256 hashes (order: macOS arm64, macOS x64, Linux arm64, Linux x64)
  perl -i -pe '
    BEGIN { $count = 0; }
    if (/sha256 "([^"]*)"/) {
      $count++;
      if ($count == 1) {
        s/sha256 "[^"]*"/sha256 "'"$MACOS_ARM64_SHA256"'"/;
      } elsif ($count == 2) {
        s/sha256 "[^"]*"/sha256 "'"$MACOS_X64_SHA256"'"/;
      } elsif ($count == 3) {
        s/sha256 "[^"]*"/sha256 "'"$LINUX_ARM64_SHA256"'"/;
      } elsif ($count == 4) {
        s/sha256 "[^"]*"/sha256 "'"$LINUX_X64_SHA256"'"/;
      }
    }
  ' "$FORMULA_FILE"

  # Commit and push
  git config user.name "github-actions[bot]"
  git config user.email "github-actions[bot]@users.noreply.github.com"
  git add "$FORMULA_FILE"

  if [ "$IS_PRERELEASE" = true ]; then
    git commit -m "gw-beta: update to v$VERSION"
  else
    git commit -m "gw: update to v$VERSION"
  fi

  # Ensure we use token auth for push (some CI environments have credential helpers that override)
  git remote set-url origin "https://x-access-token:${HOMEBREW_TAP_TOKEN}@github.com/mthines/homebrew-gw-tools.git"
  git push origin main

  cd "$WORKSPACE_ROOT"
  rm -rf "$HOMEBREW_TAP_DIR"

  echo -e "${GREEN}✅ Homebrew formula updated${NC}"
fi

# =============================================================================
# Step 5: Update AUR package (stable releases only)
# =============================================================================
if [ "$IS_PRERELEASE" = false ]; then
  echo -e "\n${BLUE}📦 Updating AUR package...${NC}"

  if [ -z "$AUR_SSH_KEY" ]; then
    echo -e "${YELLOW}⚠️  AUR_SSH_KEY not set, skipping AUR update${NC}"
  elif [ "$DRY_RUN" = "true" ]; then
    echo -e "${YELLOW}[DRY RUN] Would update AUR package with:${NC}"
    echo -e "  Version: $VERSION"
    echo -e "  Linux x64 SHA: $LINUX_X64_SHA256"
    echo -e "  Linux arm64 SHA: $LINUX_ARM64_SHA256"
  else
    # Setup SSH
    mkdir -p ~/.ssh
    echo "$AUR_SSH_KEY" > ~/.ssh/aur
    chmod 600 ~/.ssh/aur
    ssh-keyscan aur.archlinux.org >> ~/.ssh/known_hosts 2>/dev/null

    export GIT_SSH_COMMAND="ssh -i ~/.ssh/aur -o IdentitiesOnly=yes"

    AUR_DIR="/tmp/gw-tools-aur"
    rm -rf "$AUR_DIR"

    if git clone ssh://aur@aur.archlinux.org/gw-tools.git "$AUR_DIR" 2>/dev/null; then
      cd "$AUR_DIR"

      # Generate PKGBUILD
      sed "s/VERSION_PLACEHOLDER/$VERSION/g" "$PACKAGE_DIR/PKGBUILD.template" | \
        sed "s/X64_SHA256_PLACEHOLDER/$LINUX_X64_SHA256/g" | \
        sed "s/ARM64_SHA256_PLACEHOLDER/$LINUX_ARM64_SHA256/g" > PKGBUILD

      # Generate .SRCINFO
      cat > .SRCINFO << EOF
pkgbase = gw-tools
	pkgdesc = Git worktree manager - Streamline your multi-branch development workflow
	pkgver = $VERSION
	pkgrel = 1
	url = https://github.com/mthines/gw-tools
	arch = x86_64
	arch = aarch64
	license = MIT
	provides = gw
	conflicts = gw
	source_x86_64 = gw-tools-$VERSION-x64::https://github.com/mthines/gw-tools/releases/download/v$VERSION/gw-linux-x64
	sha256sums_x86_64 = $LINUX_X64_SHA256
	source_aarch64 = gw-tools-$VERSION-arm64::https://github.com/mthines/gw-tools/releases/download/v$VERSION/gw-linux-arm64
	sha256sums_aarch64 = $LINUX_ARM64_SHA256

pkgname = gw-tools
EOF

      # Commit and push
      git config user.name "github-actions[bot]"
      git config user.email "github-actions[bot]@users.noreply.github.com"
      git add PKGBUILD .SRCINFO
      git commit -m "Update to v$VERSION"
      git push

      cd "$WORKSPACE_ROOT"
      rm -rf "$AUR_DIR"

      echo -e "${GREEN}✅ AUR package updated${NC}"
    else
      echo -e "${YELLOW}⚠️  Failed to clone AUR repository${NC}"
    fi

    # Cleanup SSH key
    rm -f ~/.ssh/aur
  fi
else
  echo -e "\n${BLUE}Skipping AUR update for prerelease version${NC}"
fi

# =============================================================================
# Step 6: Prepare and publish npm package
# =============================================================================
echo -e "\n${BLUE}📤 Publishing to npm...${NC}"

# Prepare npm package
NPM_DIR="$DIST_DIR/npm"
mkdir -p "$NPM_DIR"
cp -r "$PACKAGE_DIR/npm/"* "$NPM_DIR/"
cp "$PACKAGE_DIR/README.md" "$NPM_DIR/"

cd "$NPM_DIR"

# Update version in package.json to match the release version
echo -e "${BLUE}Updating package.json version to $VERSION...${NC}"
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" package.json
echo -e "  Package version: $(grep '"version"' package.json)"

if [ "$DRY_RUN" = "true" ]; then
  echo -e "${YELLOW}[DRY RUN] Would publish to npm:${NC}"
  echo -e "  Package: @gw-tools/gw"
  echo -e "  Version: $VERSION"
  echo -e "  Tag: $NPM_TAG"
  npm pack --dry-run 2>/dev/null || true
else
  # Publish with provenance (OIDC trusted publishing)
  if [ "$IS_PRERELEASE" = true ]; then
    echo -e "${BLUE}Publishing to npm with tag: $NPM_TAG...${NC}"
    npm publish --provenance --access public --tag "$NPM_TAG"
  else
    echo -e "${BLUE}Publishing to npm as latest...${NC}"
    npm publish --provenance --access public
  fi
  echo -e "${GREEN}✅ npm package published${NC}"
fi

cd "$WORKSPACE_ROOT"

# =============================================================================
# Done!
# =============================================================================
if [ "$DRY_RUN" = "true" ]; then
  echo -e "\n${GREEN}✅ Dry run completed for @gw-tools/gw v${VERSION}${NC}"
  echo -e "${YELLOW}No actual publishing was performed.${NC}"
else
  echo -e "\n${GREEN}✅ Successfully released @gw-tools/gw v${VERSION}${NC}"
  echo -e "\nRelease URL: https://github.com/mthines/gw-tools/releases/tag/v${VERSION}"

  if [ "$IS_PRERELEASE" = true ]; then
    echo -e "npm package: npm install @gw-tools/gw@$NPM_TAG"
    echo -e "Homebrew:    brew install mthines/gw-tools/gw-beta"
  else
    echo -e "npm package: https://www.npmjs.com/package/@gw-tools/gw"
    echo -e "Homebrew:    brew install mthines/gw-tools/gw"
    echo -e "AUR:         yay -S gw-tools"
  fi
fi
