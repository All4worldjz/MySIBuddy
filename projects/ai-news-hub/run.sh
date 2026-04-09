#!/bin/bash
# AI News Hub 运行脚本

cd "$(dirname "$0")"

# 确保目录存在
mkdir -p data

# 运行主程序
python3 scheduler.py "$@"
