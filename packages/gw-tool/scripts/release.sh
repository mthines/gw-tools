#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Find workspace root
WORKSPACE_ROOT="$(git rev-parse --show-toplevel)"
PACKAGE_DIR="$WORKSPACE_ROOT/packages/gw-tool"

cd "$WORKSPACE_ROOT"

echo -e "${BLUE}📦 Automated Release Process for @gw-tools/gw${NC}\n"

# Detect release type based on branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)
IS_PRERELEASE=false
PRERELEASE_TAG=""

if [[ "$BRANCH" != "main" && "$BRANCH" != "master" ]]; then
  IS_PRERELEASE=true
  PRERELEASE_TAG="beta"
  echo -e "${YELLOW}⚠️  Pre-release mode: Branch '$BRANCH' will create a beta release${NC}"
fi

# Check for uncommitted changes
if [[ -n $(git status -s) ]]; then
  echo -e "${RED}❌ Error: You have uncommitted changes${NC}"
  exit 1
fi

# Get current version
CURRENT_VERSION=$(node -p "require('$PACKAGE_DIR/npm/package.json').version")
echo -e "Current version: ${YELLOW}$CURRENT_VERSION${NC}"

# Run tests and checks
echo -e "\n${BLUE}🧪 Running tests and checks...${NC}"
nx run @gw-tools/gw-tool:test
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Error: Tests or checks failed. Please fix the issues before releasing.${NC}"
  exit 1
fi

# Make sure the user is logged into NPM
echo -e "\n${BLUE}🔐 Checking npm authentication...${NC}"
npm whoami
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Error: You are not logged into npm. Please run 'npm login' and try again.${NC}"
  exit 1
fi

# Analyze commits to determine version bump
echo -e "\n${BLUE}📝 Analyzing commits since last release...${NC}"

# Get commits since last tag (only tags for this package)
LAST_TAG=$(git tag -l "v*" --sort=-version:refname | head -n 1)
if [ -z "$LAST_TAG" ]; then
  echo "No previous tags found, this will be the first release"
  COMMITS=$(git log --pretty=format:"%s" --no-merges -- packages/gw-tool/)
else
  echo "Last tag: $LAST_TAG"
  COMMITS=$(git log "$LAST_TAG"..HEAD --pretty=format:"%s" --no-merges -- packages/gw-tool/)
fi

# Determine version bump based on conventional commits
BUMP_TYPE="patch"

if echo "$COMMITS" | grep -q "^BREAKING CHANGE:\|^feat!:\|^fix!:"; then
  BUMP_TYPE="major"
elif echo "$COMMITS" | grep -q "^feat:"; then
  BUMP_TYPE="minor"
fi

echo -e "Bump type: ${GREEN}$BUMP_TYPE${NC}"

# Calculate new version
# Strip any existing pre-release suffix from current version
BASE_CURRENT_VERSION=$(echo "$CURRENT_VERSION" | sed -E 's/-.*$//')
IFS='.' read -ra VERSION_PARTS <<< "$BASE_CURRENT_VERSION"
MAJOR="${VERSION_PARTS[0]}"
MINOR="${VERSION_PARTS[1]}"
PATCH="${VERSION_PARTS[2]}"

case "$BUMP_TYPE" in
  major)
    MAJOR=$((MAJOR + 1))
    MINOR=0
    PATCH=0
    ;;
  minor)
    MINOR=$((MINOR + 1))
    PATCH=0
    ;;
  patch)
    PATCH=$((PATCH + 1))
    ;;
esac

if [ "$IS_PRERELEASE" = true ]; then
  # Find the latest beta tag for this base version
  BASE_VERSION="$MAJOR.$MINOR.$PATCH"
  LATEST_BETA=$(git tag -l "v$BASE_VERSION-$PRERELEASE_TAG.*" --sort=-version:refname | head -n 1)

  if [ -z "$LATEST_BETA" ]; then
    # First beta for this version
    PRERELEASE_NUMBER=1
  else
    # Extract and increment the beta number
    PRERELEASE_NUMBER=$(echo "$LATEST_BETA" | sed -E "s/.*-$PRERELEASE_TAG\.([0-9]+)/\1/")
    PRERELEASE_NUMBER=$((PRERELEASE_NUMBER + 1))
  fi

  NEW_VERSION="$BASE_VERSION-$PRERELEASE_TAG.$PRERELEASE_NUMBER"
else
  NEW_VERSION="$MAJOR.$MINOR.$PATCH"
