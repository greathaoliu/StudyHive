#!/bin/bash

# StudyHive 开发启动脚本

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# 检查依赖是否安装
if [ ! -d "node_modules" ]; then
  echo "📦 首次运行，安装依赖..."
  pnpm install
fi

echo "🚀 启动 StudyHive 桌面应用..."
cd apps/desktop
npx electron-vite dev
