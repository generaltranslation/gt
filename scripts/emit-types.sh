#!/bin/sh
set -e

if [ "$#" -eq 0 ]; then
  set -- -p tsconfig.json
fi

has_tsbuildinfo_file=false

for arg in "$@"; do
  case "$arg" in
    -b|--build|--build=*)
      echo "emit-types.sh does not support tsc build mode; pass -p <tsconfig> instead." >&2
      exit 1
      ;;
    --tsBuildInfoFile|--tsBuildInfoFile=*)
      has_tsbuildinfo_file=true
      ;;
  esac
done

if [ "$has_tsbuildinfo_file" = false ]; then
  tsbuildinfo_file=$(mktemp "${TMPDIR:-/tmp}/emit-types.XXXXXX")
  trap 'rm -f "$tsbuildinfo_file"' EXIT HUP INT TERM
  set -- "$@" --tsBuildInfoFile "$tsbuildinfo_file"
fi

tsc "$@" --emitDeclarationOnly
