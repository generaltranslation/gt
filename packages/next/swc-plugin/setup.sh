#!/bin/bash

# GT SWC Plugin Cross-Compilation Setup Script
# Run with: curl -sSL https://raw.githubusercontent.com/your-repo/gt/main/packages/next/swc-plugin/setup.sh | bash

set -e

echo "🚀 Setting up GT SWC Plugin cross-compilation environment..."

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This setup script is currently only for macOS. For other platforms, please see the manual setup instructions."
    exit 1
fi

# Install Rust if not present
if ! command -v rustup &> /dev/null; then
    echo "📦 Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source ~/.cargo/env
else
    echo "✅ Rust already installed"
fi

# Install Homebrew if not present
if ! command -v brew &> /dev/null; then
    echo "📦 Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
else
    echo "✅ Homebrew already installed"
fi

# Install cross-compilation toolchains
echo "📦 Installing cross-compilation toolchains..."
brew install FiloSottile/musl-cross/musl-cross mingw-w64 android-ndk

# Install Rust targets
echo "📦 Installing Rust targets..."
rustup target add \
    wasm32-wasip1 \
    x86_64-unknown-linux-gnu \
    aarch64-unknown-linux-gnu \
    x86_64-linux-android \
    aarch64-linux-android \
    x86_64-apple-darwin \
    aarch64-apple-darwin \
    x86_64-pc-windows-gnu

# Detect shell and config file
if [[ "$SHELL" == *"zsh"* ]]; then
    SHELL_CONFIG="$HOME/.zshrc"
elif [[ "$SHELL" == *"bash"* ]]; then
    SHELL_CONFIG="$HOME/.bashrc"
else
    SHELL_CONFIG="$HOME/.profile"
fi

# Add environment variables to shell config
echo "📝 Adding environment variables to $SHELL_CONFIG..."

# Check if variables already exist
if ! grep -q "GT_SWC_PLUGIN_ENV" "$SHELL_CONFIG" 2>/dev/null; then
    cat >> "$SHELL_CONFIG" << 'EOF'

# GT SWC Plugin cross-compilation environment
# GT_SWC_PLUGIN_ENV - marker for setup script
export ANDROID_NDK_HOME="/opt/homebrew/Caskroom/android-ndk/28c/AndroidNDK13676358.app/Contents/NDK"
export PATH="$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/darwin-x86_64/bin:$PATH"

# Linux targets
export CC_x86_64_unknown_linux_gnu=x86_64-linux-musl-gcc
export CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER=x86_64-linux-musl-gcc
export CC_aarch64_unknown_linux_gnu=aarch64-linux-musl-gcc  
export CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER=aarch64-linux-musl-gcc

# Android targets
export CC_x86_64_linux_android=x86_64-linux-android21-clang
export CARGO_TARGET_X86_64_LINUX_ANDROID_LINKER=x86_64-linux-android21-clang
export CC_aarch64_linux_android=aarch64-linux-android21-clang
export CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER=aarch64-linux-android21-clang
EOF
    echo "✅ Environment variables added to $SHELL_CONFIG"
else
    echo "✅ Environment variables already configured"
fi

# Source the shell config for current session
source "$SHELL_CONFIG" 2>/dev/null || true

echo ""
echo "🎉 Setup complete! You can now build the GT SWC Plugin for all platforms."
echo ""
echo "Next steps:"
echo "  1. Restart your terminal or run: source $SHELL_CONFIG"
echo "  2. Navigate to your project directory"
echo "  3. Run: npm run build:swc-plugin"
echo ""
echo "Available build commands:"
echo "  npm run build:swc-plugin           # Build all platforms"
echo "  npm run build:swc-plugin:darwin-arm64  # Build for current platform only"
echo ""