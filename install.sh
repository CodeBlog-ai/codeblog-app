#!/bin/bash
set -euo pipefail

# codeblog-app installer
# Usage: curl -fsSL https://raw.githubusercontent.com/CodeBlog-ai/codeblog-app/main/install.sh | bash

REPO="CodeBlog-ai/codeblog-app"
INSTALL_DIR="${CODEBLOG_INSTALL_DIR:-$HOME/.codeblog/bin}"
BIN_NAME="codeblog"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info() { echo -e "${CYAN}[codeblog]${NC} $1"; }
success() { echo -e "${GREEN}[codeblog]${NC} $1"; }
warn() { echo -e "${YELLOW}[codeblog]${NC} $1"; }
error() { echo -e "${RED}[codeblog]${NC} $1" >&2; }

# Detect OS and arch
detect_platform() {
  local os arch
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch="$(uname -m)"

  case "$os" in
    linux) os="linux" ;;
    darwin) os="darwin" ;;
    *) error "Unsupported OS: $os"; exit 1 ;;
  esac

  case "$arch" in
    x86_64|amd64) arch="x64" ;;
    aarch64|arm64) arch="arm64" ;;
    *) error "Unsupported architecture: $arch"; exit 1 ;;
  esac

  echo "${os}-${arch}"
}

# Check for bun
check_bun() {
  if ! command -v bun &>/dev/null; then
    warn "Bun is not installed. Installing bun first..."
    curl -fsSL https://bun.sh/install | bash
    export PATH="$HOME/.bun/bin:$PATH"
  fi
  info "Using bun $(bun --version)"
}

# Install from source
install_from_source() {
  local tmpdir
  tmpdir="$(mktemp -d)"
  trap "rm -rf $tmpdir" EXIT

  info "Cloning codeblog-app..."
  git clone --depth 1 "https://github.com/${REPO}.git" "$tmpdir/codeblog-app"

  info "Installing dependencies..."
  cd "$tmpdir/codeblog-app"
  bun install --frozen-lockfile

  info "Building..."
  bun run scripts/build.ts

  # Install binary
  mkdir -p "$INSTALL_DIR"
  cp packages/codeblog/dist/codeblog "$INSTALL_DIR/$BIN_NAME"
  chmod +x "$INSTALL_DIR/$BIN_NAME"

  success "Installed to $INSTALL_DIR/$BIN_NAME"
}

# Add to PATH
setup_path() {
  if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    local shell_rc
    case "$SHELL" in
      */zsh) shell_rc="$HOME/.zshrc" ;;
      */bash) shell_rc="$HOME/.bashrc" ;;
      *) shell_rc="$HOME/.profile" ;;
    esac

    if ! grep -q "CODEBLOG" "$shell_rc" 2>/dev/null; then
      echo "" >> "$shell_rc"
      echo "# codeblog" >> "$shell_rc"
      echo "export PATH=\"$INSTALL_DIR:\$PATH\"" >> "$shell_rc"
      info "Added $INSTALL_DIR to PATH in $shell_rc"
      info "Run: source $shell_rc"
    fi
  fi
}

main() {
  echo ""
  echo -e "${CYAN}  ██████╗ ██████╗ ██████╗ ███████╗██████╗ ██╗      ██████╗  ██████╗ ${NC}"
  echo -e "${CYAN} ██╔════╝██╔═══██╗██╔══██╗██╔════╝██╔══██╗██║     ██╔═══██╗██╔════╝ ${NC}"
  echo -e "${CYAN} ██║     ██║   ██║██║  ██║█████╗  ██████╔╝██║     ██║   ██║██║  ███╗${NC}"
  echo -e "${CYAN} ██║     ██║   ██║██║  ██║██╔══╝  ██╔══██╗██║     ██║   ██║██║   ██║${NC}"
  echo -e "${CYAN} ╚██████╗╚██████╔╝██████╔╝███████╗██████╔╝███████╗╚██████╔╝╚██████╔╝${NC}"
  echo -e "${CYAN}  ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝ ${NC}"
  echo ""

  local platform
  platform="$(detect_platform)"
  info "Platform: $platform"

  check_bun
  install_from_source
  setup_path

  echo ""
  success "codeblog installed successfully! 🎉"
  echo ""
  echo "  Get started:"
  echo "    codeblog setup     # First-time setup"
  echo "    codeblog scan      # Scan IDE sessions"
  echo "    codeblog feed      # Browse the forum"
  echo ""
}

main "$@"
