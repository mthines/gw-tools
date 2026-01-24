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

# Check if we're on main/master branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" != "main" && "$BRANCH" != "master" ]]; then
  echo -e "${RED}❌ Error: You must be on main or master branch${NC}"
  exit 1
fi

# Check for uncommitted changes
if [[ -n $(git status -s) ]]; then
  echo -e "${RED}❌ Error: You have uncommitted changes${NC}"
  exit 1
fi

# Get current version
CURRENT_VERSION=$(node -p "require('$PACKAGE_DIR/npm/package.json').version")
echo -e "Current version: ${YELLOW}$CURRENT_VERSION${NC}"

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
IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
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

NEW_VERSION="$MAJOR.$MINOR.$PATCH"
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
nx run gw-tool:compile-all

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
GH_DEBUG=api gh release create "v$NEW_VERSION" \
  --title "v$NEW_VERSION" \
  --notes "$CHANGELOG" \
  dist/packages/gw-tool/binaries/*

# Publish to npm
echo -e "\n${BLUE}📤 Publishing to npm...${NC}"
cd dist/packages/gw-tool/npm
npm publish --access public
cd "$WORKSPACE_ROOT"

echo -e "\n${GREEN}✅ Successfully released @gw-tools/gw v$NEW_VERSION${NC}"
echo -e "\nRelease URL: https://github.com/mthines/gw-tools/releases/tag/v$NEW_VERSION"
echo -e "npm package: https://www.npmjs.com/package/@gw-tools/gw"
