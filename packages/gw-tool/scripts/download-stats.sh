#!/bin/bash
#
# Download Stats Script for gw-tools
#
# Tracks two data sources:
#   1. Homebrew tap traffic (github.com/mthines/homebrew-gw-tools) — clone counts
#      directly represent `brew install` / `brew update` activity.
#   2. GitHub Release downloads (github.com/mthines/gw-tools) — binary download
#      counts across all platforms and release channels.
#
# Usage:
#   ./download-stats.sh                  # Summary of all stats
#   ./download-stats.sh --json           # JSON output
#   ./download-stats.sh --latest         # Latest release only
#   ./download-stats.sh --by-platform    # Breakdown by platform
#
# Requires: curl, jq
#
# Authentication:
#   GITHUB_TOKEN          — For higher API rate limits (optional for release data)
#   HOMEBREW_TAP_TOKEN    — Required for tap traffic data (needs push access to
#                           mthines/homebrew-gw-tools). Without this, only release
#                           download counts are shown.
#
# Note: GitHub traffic API only retains 14 days of data. Use the GitHub Actions
#       workflow (.github/workflows/download-stats.yml) to collect weekly snapshots.
#

set -e

# Check dependencies
for cmd in curl jq; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: '$cmd' is required but not installed." >&2
    exit 1
  fi
done

REPO="mthines/gw-tools"
TAP_REPO="mthines/homebrew-gw-tools"
API_URL="https://api.github.com/repos/$REPO/releases"
TAP_API_URL="https://api.github.com/repos/$TAP_REPO/traffic"

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
      echo ""
      echo "Environment:"
      echo "  GITHUB_TOKEN          Higher API rate limits (optional)"
      echo "  HOMEBREW_TAP_TOKEN    Required for brew install tracking"
      echo "                        (needs push access to $TAP_REPO)"
      exit 0
      ;;
  esac
done

# Fetch from GitHub API with error handling
fetch_api() {
  local url="$1"
  local token="${2:-$GITHUB_TOKEN}"
  local response
  response=$(curl -sf -H "Accept: application/vnd.github+json" \
    ${token:+-H "Authorization: token $token"} \
    "$url") || {
    echo "Error: Failed to fetch from $url" >&2
    echo "  Check your network connection or set GITHUB_TOKEN for higher rate limits." >&2
    return 1
  }
  echo "$response"
}

# =========================================================================
# 1. Homebrew tap traffic (brew install/update signal)
# =========================================================================
TAP_CLONES_TOTAL=0
TAP_CLONES_UNIQUE=0
TAP_TOKEN="${HOMEBREW_TAP_TOKEN:-$GITHUB_TOKEN}"
HAS_TAP_DATA=false

if [ -n "$TAP_TOKEN" ]; then
  TAP_CLONES=$(fetch_api "$TAP_API_URL/clones" "$TAP_TOKEN" 2>/dev/null) && {
    TAP_CLONES_TOTAL=$(echo "$TAP_CLONES" | jq '.count // 0')
    TAP_CLONES_UNIQUE=$(echo "$TAP_CLONES" | jq '.uniques // 0')
    HAS_TAP_DATA=true
  }
fi

# =========================================================================
# 2. GitHub Release downloads
# =========================================================================
if [ "$LATEST_ONLY" = true ]; then
  RELEASES=$(fetch_api "$API_URL/latest" | jq '[.]')
else
  RELEASES=$(fetch_api "$API_URL?per_page=100")
fi

if [ -z "$RELEASES" ] || [ "$RELEASES" = "null" ] || [ "$RELEASES" = "[]" ]; then
  echo "No releases found for $REPO" >&2
  exit 0
fi

# JSON output mode
if [ "$JSON_OUTPUT" = true ]; then
  TAP_JSON="null"
  if [ "$HAS_TAP_DATA" = true ]; then
    TAP_JSON=$(echo "$TAP_CLONES" | jq '{clones_14d: {total: .count, unique: .uniques}, daily: .clones}')
  fi

  jq -n \
    --argjson releases "$(echo "$RELEASES" | jq '[.[] | {
      tag: .tag_name,
      published: .published_at,
      prerelease: .prerelease,
      assets: [.assets[] | {name: .name, downloads: .download_count, size: .size}],
      total_downloads: ([.assets[].download_count] | add // 0)
    }]')" \
    --argjson tap "$TAP_JSON" \
    '{homebrew_tap: $tap, github_releases: $releases}'
  exit 0
fi

# Calculate totals
TOTAL_DOWNLOADS=$(echo "$RELEASES" | jq '[.[].assets[].download_count] | add // 0')
TOTAL_RELEASES=$(echo "$RELEASES" | jq 'length')
STABLE_DOWNLOADS=$(echo "$RELEASES" | jq '[.[] | select(.prerelease == false) | .assets[].download_count] | add // 0')
BETA_DOWNLOADS=$(echo "$RELEASES" | jq '[.[] | select(.prerelease == true) | .assets[].download_count] | add // 0')

# =========================================================================
# Output
# =========================================================================

# Homebrew tap traffic section
if [ "$HAS_TAP_DATA" = true ]; then
  echo -e "${BOLD}Homebrew Tap Traffic (last 14 days)${NC}"
  echo -e "${DIM}───────────────────────────────────${NC}"
  echo ""
  echo -e "  ${GREEN}Brew installs (total):${NC}   ${BOLD}$TAP_CLONES_TOTAL${NC}"
  echo -e "  ${GREEN}Brew installs (unique):${NC}  ${BOLD}$TAP_CLONES_UNIQUE${NC}"
  echo -e "  ${DIM}Source: clone traffic from github.com/$TAP_REPO${NC}"
  echo ""
else
  echo -e "${YELLOW}Homebrew tap traffic: unavailable${NC}"
  echo -e "${DIM}Set HOMEBREW_TAP_TOKEN (with push access to $TAP_REPO) to enable.${NC}"
  echo ""
fi

# Platform breakdown
if [ "$BY_PLATFORM" = true ]; then
  MACOS_ARM64=$(echo "$RELEASES" | jq '[.[].assets[] | select(.name | test("macos-arm64")) | .download_count] | add // 0')
  MACOS_X64=$(echo "$RELEASES" | jq '[.[].assets[] | select(.name | test("macos-x64")) | .download_count] | add // 0')
  LINUX_X64=$(echo "$RELEASES" | jq '[.[].assets[] | select(.name | test("linux-x64")) | .download_count] | add // 0')
  LINUX_ARM64=$(echo "$RELEASES" | jq '[.[].assets[] | select(.name | test("linux-arm64")) | .download_count] | add // 0')
  WINDOWS_X64=$(echo "$RELEASES" | jq '[.[].assets[] | select(.name | test("windows-x64")) | .download_count] | add // 0')

  echo -e "${BOLD}Binary Downloads by Platform${NC}"
  echo -e "${DIM}────────────────────────────${NC}"
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

# Release downloads summary
echo -e "${BOLD}GitHub Release Downloads (all time)${NC}"
echo -e "${DIM}───────────────────────────────────${NC}"
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

# Source notes
echo -e "${DIM}Sources:${NC}"
echo -e "${DIM}  Tap traffic: github.com/$TAP_REPO (clone count = brew install/update)${NC}"
echo -e "${DIM}  Binaries:    github.com/$REPO/releases${NC}"
