# Fail if any command fails
set -e

# Test base case
cd test-apps/next/base
npm install
npm run build