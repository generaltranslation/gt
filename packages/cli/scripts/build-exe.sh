#!/bin/bash

# Check if architecture argument is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <architecture>"
    echo "Available architectures: darwin-x64, darwin-arm64, linux-x64, linux-arm64, windows-x64, all"
    exit 1
fi

ARCH=$1

# Create binaries directory
mkdir -p binaries

build_darwin_x64() {
    echo "Building Darwin x64..."
    bun build src/bin/bin-entry.ts --compile --target=bun-darwin-x64 --outfile=binaries/gtx-cli-darwin-x64 --external ""
    chmod +x binaries/gtx-cli-darwin-x64
}

build_darwin_arm64() {
    echo "Building Darwin ARM64..."
    bun build src/bin/bin-entry.ts --compile --target=bun-darwin-arm64 --outfile=binaries/gtx-cli-darwin-arm64 --external ""
    chmod +x binaries/gtx-cli-darwin-arm64
}

build_linux_x64() {
    echo "Building Linux x64..."
    bun build src/bin/bin-entry.ts --compile --target=bun-linux-x64 --outfile=binaries/gtx-cli-linux-x64 --external ""
    chmod +x binaries/gtx-cli-linux-x64
}

build_linux_arm64() {
    echo "Building Linux ARM64..."
    bun build src/bin/bin-entry.ts --compile --target=bun-linux-arm64 --outfile=binaries/gtx-cli-linux-arm64 --external ""
    chmod +x binaries/gtx-cli-linux-arm64
}

build_windows_x64() {
    echo "Building Windows x64..."
    bun build src/bin/bin-entry.ts --compile --target=bun-windows-x64 --outfile=binaries/gtx-cli-win32-x64.exe --external ""
    chmod +x binaries/gtx-cli-win32-x64.exe
}

case $ARCH in
    darwin-x64)
        build_darwin_x64
        ;;
    darwin-arm64)
        build_darwin_arm64
        ;;
    linux-x64)
        build_linux_x64
        ;;
    linux-arm64)
        build_linux_arm64
        ;;
    windows-x64)
        build_windows_x64
        ;;
    all)
        build_darwin_x64
        build_darwin_arm64
        build_linux_x64
        build_linux_arm64
        build_windows_x64
        ;;
    *)
        echo "Unknown architecture: $ARCH"
        echo "Available architectures: darwin-x64, darwin-arm64, linux-x64, linux-arm64, windows-x64, all"
        exit 1
        ;;
esac

echo "Build complete!"