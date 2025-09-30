#!/bin/bash

# Clean build artifacts
[ -d "dist" ] && rm -rf dist || true
[ -f "tsconfig.tsbuildinfo" ] && rm -f tsconfig.tsbuildinfo || true