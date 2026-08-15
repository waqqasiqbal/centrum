#!/usr/bin/env bash
set -euo pipefail

repository_path="${1:-$PWD}"
run_live=false
if [[ "$repository_path" == "--live" ]]; then
  repository_path="$PWD"
  run_live=true
elif [[ "${2:-}" == "--live" ]]; then
  run_live=true
fi

if [[ ! -f "$repository_path/package.json" ]] || \
   ! grep -q '"name": "ai-interfaces"' "$repository_path/package.json"; then
  echo "Expected the AI Interfaces repository at: $repository_path" >&2
  exit 1
fi

node_major="$(node -p 'Number(process.versions.node.split(".")[0])')"
if (( node_major < 22 )); then
  echo "Node.js 22 or newer is required; found $(node --version)." >&2
  exit 1
fi

cd "$repository_path"
pnpm_command=(corepack pnpm@10.14.0)
CI=true "${pnpm_command[@]}" install --frozen-lockfile
"${pnpm_command[@]}" build:packages
"${pnpm_command[@]}" typecheck
"${pnpm_command[@]}" test:unit
"${pnpm_command[@]}" --filter @ai-interfaces/playground build

if [[ "$run_live" == true ]]; then
  if [[ -z "${OPENAI_API_KEY:-}" ]]; then
    echo "OPENAI_API_KEY is required with --live." >&2
    exit 1
  fi
  "${pnpm_command[@]}" test:llm
else
  echo "Deterministic setup complete. Live OpenAI tests were not requested."
fi
