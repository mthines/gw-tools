#!/bin/bash
# Compile Linux binaries using Docker to avoid cross-compilation issues

docker run --rm \
  -v "$(pwd):/workspace" \
  -w /workspace/packages/gw-tool \
  denoland/deno:latest \
  sh -c "
    mkdir -p /workspace/dist/packages/gw-tool/binaries && \
    deno compile --allow-all --no-npm --target x86_64-unknown-linux-gnu \
      --output /workspace/dist/packages/gw-tool/binaries/gw-linux-x64 src/main.ts && \
    deno compile --allow-all --no-npm --target aarch64-unknown-linux-gnu \
      --output /workspace/dist/packages/gw-tool/binaries/gw-linux-arm64 src/main.ts
  "
