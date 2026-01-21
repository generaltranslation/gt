#!/bin/bash

# Refactoring Test Script
# This script helps you verify that refactoring doesn't change behavior
# Usage: ./scripts/refactor-test.sh [before|after|compare]

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
GIT_ROOT="$(cd "$CLI_ROOT/../.." && pwd)"
RESULTS_DIR="$CLI_ROOT/.refactor-test-results"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test files (just the file names, will be run from CLI_ROOT)
TESTS=(
  "parseJsx.refactor.test.ts"
  "parseStringFunction.refactor.test.ts"
)

# Function to print colored output
print_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Function to create results directory
setup_results_dir() {
  mkdir -p "$RESULTS_DIR"
  print_info "Results directory: $RESULTS_DIR"
}

# Function to run tests and save baseline
run_before_tests() {
  print_info "Running BEFORE refactoring tests..."
  setup_results_dir

  cd "$CLI_ROOT"

  # Update snapshots to create baseline
  print_info "Creating baseline snapshots..."
  for test in "${TESTS[@]}"; do
    print_info "Creating snapshot for: $test"
    npm run test -- "$test" -u || {
      print_error "Failed to create baseline snapshots for $test"
      exit 1
    }
  done

  # Run tests and save results
  for test in "${TESTS[@]}"; do
    test_name=$(basename "$test" .test.ts)
    print_info "Running test: $test_name"

    npm run test -- "$test" > "$RESULTS_DIR/before_${test_name}.txt" 2>&1 || {
      print_warning "Test had failures, but saving results..."
    }

    # Save timing info
    npm run test -- "$test" --reporter=verbose > "$RESULTS_DIR/before_${test_name}_verbose.txt" 2>&1 || true
  done

  # Count snapshots
  print_info "Counting baseline snapshots..."
  find . -name "*.snap" -type f | wc -l > "$RESULTS_DIR/before_snapshot_count.txt"

  # Save git status
  cd "$GIT_ROOT"
  git status > "$RESULTS_DIR/before_git_status.txt"

  print_success "Baseline tests completed!"
  print_info "Results saved to: $RESULTS_DIR"
  print_warning "IMPORTANT: Commit the snapshot files before refactoring!"
  echo ""
  echo "  cd $GIT_ROOT"
  echo "  git add packages/cli/**/__snapshots__/*.snap"
  echo "  git commit -m 'test: add refactoring baseline snapshots'"
  echo ""
}

# Function to run tests after refactoring
run_after_tests() {
  print_info "Running AFTER refactoring tests..."

  if [ ! -d "$RESULTS_DIR" ]; then
    print_error "Baseline results not found! Run './scripts/refactor-test.sh before' first"
    exit 1
  fi

  cd "$CLI_ROOT"

  # Run tests WITHOUT updating snapshots
  for test in "${TESTS[@]}"; do
    test_name=$(basename "$test" .test.ts)
    print_info "Running test: $test_name"

    npm run test -- "$test" > "$RESULTS_DIR/after_${test_name}.txt" 2>&1 || {
      print_error "Test FAILED: $test_name"
      print_info "Check $RESULTS_DIR/after_${test_name}.txt for details"
    }

    # Save timing info
    npm run test -- "$test" --reporter=verbose > "$RESULTS_DIR/after_${test_name}_verbose.txt" 2>&1 || true
  done

  # Count snapshots
  find . -name "*.snap" -type f | wc -l > "$RESULTS_DIR/after_snapshot_count.txt"

  # Save git status
  cd "$GIT_ROOT"
  git status > "$RESULTS_DIR/after_git_status.txt"

  print_success "After-refactoring tests completed!"
  print_info "Results saved to: $RESULTS_DIR"
  print_info "Run './scripts/refactor-test.sh compare' to see differences"
  echo ""
}

