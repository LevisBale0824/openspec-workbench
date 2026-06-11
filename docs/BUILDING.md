# Building OpenSpec Workbench

## Prerequisites

### Common (all platforms)

- Node.js >= 20
- pnpm >= 9
- Rust >= 1.77

### RHEL 8 / CentOS 8 / Rocky Linux 8 / AlmaLinux 8

Enable EPEL and install system dependencies:

```bash
sudo dnf install -y epel-release
sudo dnf install -y \
    webkit2gtk3-devel \
    gtk3-devel \
    libappindicator-gtk3-devel \
    librsvg2-devel \
    openssl-devel \
    fuse
```

### Ubuntu / Debian

```bash
sudo apt install -y \
    libwebkit2gtk-4.1-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev
```

### musl target (Linux build only)

```bash
# Install musl target for Rust
rustup target add x86_64-unknown-linux-musl

# Install musl-gcc linker
sudo apt install musl-tools          # Ubuntu/Debian
sudo dnf install musl-gcc            # RHEL/Fedora (EPEL)
```

## Build Commands

### Development

```bash
pnpm install
pnpm tauri dev
```

### Windows Build

```bash
pnpm build:windows
# Outputs: src-tauri/target/release/bundle/msi/*.msi
#          src-tauri/target/release/bundle/nsis/*.exe
```

### Linux Build (native, requires musl target)

```bash
pnpm build:linux
# Outputs: src-tauri/target/x86_64-unknown-linux-musl/release/bundle/appimage/*.AppImage
```

### Linux AppImage (via Docker, no local deps needed)

```bash
make appimage
# Outputs: output/*.AppImage
```

This builds the AppImage inside a CentOS 7 Docker container, ensuring compatibility
with glibc 2.17+ (RHEL 8 uses glibc 2.28).

## AppImage Compatibility

| Aspect | Detail |
|--------|--------|
| Rust binary libc | statically linked [musl](https://musl.libc.org/) |
| System libs (GTK, WebKit) | bundled into AppImage via [linuxdeploy](https://github.com/linuxdeploy/linuxdeploy) |
| Build environment | CentOS 7 Docker (glibc 2.17) |
| Minimum kernel | Linux 3.10 |
| FUSE | version 2 required for AppImage mounting |

The AppImage is fully self-contained. No specific glibc version is required on the
target system because the Rust binary uses musl and the GTK/WekKit libraries are
bundled at the build host's glibc version (2.17) which is older than RHEL 8's 2.28.

## Platform Matrix

| Platform | Target Triple | Bundle Format |
|----------|---------------|---------------|
| Windows  | `x86_64-pc-windows-msvc` | MSI, NSIS |
| Linux    | `x86_64-unknown-linux-musl` | AppImage |

## Project Structure

```
openspec-workbench/
├── src/                    # React frontend
├── src-tauri/              # Tauri (Rust) backend
│   ├── tauri.conf.json     # Base Tauri config
│   ├── tauri.linux.conf.json   # Linux platform overrides
│   ├── tauri.windows.conf.json # Windows platform overrides
│   └── .cargo/config.toml # musl linker hints
├── scripts/
│   ├── Dockerfile.linux    # CentOS 7 build container
│   └── entrypoint.sh      # Docker entrypoint
├── .github/workflows/
│   ├── ci.yml              # PR validation
│   └── release.yml         # Multi-platform release builds
├── docs/
│   └── BUILDING.md         # This file
└── Makefile                # Convenience build targets
```

## Troubleshooting

### `version 'GLIBC_X.XX' not found`

If running a native build (not AppImage), ensure you built with the musl target:
```bash
pnpm build:linux
```

For AppImage builds, always use the Docker build (`make appimage`) to ensure
the bundled libraries are linked against an old enough glibc.

### WebKitGTK not found

Tauri requires WebKitGTK for the webview. Install system dependencies:
```bash
# RHEL 8
sudo dnf install -y webkit2gtk3-devel gtk3-devel
```

### AppImage FUSE error

If you see `fuse: failed to exec fusermount`, install FUSE:
```bash
sudo dnf install -y fuse
```

### Cross-compilation from Windows to Linux

Cross-compiling Tauri apps from Windows to Linux is not supported because
the bundling step (`linuxdeploy`) is Linux-native. Build Linux artifacts
via Docker (`make appimage`) or CI (GitHub Actions).
