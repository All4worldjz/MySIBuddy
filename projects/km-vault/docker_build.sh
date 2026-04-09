#!/bin/bash
# docker_build_km_vault.sh - 构建知识库编译服务 Docker 镜像
# 作者：tech-mentor
# 创建时间：2026-04-08

set -e

VAULT_DIR="/home/admin/.openclaw/workspace-tech-mentor/KM_Vault"
IMAGE_NAME="km-vault:latest"
CONTAINER_NAME="km-vault-runner"

echo "[INFO] 构建知识库编译服务 Docker 镜像"
echo "[INFO] 工作目录: $VAULT_DIR"
echo ""

# 检查 Dockerfile
if [[ ! -f "$VAULT_DIR/Dockerfile" ]]; then
  echo "[ERROR] Dockerfile not found: $VAULT_DIR/Dockerfile"
  exit 1
fi

# 构建镜像
echo "[BUILD] 构建 Docker 镜像: $IMAGE_NAME"
cd "$VAULT_DIR"
docker build -t "$IMAGE_NAME" .

if [[ $? -eq 0 ]]; then
  echo "[SUCCESS] 镜像构建成功"
  echo "[INFO] 镜像名称: $IMAGE_NAME"
  echo ""
  echo "[INFO] 运行容器命令:"
  echo "  docker run -d \\"
  echo "    --name $CONTAINER_NAME \\"
  echo "    -v \"$(dirname $VAULT_DIR)\":/app/vault \\"
  echo "    $IMAGE_NAME"
  echo ""
  echo "[INFO] 查看日志:"
  echo "  docker logs -f $CONTAINER_NAME"
else
  echo "[ERROR] 镜像构建失败"
  exit 1
fi
