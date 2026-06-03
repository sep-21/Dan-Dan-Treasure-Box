#!/bin/zsh
cd "$(dirname "$0")"
npm run build
./node_modules/electron/dist/Electron.app/Contents/MacOS/Electron .
