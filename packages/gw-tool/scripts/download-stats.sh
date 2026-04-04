#!/bin/bash
#
# Download Stats Script for gw-tools
#
# Fetches download counts from GitHub Releases API for the gw-tools repository.
# Since Homebrew custom taps download binaries from GitHub Releases, these counts
# serve as a direct proxy for brew install counts.
#
# Usage:
#   ./download-stats.sh                  # Summary of all releases
#   ./download-stats.sh --json           # JSON output
#   ./download-stats.sh --latest         # Latest release only
#   ./download-stats.sh --by-platform    # Breakdown by platform
#
# Requires: curl, jq
#
# Note: GitHub API is rate-limited to 60 requests/hour for unauthenticated requests.
#       Set GITHUB_TOKEN env var for higher limits (5000/hour).
#

set -e

REPO="mthines/gw-tools"
API_URL="https://api.github.com/repos/$REPO/releases"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# Parse arguments
JSON_OUTPUT=false
LATEST_ONLY=false
BY_PLATFORM=false

for arg in "$@"; do
  case $arg in
    --json) JSON_OUTPUT=true ;;
    --latest) LATEST_ONLY=true ;;
    --by-platform) BY_PLATFORM=true ;;
    --help|-h)
      echo "Usage: download-stats.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --json          Output raw JSON"
      echo "  --latest        Show latest release only"
      echo "  --by-platform   Show breakdown by platform"
      echo "  -h, --help      Show this help message"
      exit 0
      ;;
  esac
done

# Build auth header if token available
AUTH_HEADER=""
if [ -n "$GITHUB_TOKEN" ]; then
  AUTH_HEADER="-H \"Authorization: token $GITHUB_TOKEN\""
fi

# Fetch all releases (paginated, up to 100)
if [ "$LATEST_ONLY" = true ]; then
  RELEASES=$(curl -sf -H "Accept: application/vnd.github+json" \
    ${GITHUB_TOKEN:+-H "Authorization: token $GITHUB_TOKEN"} \
    "$API_URL/latest" | jq '[.]')
else
  RELEASES=$(curl -sf -H "Accept: application/vnd.github+json" \
    ${GITHUB_TOKEN:+-H "Authorization: token $GITHUB_TOKEN"} \
    "$API_URL?per_page=100")
fi

if [ -z "$RELEASES" ] || [ "$RELEASES" = "null" ]; then
  echo "Error: Failed to fetch releases from GitHub API" >&2
  exit 1
fi

# JSON output mode
if [ "$JSON_OUTPUT" = true ]; then
  echo "$RELEASES" | jq '[.[] | {
    tag: .tag_name,
    published: .published_at,
    prerelease: .prerelease,
    assets: [.assets[] | {
      name: .name,
      downloads: .download_count,
      size: .size
    }],
    total_downloads: ([.assets[].download_count] | add // 0)
  }]'
  exit 0
fi

# Calculate totals
TOTAL_DOWNLOADS=$(echo "$RELEASES" | jq '[.[].assets[].download_count] | add // 0')
TOTAL_RELEASES=$(echo "$RELEASES" | jq 'length')
STABLE_DOWNLOADS=$(echo "$RELEASES" | jq '[.[] | select(.prerelease == false) | .assets[].download_count] | add // 0')
BETA_DOWNLOADS=$(echo "$RELEASES" | jq '[.[] | select(.prerelease == true) | .assets[].download_count] | add // 0')

# Platform breakdown
if [ "$BY_PLATFORM" = true ]; then
  MACOS_ARM64=$(echo "$RELEASES" | jq '[.[].assets[] | select(.name | test("macos-arm64")) | .download_count] | add // 0')
  MACOS_X64=$(echo "$RELEASES" | jq '[.[].assets[] | select(.name | test("macos-x64")) | .download_count] | add // 0')
  LINUX_X64=$(echo "$RELEASES" | jq '[.[].assets[] | select(.name | test("linux-x64")) | .download_count] | add // 0')
  LINUX_ARM64=$(echo "$RELEASES" | jq '[.[].assets[] | select(.name | test("linux-arm64")) | .download_count] | add // 0')
  WINDOWS_X64=$(echo "$RELEASES" | jq '[.[].assets[] | select(.name | test("windows-x64")) | .download_count] | add // 0')

  echo -e "${BOLD}gw-tools Download Stats by Platform${NC}"
  echo -e "${DIM}────────────────────────────────────${NC}"
  echo ""
  echo -e "  ${CYAN}macOS arm64${NC}  (Apple Silicon)  ${BOLD}$MACOS_ARM64${NC}"
  echo -e "  ${CYAN}macOS x64${NC}    (Intel)          ${BOLD}$MACOS_X64${NC}"
  echo -e "  ${CYAN}Linux x64${NC}                     ${BOLD}$LINUX_X64${NC}"
  echo -e "  ${CYAN}Linux arm64${NC}                   ${BOLD}$LINUX_ARM64${NC}"
  echo -e "  ${CYAN}Windows x64${NC}                   ${BOLD}$WINDOWS_X64${NC}"
  echo ""
  echo -e "  ${DIM}macOS total:${NC}   ${GREEN}$(( MACOS_ARM64 + MACOS_X64 ))${NC}"
  echo -e "  ${DIM}Linux total:${NC}   ${GREEN}$(( LINUX_X64 + LINUX_ARM64 ))${NC}"
  echo -e "  ${DIM}Windows total:${NC} ${GREEN}$WINDOWS_X64${NC}"
  echo ""
fi

# Summary
echo -e "${BOLD}gw-tools Download Statistics${NC}"
echo -e "${DIM}────────────────────────────${NC}"
echo ""
echo -e "  ${GREEN}Total downloads:${NC}   ${BOLD}$TOTAL_DOWNLOADS${NC}"
echo -e "  ${BLUE}Stable releases:${NC}   $STABLE_DOWNLOADS"
echo -e "  ${YELLOW}Beta releases:${NC}     $BETA_DOWNLOADS"
echo -e "  ${DIM}Total releases:${NC}    $TOTAL_RELEASES"
echo ""

# Top 5 releases by downloads
echo -e "${BOLD}Top Releases${NC}"
echo -e "${DIM}────────────${NC}"
echo "$RELEASES" | jq -r '
  [.[] | {
    tag: .tag_name,
    total: ([.assets[].download_count] | add // 0),
    prerelease: .prerelease
  }] | sort_by(-.total) | .[0:5] | .[] |
  "  \(.tag)\t\(.total) downloads" + (if .prerelease then " (beta)" else "" end)
' | column -t -s $'\t'
echo ""

# Source note
echo -e "${DIM}Source: GitHub Releases API (github.com/$REPO/releases)${NC}"
echo -e "${DIM}Note: Homebrew installs download from GitHub Releases, so these${NC}"
echo -e "${DIM}counts include brew install/upgrade activity.${NC}"
