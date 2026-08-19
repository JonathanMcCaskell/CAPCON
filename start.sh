#!/bin/bash
# Launcher script for Authentic Inventory (No npm needed once built)

if [ ! -f "dist/server.cjs" ]; then
  echo "Production build not found. Building app..."
  npx vite build && npx esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs
fi

echo "🚀 Launching Authentic Inventory on http://localhost:3000"
node dist/server.cjs
