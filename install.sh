#!/usr/bin/env bash
# One-line installer for both supported targets:
#
#   curl -fsSL https://raw.githubusercontent.com/alioth-stat/phillips-installed-base-intelligence/master/install.sh | bash
#
# Run it in a normal terminal and it sets up the desktop dev environment
# (delegates to run.sh). Paste the exact same command into Termux on an
# Android phone and it installs the on-device path instead -- see
# context/termux-android-demo.md for why that's a different set of steps,
# not just "the same thing on a smaller screen".
#
# No interactive prompt: `curl | bash` pipes stdin from curl, not the
# terminal, so a "pick 1 or 2" menu wouldn't actually work here. Termux is
# reliably auto-detectable instead. Override with --phone / --desktop if you
# ever need to force one path (e.g. testing the Termux branch's logic).
set -euo pipefail

REPO_URL="https://github.com/alioth-stat/phillips-installed-base-intelligence.git"
REPO_DIR="phillips-installed-base-intelligence"

target=""
for arg in "$@"; do
    case "$arg" in
        --phone) target=phone ;;
        --desktop) target=desktop ;;
    esac
done

if [ -z "$target" ]; then
    if [ -n "${TERMUX_VERSION:-}" ] || [ -d /data/data/com.termux/files/usr ]; then
        target=phone
    else
        target=desktop
    fi
fi

echo "Philips Installed Base Intelligence -- installing for: $target"
echo

# Re-running this from inside an already-cloned checkout should reuse it
# rather than clone a nested copy.
if [ -f run.sh ] && [ -f requirements.txt ]; then
    : # already in the repo root
elif [ -d "$REPO_DIR" ]; then
    cd "$REPO_DIR"
else
    command -v git >/dev/null 2>&1 || { echo "git is required -- install it first." >&2; exit 1; }
    git clone "$REPO_URL" "$REPO_DIR"
    cd "$REPO_DIR"
fi

if [ "$target" = phone ]; then
    echo "Installing Termux system packages (python, node, ffmpeg, clang)..."
    pkg update -y
    pkg install -y python nodejs-lts ffmpeg clang git

    if [ ! -d .venv ]; then
        python3 -m venv .venv
        # pandas is only used by the Streamlit fallback UI (app.py), not the
        # FastAPI path this runs -- it's also the dependency most likely to
        # need a from-source build under Termux's bionic libc, so skip it
        # here rather than fight it for a path that never imports it.
        grep -v '^pandas$' requirements.txt > /tmp/requirements.termux.txt
        .venv/bin/pip install -q -r /tmp/requirements.termux.txt
    fi

    if [ ! -d frontend/node_modules ]; then
        (cd frontend && npm install)
    fi

    echo "Installing the QVAC worker..."
    # Non-fatal: qvac_client resolves the worker lazily too, and the
    # platform-detection risk documented in context/termux-android-demo.md
    # means this can legitimately need a manual retry on some devices.
    .venv/bin/python -m tetherto.qvac_sdk install-worker || \
        echo "install-worker failed -- see 'Known risk' in context/termux-android-demo.md" >&2

    echo
    echo "Done. Run ./run.sh, then open http://localhost:5173 in THIS phone's own browser."
else
    echo "Handing off to run.sh for setup + launch..."
    exec ./run.sh
fi