# Function to compare before and after results
compare_results() {
  print_info "Comparing BEFORE and AFTER results..."

  if [ ! -f "$RESULTS_DIR/before_parseJsx.refactor.txt" ] || [ ! -f "$RESULTS_DIR/after_parseJsx.refactor.txt" ]; then
    print_error "Missing test results! Run 'before' and 'after' commands first"
    exit 1
  fi

  cd "$GIT_ROOT"

  echo ""
  echo "========================================"
  echo "  REFACTORING TEST COMPARISON REPORT"
  echo "========================================"
  echo ""

  # Compare test counts
  print_info "Test Count Comparison:"
  for test in "${TESTS[@]}"; do
    test_name=$(basename "$test" .test.ts)

    before_count=$(grep -c "✓" "$RESULTS_DIR/before_${test_name}.txt" 2>/dev/null || echo "0")
    after_count=$(grep -c "✓" "$RESULTS_DIR/after_${test_name}.txt" 2>/dev/null || echo "0")

    if [ "$before_count" -eq "$after_count" ]; then
      print_success "$test_name: $before_count tests (unchanged)"
    else
      print_error "$test_name: $before_count → $after_count tests (CHANGED!)"
    fi
  done

  echo ""
  print_info "Snapshot Count Comparison:"
  before_snaps=$(cat "$RESULTS_DIR/before_snapshot_count.txt" 2>/dev/null || echo "0")
  after_snaps=$(cat "$RESULTS_DIR/after_snapshot_count.txt" 2>/dev/null || echo "0")

  if [ "$before_snaps" -eq "$after_snaps" ]; then
    print_success "Snapshots: $before_snaps files (unchanged)"
  else
    print_warning "Snapshots: $before_snaps → $after_snaps files (REVIEW REQUIRED!)"
  fi

  echo ""
  print_info "Git Status Changes:"
  cd "$CLI_ROOT"
  if git diff --quiet **/__snapshots__/*.snap 2>/dev/null; then
    print_success "No snapshot changes detected"
  else
    print_warning "Snapshot files have changed! Review with:"
    echo "  cd packages/cli"
    echo "  git diff **/__snapshots__/"
  fi

  echo ""
  print_info "Detailed Differences:"
  for test in "${TESTS[@]}"; do
    test_name=$(basename "$test" .test.ts)

    echo ""
    echo "--- $test_name ---"

    if diff -u "$RESULTS_DIR/before_${test_name}.txt" "$RESULTS_DIR/after_${test_name}.txt" > "$RESULTS_DIR/diff_${test_name}.txt" 2>&1; then
      print_success "No differences in test output"
    else
      print_warning "Differences found - see $RESULTS_DIR/diff_${test_name}.txt"
      echo "First 20 lines of diff:"
      head -20 "$RESULTS_DIR/diff_${test_name}.txt" || true
    fi
  done

  echo ""
  echo "========================================"
  echo ""

  # Final verdict
  all_passed=true

  for test in "${TESTS[@]}"; do
    test_name=$(basename "$test" .test.ts)

    if ! grep -q "Test Files.*passed" "$RESULTS_DIR/after_${test_name}.txt" 2>/dev/null; then
      all_passed=false
      break
    fi
  done

  cd "$CLI_ROOT"
  if [ "$all_passed" = true ] && git diff --quiet **/__snapshots__/*.snap 2>/dev/null; then
    print_success "✅ ALL TESTS PASSED - Refactoring preserved behavior!"
    echo ""
    echo "You can safely commit your changes:"
    echo "  cd $GIT_ROOT"
    echo "  git add ."
    echo "  git commit -m 'refactor: improve code readability'"
    echo ""
    exit 0
  else
    print_error "❌ TESTS FAILED OR SNAPSHOTS CHANGED"
    echo ""
    echo "Review the following:"
    echo "  1. Check test failures in $RESULTS_DIR"
    echo "  2. Review snapshot changes: cd packages/cli && git diff **/__snapshots__/"
    echo "  3. Verify changes are intentional"
    echo ""
    exit 1
  fi
}

# Function to clean up results
clean_results() {
  print_info "Cleaning up test results..."
  rm -rf "$RESULTS_DIR"
  print_success "Results directory removed"
}

# Function to show usage
show_usage() {
  echo "Usage: $0 [command]"
  echo ""
  echo "Commands:"
  echo "  before    Run tests BEFORE refactoring and create baseline"
  echo "  after     Run tests AFTER refactoring"
  echo "  compare   Compare before/after results and show differences"
  echo "  clean     Remove test results directory"
  echo "  help      Show this help message"
  echo ""
  echo "Example workflow:"
  echo "  1. cd packages/cli"
  echo "  2. ./scripts/refactor-test.sh before"
  echo "  3. cd ../.. && git commit -m 'test: add baseline snapshots'"
  echo "  4. [Do your refactoring]"
  echo "  5. cd packages/cli && ./scripts/refactor-test.sh after"
  echo "  6. ./scripts/refactor-test.sh compare"
  echo ""
}

# Main script
main() {
  case "${1:-}" in
    before)
      run_before_tests
      ;;
    after)
      run_after_tests
      ;;
    compare)
      compare_results
      ;;
    clean)
      clean_results
      ;;
    help|--help|-h)
      show_usage
      ;;
    *)
      print_error "Invalid command: ${1:-}"
      echo ""
      show_usage
      exit 1
      ;;
  esac
}

main "$@"
