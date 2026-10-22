#!/usr/bin/env bash
# Build the real production bundle and serve it with `vite preview` on 127.0.0.1:4180
# (the same dist/ GitHub Pages deploys, under /hackathon-hq/). No backend: all state is the
# seed plus this browser's localStorage. `./stack.sh stop` kills the server by its PID.
set -euo pipefail
cd "$(dirname "$0")"
RUN=.run
mkdir -p "$RUN"
if [[ "${1:-}" == "stop" ]]; then
  [[ -f $RUN/pids ]] || { echo "no $RUN/pids"; exit 0; }
  while read -r pid name; do
    if kill "$pid" 2>/dev/null; then echo "killed $name ($pid)"; else echo "$name ($pid) already gone"; fi
  done < "$RUN/pids"
  rm -f "$RUN/pids"
  exit 0
fi
(cd .. && npm run build > e2e/$RUN/build.log 2>&1) || { cat "$RUN/build.log"; exit 1; }
: > "$RUN/pids"
(cd .. && exec node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4180 --strictPort) > "$RUN/preview.log" 2>&1 &
echo "$! preview" >> "$RUN/pids"
echo "preview pid $! on http://127.0.0.1:4180/hackathon-hq/"
for _ in $(seq 100); do curl -sf http://127.0.0.1:4180/hackathon-hq/ > /dev/null && { echo "stack up"; exit 0; }; sleep 0.1; done
cat "$RUN/preview.log"; exit 1