fi

echo -e "New version: ${GREEN}$NEW_VERSION${NC}"

# Confirm release
echo -e "\n${YELLOW}About to release version $NEW_VERSION${NC}"
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Release cancelled"
  exit 1
fi

# Update version in npm/package.json
echo -e "\n${BLUE}📝 Updating version...${NC}"
cd "$PACKAGE_DIR/npm"
npm version "$NEW_VERSION" --no-git-tag-version
cd "$WORKSPACE_ROOT"

# Commit version change
echo -e "${BLUE}💾 Committing version change...${NC}"
git add packages/gw-tool/npm/package.json
git commit -m "chore(gw): release v$NEW_VERSION"

# Create git tag
echo -e "${BLUE}🏷️  Creating git tag...${NC}"
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

# Push commits and tags
echo -e "${BLUE}📤 Pushing to remote...${NC}"
git push origin "$BRANCH"
git push origin "v$NEW_VERSION"

# Build binaries
echo -e "\n${BLUE}🔨 Building binaries for all platforms...${NC}"
nx run gw-tool:compile-all:no-check

# Prepare npm package
echo -e "${BLUE}📦 Preparing npm package...${NC}"
nx run gw-tool:npm-pack

# Create GitHub release with binaries
echo -e "\n${BLUE}🚀 Creating GitHub release...${NC}"

# Show what will be uploaded
echo -e "${BLUE}Binaries to upload:${NC}"
ls -lh dist/packages/gw-tool/binaries/ | tail -n +2 | awk '{printf "  %s (%s)\n", $9, $5}'
echo ""

# Generate changelog for this release
CHANGELOG=""
if [ -z "$LAST_TAG" ]; then
  CHANGELOG=$(git log --pretty=format:"* %s (%h)" --no-merges -- packages/gw-tool/)
else
  CHANGELOG=$(git log "$LAST_TAG"..v"$NEW_VERSION" --pretty=format:"* %s (%h)" --no-merges -- packages/gw-tool/)
fi

echo -e "${BLUE}Uploading binaries to GitHub... (this may take a few minutes)${NC}"
PRERELEASE_FLAG=""
if [ "$IS_PRERELEASE" = true ]; then
  PRERELEASE_FLAG="--prerelease"
fi

