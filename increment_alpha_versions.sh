#!/bin/bash

# Script to increment alpha versions in all package.json files
# Automatically detects current alpha version and increments by 1

set -e  # Exit on any error

echo "🔍 Finding all package.json files..."
PACKAGE_FILES=$(find . -name "package.json" -type f)

if [ -z "$PACKAGE_FILES" ]; then
    echo "❌ No package.json files found!"
    exit 1
fi

echo "📦 Found package.json files:"
echo "$PACKAGE_FILES"

echo ""
echo "🔍 Detecting current alpha version..."

# Find the current alpha version by looking at all package.json files
CURRENT_ALPHA_VERSION=""
for file in $PACKAGE_FILES; do
    # Extract alpha version numbers from the file
    ALPHA_VERSIONS=$(grep -o "alpha\.[0-9]\+" "$file" 2>/dev/null || true)
    
    if [ -n "$ALPHA_VERSIONS" ]; then
        # Get the first alpha version found
        FIRST_ALPHA=$(echo "$ALPHA_VERSIONS" | head -n1)
        if [ -z "$CURRENT_ALPHA_VERSION" ]; then
            CURRENT_ALPHA_VERSION="$FIRST_ALPHA"
        fi
        break
    fi
done

if [ -z "$CURRENT_ALPHA_VERSION" ]; then
    echo "❌ No alpha versions found in any package.json files!"
    exit 1
fi

# Extract the version number
CURRENT_NUMBER=$(echo "$CURRENT_ALPHA_VERSION" | grep -o "[0-9]\+")
NEW_NUMBER=$((CURRENT_NUMBER + 1))
NEW_ALPHA_VERSION="alpha.$NEW_NUMBER"

echo "📊 Current alpha version: $CURRENT_ALPHA_VERSION"
echo "🔄 Incrementing to: $NEW_ALPHA_VERSION"

# Counter for tracking changes
CHANGES=0

# Process each package.json file
for file in $PACKAGE_FILES; do
    echo "Processing: $file"
    
    # Check if file contains the current alpha version
    if grep -q "$CURRENT_ALPHA_VERSION" "$file"; then
        echo "  ✅ Found $CURRENT_ALPHA_VERSION in $file"
        
        # Create backup
        cp "$file" "${file}.backup"
        
        # Replace current alpha version with new alpha version
        # Using sed with different syntax for macOS compatibility
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS sed
            sed -i '' "s/$CURRENT_ALPHA_VERSION/$NEW_ALPHA_VERSION/g" "$file"
        else
            # Linux sed
            sed -i "s/$CURRENT_ALPHA_VERSION/$NEW_ALPHA_VERSION/g" "$file"
        fi
        
        # Verify the change
        if grep -q "$NEW_ALPHA_VERSION" "$file"; then
            echo "  ✅ Successfully updated $file"
            ((CHANGES++))
        else
            echo "  ❌ Failed to update $file"
            # Restore backup
            mv "${file}.backup" "$file"
        fi
    else
        echo "  ⏭️  No $CURRENT_ALPHA_VERSION found in $file"
    fi
done

echo ""
echo "📊 Summary:"
echo "  - Files processed: $(echo "$PACKAGE_FILES" | wc -l)"
echo "  - Files updated: $CHANGES"
echo "  - Version change: $CURRENT_ALPHA_VERSION → $NEW_ALPHA_VERSION"

if [ $CHANGES -gt 0 ]; then
    echo ""
    echo "🎉 Successfully incremented alpha versions!"
    echo "📝 You can review the changes with: git diff"
    echo "🔄 To revert, run: find . -name 'package.json.backup' -exec bash -c 'mv \"{}\" \"\${1%.backup}\"' _ {} \;"
else
    echo ""
    echo "ℹ️  No files were updated (no $CURRENT_ALPHA_VERSION found)"
fi 