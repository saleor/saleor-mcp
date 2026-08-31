#!/bin/sh
set -eu

usage() {
  printf '%s\n' 'Usage: run-detached-codex.sh --url <https-url> --token-env <ENV_NAME> --prompt-file <file> --workdir <empty-dir> --output-dir <dir>' >&2
  exit 2
}

mcp_url=''
token_env=''
prompt_file=''
test_workdir=''
output_dir=''

while [ "$#" -gt 0 ]; do
  [ "$#" -ge 2 ] || usage
  case "$1" in
    --url) mcp_url=$2 ;;
    --token-env) token_env=$2 ;;
    --prompt-file) prompt_file=$2 ;;
    --workdir) test_workdir=$2 ;;
    --output-dir) output_dir=$2 ;;
    *) usage ;;
  esac
  shift 2
done

[ -n "$mcp_url" ] && [ -n "$token_env" ] && [ -n "$prompt_file" ] && [ -n "$test_workdir" ] && [ -n "$output_dir" ] || usage
[ -n "$(printenv "$token_env" 2>/dev/null || true)" ] || { printf '%s\n' "Environment variable $token_env is empty or unset." >&2; exit 2; }
[ -f "$prompt_file" ] || { printf '%s\n' "Prompt file not found: $prompt_file" >&2; exit 2; }
[ -d "$test_workdir" ] || { printf '%s\n' "Working directory not found: $test_workdir" >&2; exit 2; }
[ -z "$(find "$test_workdir" -mindepth 1 -maxdepth 1 -print -quit)" ] || { printf '%s\n' "Working directory must be empty: $test_workdir" >&2; exit 2; }
mkdir -p "$output_dir"

codex exec - \
  --ephemeral \
  --ignore-user-config \
  --skip-git-repo-check \
  --sandbox read-only \
  --cd "$test_workdir" \
  --json \
  --output-last-message "$output_dir/final.txt" \
  --config "mcp_servers.saleor.url=\"$mcp_url\"" \
  --config "mcp_servers.saleor.bearer_token_env_var=\"$token_env\"" \
  --config 'mcp_servers.saleor.required=true' \
  --config 'mcp_servers.saleor.default_tools_approval_mode="writes"' \
  < "$prompt_file" \
  > "$output_dir/trace.jsonl"

printf '%s\n' "$output_dir/trace.jsonl" "$output_dir/final.txt"
