#!/bin/sh
# gtx-cli installer
# Usage: curl -fsSL https://assets.gtx.dev/install.sh | sh
#
# This script downloads and installs the gtx-cli binary for your platform.

set -e

# Configuration
BASE_URL="https://assets.gtx.dev/cli/latest"
BINARY_NAME="gtx"
INSTALL_DIR="${GTX_INSTALL_DIR:-/usr/local/bin}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info() {
    printf "${GREEN}info${NC}: %s\n" "$1"
}

warn() {
    printf "${YELLOW}warn${NC}: %s\n" "$1"
}

error() {
    printf "${RED}error${NC}: %s\n" "$1" >&2
    exit 1
}

# Detect OS
detect_os() {
    case "$(uname -s)" in
        Darwin*)
            echo "darwin"
            ;;
        Linux*)
            echo "linux"
            ;;
        MINGW*|MSYS*|CYGWIN*)
            echo "windows"
            ;;
        *)
            error "Unsupported operating system: $(uname -s)"
            ;;
    esac
}

# Detect architecture
detect_arch() {
    case "$(uname -m)" in
        x86_64|amd64)
            echo "x64"
            ;;
        arm64|aarch64)
            echo "arm64"
            ;;
        *)
            error "Unsupported architecture: $(uname -m)"
            ;;
    esac
}

# Get the download URL for the binary
get_download_url() {
    local os="$1"
    local arch="$2"

    if [ "$os" = "windows" ]; then
        echo "${BASE_URL}/gtx-cli-win32-x64.exe"
    else
        echo "${BASE_URL}/gtx-cli-${os}-${arch}"
    fi
}

# Check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Download the binary
download_binary() {
    local url="$1"
    local output="$2"

    info "Downloading gtx-cli from ${url}..."

    if command_exists curl; then
        curl -fsSL "$url" -o "$output"
    elif command_exists wget; then
        wget -q "$url" -O "$output"
    else
        error "Neither curl nor wget found. Please install one of them."
    fi
}

# Main installation function
main() {
    info "Installing gtx-cli..."

    # Detect platform
    local os=$(detect_os)
    local arch=$(detect_arch)

    info "Detected platform: ${os}-${arch}"

    # Windows is not fully supported for this installer
    if [ "$os" = "windows" ]; then
        warn "Windows detected. Consider using npm install -g gtx-cli instead."
        warn "Continuing with installation..."
        arch="x64"
    fi

    # Get download URL
    local url=$(get_download_url "$os" "$arch")

    # Create temp directory
    local tmp_dir=$(mktemp -d)
    local tmp_file="${tmp_dir}/gtx-cli"

    # Download binary
    download_binary "$url" "$tmp_file"

    # Make executable
    chmod +x "$tmp_file"

    # Determine install location
    local install_path="${INSTALL_DIR}/${BINARY_NAME}"

    # Check if we need sudo
    if [ -w "$INSTALL_DIR" ]; then
        mv "$tmp_file" "$install_path"
    else
        info "Elevated permissions required to install to ${INSTALL_DIR}"
        if command_exists sudo; then
            sudo mv "$tmp_file" "$install_path"
        else
            error "Cannot write to ${INSTALL_DIR} and sudo is not available. Try setting GTX_INSTALL_DIR to a writable directory."
        fi
    fi

    # Cleanup
    rm -rf "$tmp_dir"

    # Verify installation
    if command_exists "$BINARY_NAME"; then
        info "gtx-cli installed successfully!"
        info "Run 'gtx-cli --help' to get started."
    else
        warn "gtx-cli was installed to ${install_path}"
        warn "Add the following to your shell profile (~/.bashrc, ~/.zshrc, etc.):"
        warn "  export PATH=\"${INSTALL_DIR}:\$PATH\""
    fi
}

main "$@"
