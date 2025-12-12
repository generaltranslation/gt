#!/bin/bash

# Set executable permissions on all binaries after installation
if [ -d "binaries" ]; then
    echo "Setting executable permissions on binaries..."
    chmod +x binaries/* 2>/dev/null || true
    echo "Binaries are now executable"
fi