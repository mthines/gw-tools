#!/bin/bash
# Compile Linux binaries using Docker to avoid cross-compilation issues

# Get workspace root (2 levels up from this script's location)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# If docker isn't running, exit with error
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker and try again."
  exit 1
fi

echo "Compiling Linux binaries using Docker..."
docker run --rm \
  -v "$WORKSPACE_ROOT:/workspace" \
  -w /workspace/packages/gw-tool \
  denoland/deno:latest \
  sh -c "
    mkdir -p /workspace/dist/packages/gw-tool/binaries && \
    deno compile --allow-all --no-npm --no-check --target x86_64-unknown-linux-gnu \
      --output /workspace/dist/packages/gw-tool/binaries/gw-linux-x64 src/main.ts && \
    deno compile --allow-all --no-npm --no-check --target aarch64-unknown-linux-gnu \
      --output /workspace/dist/packages/gw-tool/binaries/gw-linux-arm64 src/main.ts
  "

echo "✅ Linux binaries compiled successfully"
