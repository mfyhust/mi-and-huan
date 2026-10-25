#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
if [[ -x .runtime/node ]]; then export PATH="$PWD/.runtime:$PATH"; fi
node_ready(){ command -v node >/dev/null 2>&1 && node -e 'const [major,minor]=process.versions.node.split(".").map(Number);process.exit(major>22||major===22&&minor>=13?0:1)' >/dev/null 2>&1; }
if ! node_ready; then
  runtime_node="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin"
  if [[ -x "$runtime_node/node" ]]; then export PATH="$runtime_node:$PATH"; fi
fi
if ! node_ready; then echo '需要预先准备Node.js 22.13或更新版本；此脚本不会联网安装。'; exit 1; fi
exec node offline/server.mjs
