#!/bin/sh
if patch -p1 -N --dry-run < $1 > /dev/null; then
    patch -p1 -N < $1
else
    exit 0
fi
