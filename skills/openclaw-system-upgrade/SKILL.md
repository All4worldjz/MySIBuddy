# OpenClaw 系统升级技能 (System Upgrade Skill)

## 概述
此技能用于安全地将 OpenClaw 系统从当前版本升级到最新版本。包含完整的备份、升级、验证和回滚流程。

## 适用场景
- OpenClaw 有新版本可用时
- 需要应用安全补丁时
- 需要获取新功能或错误修复时

## 风险评估
- **高风险操作**: 升级可能导致服务暂时中断
- **配置兼容性**: 新版本可能与当前配置不兼容
- **数据完整性**: 操作不当可能导致数据丢失

## 预防措施 (Precautions)
1. **全量备份**: 升级前必须执行完整备份
2. **服务验证**: 确认所有服务当前运行正常
3. **备份验证**: 验证备份文件完整性
4. **回滚准备**: 准备好回滚方案

## 操作流程

### 第一步：备份与准备 (Backup and Preparation)
1. **创建备份目录**:
   ```bash
   ssh admin@47.82.234.46 'mkdir -p ~/mysibuddy_vault/backup'
   ```

2. **执行全量备份**:
   ```bash
   # 创建备份脚本
   ssh admin@47.82.234.46 'cat > ~/mysibuddy_vault/backup/create_full_backup.sh << "EOF"
   #!/bin/bash
   
   # MySiBuddy 全量备份脚本
   # 用于备份 OpenClaw 配置到 ~/mysibuddy_vault/backup 目录
   
   set -e
   
   TIMESTAMP=$(date +%Y%m%d_%H%M%S)
   BACK_UP_DIR="$HOME/mysibuddy_vault/backup"
   OPENCLAW_BASE="$HOME/.openclaw"
   
   echo "开始全量备份，时间戳: $TIMESTAMP"
   
   # 创建备份子目录
   CONFIG_BACK_UP_DIR="$BACK_UP_DIR/config_$TIMESTAMP"
   MEMORY_BACK_UP_DIR="$BACK_UP_DIR/memory_$TIMESTAMP"
   SYSTEM_BACK_UP_DIR="$BACK_UP_DIR/system_$TIMESTAMP"
   
   mkdir -p "$CONFIG_BACK_UP_DIR" "$MEMORY_BACK_UP_DIR" "$SYSTEM_BACK_UP_DIR"
   
   # 备份配置文件
   echo "备份配置文件..."
   cp -r "$OPENCLAW_BASE/agents" "$CONFIG_BACK_UP_DIR/" 2>/dev/null || echo "跳过agents目录"
   cp "$OPENCLAW_BASE/openclaw.json" "$SYSTEM_BACK_UP_DIR/" 2>/dev/null || echo "跳过openclaw.json"
   cp "$OPENCLAW_BASE/runtime-secrets.json" "$SYSTEM_BACK_UP_DIR/" 2>/dev/null || echo "跳过runtime-secrets.json"
   cp "$OPENCLAW_BASE/gateway.env" "$SYSTEM_BACK_UP_DIR/" 2>/dev/null || echo "跳过gateway.env"
   cp -r "$OPENCLAW_BASE/memory" "$MEMORY_BACK_UP_DIR/" 2>/dev/null || echo "跳过memory目录"
   cp -r "$OPENCLAW_BASE/wiki" "$SYSTEM_BACK_UP_DIR/" 2>/dev/null || echo "跳过wiki目录"
   
   # 创建备份清单
   echo "创建备份清单..."
   cat > "$BACK_UP_DIR/backup_manifest_$TIMESTAMP.txt" << MANIFEST
   备份时间: $(date)
   备份类型: 全量备份
   备份内容:
   - OpenClaw 配置文件
   - Agent 配置
   - 运行时密钥
   - 记忆数据
   - 系统配置
   
   备份路径:
   - 配置: $CONFIG_BACK_UP_DIR
   - 记忆: $MEMORY_BACK_UP_DIR
   - 系统: $SYSTEM_BACK_UP_DIR
   MANIFEST
   
   echo "全量备份完成!"
   echo "备份位置: $BACK_UP_DIR"
   ls -la "$BACK_UP_DIR/"
   EOF'
   
   # 运行备份
   ssh admin@47.82.234.46 'chmod +x ~/mysibuddy_vault/backup/create_full_backup.sh && ~/mysibuddy_vault/backup/create_full_backup.sh'
   ```

