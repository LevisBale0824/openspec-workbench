#!/bin/bash
set -e

echo "=== Installing frontend dependencies ==="
pnpm install --frozen-lockfile

echo "=== Building Tauri AppImage (musl target) ==="
pnpm tauri build --target x86_64-unknown-linux-musl --ci

echo "=== Collecting AppImage output ==="
mkdir -p /output

# Tauri 2 outputs AppImage here for musl target
BUNDLE_DIR="src-tauri/target/x86_64-unknown-linux-musl/release/bundle/appimage"
if [ -d "$BUNDLE_DIR" ]; then
    cp "$BUNDLE_DIR"/*.AppImage /output/ 2>/dev/null || true
    cp "$BUNDLE_DIR"/*.zsync /output/ 2>/dev/null || true
    echo "AppImage copied to /output:"
    ls -lh /output/
else
    echo "ERROR: AppImage bundle directory not found at $BUNDLE_DIR"
    echo "Searching for AppImage files..."
    find src-tauri/target -name "*.AppImage" 2>/dev/null
    exit 1
fi
