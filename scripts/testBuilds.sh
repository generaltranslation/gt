# Fail if any command fails
set -e

# Clone test repo
git clone https://github.com/generaltranslation/gt-test.git

# Test base case
cd gt-test/ci/base
npm install
npm run build