3. **创建升级和回滚脚本**:
   ```bash
   # 升级脚本
   ssh admin@47.82.234.46 'cat > ~/mysibuddy_vault/backup/upgrade_openclaw.sh << "EOF"
   #!/bin/bash
   
   # OpenClaw 升级脚本
   # 从当前版本升级到最新版本
   
   set -e
   
   echo "开始 OpenClaw 升级过程..."
   
   # 1. 停止服务
   echo "停止 OpenClaw 服务..."
   systemctl --user stop openclaw-gateway
   systemctl --user stop unified-search-service
   
   # 2. 检查服务是否已停止
   sleep 5
   if pgrep -f "openclaw-gateway\|unified-search"; then
       echo "警告: 仍有进程在运行"
       ps aux | grep -E "(openclaw|unified-search)"
   else
       echo "服务已成功停止"
   fi
   
   # 3. 执行升级
   echo "开始升级 OpenClaw..."
   sudo npm install -g openclaw@LATEST_VERSION
   
   # 4. 更新系统服务文件中的版本号
   SERVICE_FILE="$HOME/.config/systemd/user/openclaw-gateway.service"
   if [ -f "$SERVICE_FILE" ]; then
       sed -i "s/OLD_VERSION/LATEST_VERSION/g" "$SERVICE_FILE"
       sed -i "s/OPENCLAW_SERVICE_VERSION=OLD_VERSION/OPENCLAW_SERVICE_VERSION=LATEST_VERSION/g" "$SERVICE_FILE"
       systemctl --user daemon-reload
       echo "服务文件已更新"
   fi
   
   echo "OpenClaw 升级完成，请按需启动服务"
   EOF'
   
   # 回滚脚本
   ssh admin@47.82.234.46 'cat > ~/mysibuddy_vault/backup/rollback_openclaw.sh << "EOF"
   #!/bin/bash
   
   # OpenClaw 回滚脚本
   # 从最新版本回滚到当前版本
   
   set -e
   
   echo "开始 OpenClaw 回滚过程..."
   
   # 1. 停止服务
   echo "停止 OpenClaw 服务..."
   systemctl --user stop openclaw-gateway
   systemctl --user stop unified-search-service
   
   # 2. 检查服务是否已停止
   sleep 5
   if pgrep -f "openclaw-gateway\|unified-search"; then
       echo "警告: 仍有进程在运行"
       ps aux | grep -E "(openclaw|unified-search)"
   else
       echo "服务已成功停止"
   fi
   
   # 3. 执行回滚
   echo "开始回滚 OpenClaw..."
   sudo npm install -g openclaw@CURRENT_VERSION
   
   # 4. 更新系统服务文件中的版本号
   SERVICE_FILE="$HOME/.config/systemd/user/openclaw-gateway.service"
   if [ -f "$SERVICE_FILE" ]; then
       sed -i "s/LATEST_VERSION/CURRENT_VERSION/g" "$SERVICE_FILE"
       sed -i "s/OPENCLAW_SERVICE_VERSION=LATEST_VERSION/OPENCLAW_SERVICE_VERSION=CURRENT_VERSION/g" "$SERVICE_FILE"
       systemctl --user daemon-reload
       echo "服务文件已更新"
   fi
   
   echo "OpenClaw 回滚完成，请按需启动服务"
   EOF'
   
   # 添加执行权限
   ssh admin@47.82.234.46 'chmod +x ~/mysibuddy_vault/backup/upgrade_openclaw.sh ~/mysibuddy_vault/backup/rollback_openclaw.sh'
   ```

4. **下载备份到本地**:
   ```bash
   # 创建本地备份目录
   mkdir -p /Users/whoami2028/Workshop/MySiBuddy_Vault/backup
   
   # 下载备份
   scp -r admin@47.82.234.46:/home/admin/mysibuddy_vault/backup/* /Users/whoami2028/Workshop/MySiBuddy_Vault/backup/
   ```

### 第二步：停止服务 (Stop Services)
```bash
# 停止 OpenClaw 相关服务
ssh admin@47.82.234.46 'systemctl --user stop openclaw-gateway && systemctl --user stop unified-search-service'

# 验证没有相关进程在运行
ssh admin@47.82.234.46 'ps aux | grep -E "(openclaw|unified-search)" | grep -v grep'
```

### 第三步：执行升级 (Perform Upgrade)
```bash
# 升级 OpenClaw
ssh admin@47.82.234.46 'sudo npm install -g openclaw@LATEST_VERSION'
```

### 第四步：验证版本 (Verify Version)
```bash
# 验证 OpenClaw 版本
ssh admin@47.82.234.46 'openclaw --version'
```

### 第五步：启动服务并验证 (Start Services and Verify)
```bash
# 启动服务
ssh admin@47.82.234.46 'systemctl --user daemon-reload && systemctl --user start openclaw-gateway && systemctl --user start unified-search-service'

# 等待服务启动并验证
ssh admin@47.82.234.46 'sleep 30 && openclaw status --deep'
```

### 第六步：记录结果 (Record Results)
```bash
# 创建升级成功记录
ssh admin@47.82.234.46 'echo "Upgrade completed at $(date)" > ~/mysibuddy_vault/backup/upgrade_success_LATEST_VERSION.txt && echo "OpenClaw upgraded from CURRENT_VERSION to LATEST_VERSION" >> ~/mysibuddy_vault/backup/upgrade_success_LATEST_VERSION.txt && echo "Services restarted and verified as operational" >> ~/mysibuddy_vault/backup/upgrade_success_LATEST_VERSION.txt'
```

## 回滚程序 (Rollback Procedure)
如果升级失败或出现严重问题：
1. 立即停止服务
2. 使用回滚脚本 `~/mysibuddy_vault/backup/rollback_openclaw.sh`
3. 检查服务状态
4. 验证功能正常

## 注意事项 (Notes)
- 严格按照流程操作，不得跳过任何步骤
- 升级前确保有足够的备份
- 选择业务低峰期进行升级
- 保持与团队沟通，及时通报进展

## 版本兼容性 (Version Compatibility)
- 本技能适用于 OpenClaw 2026.x 版本系列
- 对于跨大版本升级，需额外验证配置兼容性
- 建议先在测试环境验证升级流程

## 关联文档 (Related Documents)
- `session_handoff.md`: 系统交接记录
- `QWEN.md`: 系统运维核心文档
- `codex_handsoff.md`: 权威部署手册