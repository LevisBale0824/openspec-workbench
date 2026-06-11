.PHONY: build-windows build-linux appimage setup-linux-deps clean

# ============================================================
# Local development builds
# ============================================================

# Windows MSI + NSIS installer
build-windows:
	pnpm tauri build --bundles msi,nsis

# Linux musl binary (requires musl target installed locally)
build-linux:
	pnpm tauri build --target x86_64-unknown-linux-musl

# ============================================================
# AppImage via Docker (CentOS 7, glibc 2.17 compatible)
# ============================================================

appimage:
	@echo "=== Building AppImage in CentOS 7 container ==="
	@echo "    Output: output/*.AppImage"
	@echo "    Compatibility: glibc 2.17+ (RHEL 8 = glibc 2.28)"
	docker build -t openspec-builder -f scripts/Dockerfile.linux .
	docker run --rm \
		-v "$(CURDIR):/workspace" \
		-v "$(CURDIR)/output:/output" \
		openspec-builder

# ============================================================
# Environment setup (Linux host only)
# ============================================================

setup-linux-deps:
	rustup target add x86_64-unknown-linux-musl
	sudo apt-get install -y musl-tools libwebkit2gtk-4.1-dev libgtk-3-dev \
		libayatana-appindicator3-dev librsvg2-dev patchelf file
	wget -q https://github.com/linuxdeploy/linuxdeploy/releases/download/continuous/linuxdeploy-x86_64.AppImage
	wget -q https://raw.githubusercontent.com/linuxdeploy/linuxdeploy-plugin-gtk/master/linuxdeploy-plugin-gtk.sh
	chmod +x linuxdeploy-x86_64.AppImage linuxdeploy-plugin-gtk.sh

# ============================================================
# Cleanup
# ============================================================

clean:
	cargo clean
	rm -rf dist/
	rm -rf output/
