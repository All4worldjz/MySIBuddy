# Knowledge Vault - Docker 编译服务
# 基础镜像：minimax/MiniMax-M2.7 + OpenClaw CLI
FROM minimax/llm-agent:latest

# 创建工作目录
WORKDIR /app

# 安装飞书 SDK 和依赖
RUN pip install feishu-sdk requests croniter --no-cache-dir

# 创建知识 vault 目录结构
RUN mkdir -p /app/vault/{raw,wiki,schema,docs,scripts}

# 复制脚本文件
COPY scripts/ /app/vault/scripts/

# 赋予执行权限
RUN chmod +x /app/vault/scripts/*.sh

# 创建 cron 配置
RUN echo "*/5 * * * * root /app/vault/scripts/compile_raw.sh >> /var/log/cron.log 2>&1" > /etc/cron.d/km-vault && \
    echo "0 22 * * 0 root /app/vault/scripts/compile_raw.sh巡检 >> /var/log/cron.log 2>&1" >> /etc/cron.d/km-vault && \
    echo "0 3 * * * root /app/vault/scripts/feishu_knowledge_vault_sync.sh >> /var/log/cron.log 2>&1" >> /etc/cron.d/km-vault && \
    chmod 0644 /etc/cron.d/km-vault

# 创建日志目录
RUN mkdir -p /var/log/cron

# 创建-entrypoint.sh
RUN echo '#!/bin/bash' > /entrypoint.sh && \
    echo 'cron && tail -f /var/log/cron.log' >> /entrypoint.sh && \
    chmod +x /entrypoint.sh

# 设置环境变量
ENV PYTHONUNBUFFERED=1
ENV TZ=Asia/Shanghai

# 默认启动 cron 服务
CMD ["/entrypoint.sh"]
