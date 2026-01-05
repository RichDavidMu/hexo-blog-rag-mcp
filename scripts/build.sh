#!/bin/bash

echo "node: $(node -v)"
echo "npm: v$(npm -v)"
echo "pnpm: v$(pnpm -v)"

pnpm install --frozen-lockfile
pnpm run build:mcp
