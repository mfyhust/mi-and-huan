#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
if [[ -x .runtime/node ]]; then export PATH="$PWD/.runtime:$PATH"; fi
edition="${1:-local}"
if [[ "$edition" != local && "$edition" != api ]]; then echo '用法：bash 启动校内体验.sh local 或 api'; exit 1; fi
if [[ -z "${MIGUI_DEMO_ORIGIN:-}" || -z "${MIGUI_DEMO_CODE:-}" ]]; then
 echo '先设置MIGUI_DEMO_ORIGIN为校园网私有IPv4网址，MIGUI_DEMO_CODE为体验口令，详见先读我。'; exit 1
fi
export MIGUI_DEMO_EDITION="$edition" MIGUI_DEMO_SCOPE=lan
exec node remote/server.mjs
