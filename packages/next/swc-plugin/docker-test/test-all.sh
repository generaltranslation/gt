#!/bin/bash

# Test all SWC plugin builds using Docker
set -e

echo "🧪 Testing GT SWC Plugin builds across platforms..."
echo ""

cd "$(dirname "$0")/.."

# Ensure builds exist
if [ ! -d "./dist/swc-plugin" ]; then
    echo "❌ No builds found. Run 'npm run build:swc-plugin' first."
    exit 1
fi

echo "📦 Available builds:"
ls -la ./dist/swc-plugin/
echo ""

# Test Linux x64
echo "🐧 Testing Linux x64..."
docker build -f docker-test/Dockerfile.linux-x64 -t gt-swc-test:linux-x64 .
docker run --rm gt-swc-test:linux-x64
echo ""

# Test Linux ARM64 (if Docker supports it)
if docker buildx version >/dev/null 2>&1; then
    echo "🐧 Testing Linux ARM64..."
    docker buildx build --platform linux/arm64 -f docker-test/Dockerfile.linux-arm64 -t gt-swc-test:linux-arm64 .
    docker run --rm --platform linux/arm64 gt-swc-test:linux-arm64
    echo ""
else
    echo "⚠️  Skipping Linux ARM64 (buildx not available)"
    echo ""
fi

# Test WASM with Node.js
echo "🟦 Testing WASM with Node.js..."
docker build -f docker-test/Dockerfile.node -t gt-swc-test:node .
docker run --rm gt-swc-test:node
echo ""

# Test Windows (if Docker Desktop supports Windows containers)
if docker version --format '{{.Server.Os}}' | grep -q windows; then
    echo "🪟 Testing Windows x64..."
    docker build -f docker-test/Dockerfile.windows -t gt-swc-test:windows .
    docker run --rm gt-swc-test:windows
    echo ""
else
    echo "⚠️  Skipping Windows (Windows containers not available)"
    echo ""
fi

echo "✅ All available platform tests completed!"

# Show a summary
echo ""
echo "📊 Test Summary:"
echo "  ✅ Linux x64: ELF shared object"
[ -x "$(command -v docker buildx)" ] && echo "  ✅ Linux ARM64: ELF shared object"
echo "  ✅ WASM: WebAssembly module"
echo "  ℹ️  macOS: Native (can test directly)"
echo "  ℹ️  Windows: Use Windows Docker or VM"
echo "  ℹ️  Android: Use Android emulator or device"