GH_DEBUG=api gh release create "v$NEW_VERSION" \
  $PRERELEASE_FLAG \
  --title "v$NEW_VERSION" \
  --notes "$CHANGELOG" \
  dist/packages/gw-tool/binaries/*

# Update Homebrew formula
echo -e "\n${BLUE}🍺 Updating Homebrew formula...${NC}"

HOMEBREW_TAP_DIR="/tmp/homebrew-gw-tools-$NEW_VERSION"

# Clone the Homebrew tap repository
echo -e "${BLUE}Cloning Homebrew tap repository...${NC}"
if [ -d "$HOMEBREW_TAP_DIR" ]; then
  rm -rf "$HOMEBREW_TAP_DIR"
fi

git clone https://github.com/mthines/homebrew-gw-tools.git "$HOMEBREW_TAP_DIR"
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Error: Failed to clone Homebrew tap repository${NC}"
  exit 1
fi

# Calculate SHA256 hashes for all binaries
echo -e "${BLUE}Calculating SHA256 hashes...${NC}"
MACOS_X64_SHA256=$(shasum -a 256 "$WORKSPACE_ROOT/dist/packages/gw-tool/binaries/gw-macos-x64" | awk '{print $1}')
MACOS_ARM64_SHA256=$(shasum -a 256 "$WORKSPACE_ROOT/dist/packages/gw-tool/binaries/gw-macos-arm64" | awk '{print $1}')
LINUX_X64_SHA256=$(shasum -a 256 "$WORKSPACE_ROOT/dist/packages/gw-tool/binaries/gw-linux-x64" | awk '{print $1}')
LINUX_ARM64_SHA256=$(shasum -a 256 "$WORKSPACE_ROOT/dist/packages/gw-tool/binaries/gw-linux-arm64" | awk '{print $1}')

if [ -z "$MACOS_X64_SHA256" ] || [ -z "$MACOS_ARM64_SHA256" ] || [ -z "$LINUX_X64_SHA256" ] || [ -z "$LINUX_ARM64_SHA256" ]; then
  echo -e "${RED}❌ Error: Failed to calculate SHA256 hashes${NC}"
  rm -rf "$HOMEBREW_TAP_DIR"
  exit 1
fi

echo -e "  macOS x64 SHA256:   ${GREEN}$MACOS_X64_SHA256${NC}"
echo -e "  macOS arm64 SHA256: ${GREEN}$MACOS_ARM64_SHA256${NC}"
echo -e "  Linux x64 SHA256:   ${GREEN}$LINUX_X64_SHA256${NC}"
echo -e "  Linux arm64 SHA256: ${GREEN}$LINUX_ARM64_SHA256${NC}"

# Determine which formula file to update
if [ "$IS_PRERELEASE" = true ]; then
  FORMULA_FILE="$HOMEBREW_TAP_DIR/Formula/gw-beta.rb"
  echo -e "${BLUE}Updating beta formula (gw-beta.rb)...${NC}"

  # Create beta formula if it doesn't exist
  if [ ! -f "$FORMULA_FILE" ]; then
    echo -e "${YELLOW}Creating new beta formula...${NC}"
    cp "$HOMEBREW_TAP_DIR/Formula/gw.rb" "$FORMULA_FILE"
    # Update class name for beta formula (Homebrew convention: gw-beta -> GwBeta)
    sed -i '' 's/class Gw < Formula/class GwBeta < Formula/' "$FORMULA_FILE"
  fi
else
  FORMULA_FILE="$HOMEBREW_TAP_DIR/Formula/gw.rb"
  echo -e "${BLUE}Updating stable formula (gw.rb)...${NC}"
fi

# Update version (handle both X.Y.Z and X.Y.Z-beta.N formats)
sed -i '' "s|version \"[^\"]*\"|version \"$NEW_VERSION\"|g" "$FORMULA_FILE"

# Update download URLs (handle both version formats)
sed -i '' "s|/v[^/]*/gw-macos-arm64|/v$NEW_VERSION/gw-macos-arm64|g" "$FORMULA_FILE"
sed -i '' "s|/v[^/]*/gw-macos-x64|/v$NEW_VERSION/gw-macos-x64|g" "$FORMULA_FILE"
sed -i '' "s|/v[^/]*/gw-linux-arm64|/v$NEW_VERSION/gw-linux-arm64|g" "$FORMULA_FILE"
sed -i '' "s|/v[^/]*/gw-linux-x64|/v$NEW_VERSION/gw-linux-x64|g" "$FORMULA_FILE"

# Update SHA256 hashes (macOS arm64, macOS x64, Linux arm64, Linux x64)
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

# Commit and push changes
echo -e "${BLUE}Committing and pushing formula changes...${NC}"
cd "$HOMEBREW_TAP_DIR"

if [ "$IS_PRERELEASE" = true ]; then
  git add Formula/gw-beta.rb
  git commit -m "gw-beta: update to v$NEW_VERSION"
else
  git add Formula/gw.rb
  git commit -m "gw: update to v$NEW_VERSION"
fi

git push origin main

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Error: Failed to push Homebrew formula changes${NC}"
  cd "$WORKSPACE_ROOT"
  rm -rf "$HOMEBREW_TAP_DIR"
  exit 1
fi

cd "$WORKSPACE_ROOT"

# Cleanup
rm -rf "$HOMEBREW_TAP_DIR"
echo -e "${GREEN}✅ Homebrew formula updated successfully${NC}"

# Publish to npm
echo -e "\n${BLUE}📤 Publishing to npm...${NC}"
cd dist/packages/gw-tool/npm

if [ "$IS_PRERELEASE" = true ]; then
  echo -e "${BLUE}Publishing to npm with tag: $PRERELEASE_TAG...${NC}"
  npm publish --access public --tag "$PRERELEASE_TAG"
else
  echo -e "${BLUE}Publishing to npm as latest...${NC}"
  npm publish --access public
fi

cd "$WORKSPACE_ROOT"

echo -e "\n${GREEN}✅ Successfully released @gw-tools/gw v$NEW_VERSION${NC}"
echo -e "\nRelease URL: https://github.com/mthines/gw-tools/releases/tag/v$NEW_VERSION"

if [ "$IS_PRERELEASE" = true ]; then
  echo -e "npm package: npm install @gw-tools/gw@$PRERELEASE_TAG"
  echo -e "Homebrew:    brew install mthines/gw-tools/gw-beta"
else
  echo -e "npm package: https://www.npmjs.com/package/@gw-tools/gw"
  echo -e "Homebrew:    brew install mthines/gw-tools/gw"
fi
