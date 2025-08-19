# Simple Makefile for gt-swc-plugin

.PHONY: format lint test fix help

## Format code
format:
	cargo fmt

## Run linter
lint:
	cargo clippy -- -D warnings

## Run tests  
test:
	cargo test

## Fix issues automatically
fix:
	cargo fmt
	cargo clippy --fix --allow-dirty --allow-staged

## Show help
help:
	@echo "Commands:"
	@echo "  make format  - Format code"
	@echo "  make lint    - Run linter" 
	@echo "  make test    - Run tests"
	@echo "  make fix     - Fix issues automatically"