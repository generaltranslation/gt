# Makefile for gt-swc-plugin development

# Default target
.DEFAULT_GOAL := help

# Variables
CARGO := cargo
RUSTFMT := rustfmt
CLIPPY := clippy

.PHONY: help lint fix format check test clean build-all install-tools

## Show this help message
help:
	@echo "Available commands:"
	@echo ""
	@grep -E '^##.*$$' $(MAKEFILE_LIST) | sed 's/## /  /'
	@echo ""

## Install required tools
install-tools:
	rustup component add clippy rustfmt
	cargo install cargo-audit cargo-outdated

## Run all lints and checks
lint: format-check clippy test audit

## Fix all automatically fixable issues
fix: format clippy-fix

## Format all code with rustfmt
format:
	$(CARGO) fmt

## Check if code is formatted correctly
format-check:
	$(CARGO) fmt --check

## Run clippy linter
clippy:
	$(CARGO) clippy --all-targets --all-features -- -D warnings

## Run clippy with automatic fixes
clippy-fix:
	$(CARGO) clippy --fix --all-targets --all-features --allow-dirty --allow-staged

## Run all tests
test:
	$(CARGO) test

## Run security audit
audit:
	$(CARGO) audit

## Check for outdated dependencies
outdated:
	$(CARGO) outdated

## Clean build artifacts
clean:
	$(CARGO) clean

## Run comprehensive check (CI-ready)
check: format-check clippy test audit
	@echo "✅ All checks passed!"

## Build for all targets
build-all: clean
	$(CARGO) build --release
	$(CARGO) build --release --target wasm32-wasip1
	$(CARGO) build --release --target wasm32-unknown-unknown

## Watch for changes and run checks
watch:
	$(CARGO) watch -x "fmt" -x "clippy" -x "test"

## Generate documentation
docs:
	$(CARGO) doc --open

## Full development cycle
dev: fix test
	@echo "🚀 Ready for development!"