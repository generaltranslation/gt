#!/bin/sh
set -e

if [ "$#" -eq 0 ]; then
  set -- -b --force
fi

exec tsc "$@" --emitDeclarationOnly
