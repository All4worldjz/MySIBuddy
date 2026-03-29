# OpenClaw 升级与日常维护 Runbook

## 目的

这份文档用于记录 `MySiBuddy` 当前这套 OpenClaw 生产系统在后续升级、重启、巡检、排障时应遵循的最小可靠流程。

它的目标不是覆盖所有理论情况，而是确保未来在做下面这些事时不踩当前已知的坑：

- 升级 Node
- 升级 OpenClaw
- 修改 systemd 服务
- 做系统重启
- 做安全收紧
- 做日常巡检

当前适用环境：

- 远端主机：`47.82.234.46`
- 远端用户：`admin`
- 当前 OpenClaw 版本：`2026.3.28`
- 当前运行方式：`systemd --user`

## 最重要提醒

后续每次升级或变更前，请先记住这 6 条：

1. 当前 `openclaw-gateway.service` 把 Node 路径写死在 `~/.nvm/versions/node/v24.14.1/...`
2. 如果你升级 Node 并清掉旧版本目录，但没改 systemd unit，OpenClaw 会直接起不来
3. 当前 live 系统为了可用性把 `sandbox.mode` 设成了 `off`，不要误以为还是 `non-main`
4. 当前 `Feishu calendar / reminders / tasks` 还没有正式接入，不要把“飞书插件可用”误解成“飞书全家桶都可用”
5. 当前 `cron` 可以运行，但多通道环境下要显式指定投递目标，不能依赖模糊的 `channel=last`
6. 每次改完后必须重新跑状态检查和通道探测，不能只看服务是不是 active

## 当前服务基线

当前服务文件：

- `/home/admin/.config/systemd/user/openclaw-gateway.service`

当前关键属性：

- `Linger=yes`
- `WantedBy=default.target`
- `Restart=always`
- `RestartSec=5`
- `After=network-online.target`
- `Wants=network-online.target`

当前启用链路：

- `/home/admin/.config/systemd/user/default.target.wants/openclaw-gateway.service`

当前硬编码路径：

- Node:
  - `/home/admin/.nvm/versions/node/v24.14.1/bin/node`
- OpenClaw entry:
  - `/home/admin/.nvm/versions/node/v24.14.1/lib/node_modules/openclaw/dist/index.js`

## 升级前检查

每次升级前，先做这一组检查并保存结果。

### 1. 基础状态

```bash
ssh -o BatchMode=yes 47.82.234.46 'export PATH=$HOME/.nvm/versions/node/v24.14.1/bin:$PATH; openclaw --version; echo "---"; openclaw status; echo "---"; openclaw channels status --probe'
```

### 2. 当前 systemd 配置

```bash
ssh -o BatchMode=yes 47.82.234.46 'systemctl --user cat openclaw-gateway; echo "---"; systemctl --user show openclaw-gateway -p UnitFileState -p ActiveState -p Restart -p ExecStart -p FragmentPath'
```

### 3. 当前安全审计

```bash
ssh -o BatchMode=yes 47.82.234.46 'export PATH=$HOME/.nvm/versions/node/v24.14.1/bin:$PATH; openclaw security audit'
```

### 4. 当前配置快照

```bash
ssh -o BatchMode=yes 47.82.234.46 'sed -n "1,260p" /home/admin/.openclaw/openclaw.json'
```

### 5. 当前 systemd user 基础条件

```bash
ssh -o BatchMode=yes 47.82.234.46 'loginctl show-user admin -p Linger; echo "---"; systemctl --user is-enabled openclaw-gateway; systemctl --user is-active openclaw-gateway'
```

## 升级前备份

升级前必须备份下面三类内容：

1. `~/.openclaw`
2. `~/.config/systemd/user/openclaw-gateway.service`
3. 当前仓库文档和模板

### 远端备份命令

```bash
ssh -o BatchMode=yes 47.82.234.46 'mkdir -p ~/.openclaw-backup && TS=$(date +%Y%m%d-%H%M%S) && cp -a ~/.openclaw ~/.openclaw-backup/backup-$TS && cp -a ~/.config/systemd/user/openclaw-gateway.service ~/.openclaw-backup/openclaw-gateway.service-$TS && echo "$TS"'
```

## OpenClaw 升级 Runbook

### 场景 A：只升级 OpenClaw，不升级 Node 主版本

这是风险较低的升级路径。

步骤：

1. 做升级前检查
2. 做远端备份
3. 升级 OpenClaw
4. 核对 `openclaw --version`
5. 重启 `openclaw-gateway`
6. 跑全量验收

验收命令：

```bash
ssh -o BatchMode=yes 47.82.234.46 'export PATH=$HOME/.nvm/versions/node/v24.14.1/bin:$PATH; openclaw --version; echo "---"; openclaw status; echo "---"; openclaw agents list --bindings; echo "---"; openclaw channels status --probe; echo "---"; openclaw plugins doctor; echo "---"; openclaw security audit'
```

### 场景 B：升级 Node，并可能导致 NVM 版本目录变化

这是最需要小心的升级路径。

步骤：

1. 做升级前检查
2. 做远端备份
3. 安装新 Node 版本
4. 确认新的 Node 路径
5. 确认新的 OpenClaw CLI 路径
6. 更新 `openclaw-gateway.service` 的 `ExecStart`
7. 必要时同步更新 service 内 `PATH`
8. `systemctl --user daemon-reload`
9. `systemctl --user restart openclaw-gateway`
10. 跑全量验收

### Node 升级后必须检查的两件事

1. `ExecStart` 里的 node 路径是否仍然存在
2. `ExecStart` 里的 openclaw dist 路径是否仍然存在

如果任一不存在，服务看起来可能“启用了”，但实际启动会失败。

## systemd 变更 Runbook

只要改了 `/home/admin/.config/systemd/user/openclaw-gateway.service`，都必须执行：

```bash
ssh -o BatchMode=yes 47.82.234.46 'systemctl --user daemon-reload && systemctl --user restart openclaw-gateway && sleep 3 && systemctl --user status openclaw-gateway --no-pager -l'
```

然后立即跑：

```bash
ssh -o BatchMode=yes 47.82.234.46 'export PATH=$HOME/.nvm/versions/node/v24.14.1/bin:$PATH; openclaw status; echo "---"; openclaw channels status --probe'
```

## 操作系统重启后验收

如果远端机器做了 OS reboot，开机后第一时间检查：

```bash
ssh -o BatchMode=yes 47.82.234.46 'loginctl show-user admin -p Linger; echo "---"; systemctl --user is-enabled openclaw-gateway; systemctl --user is-active openclaw-gateway; echo "---"; export PATH=$HOME/.nvm/versions/node/v24.14.1/bin:$PATH; openclaw status; echo "---"; openclaw channels status --probe'
```

验收标准：

- `Linger=yes`
- `openclaw-gateway` 仍是 `enabled`
- `openclaw-gateway` 是 `active`
- `openclaw status` 显示 gateway running
- Telegram `chief` / `personal` 都 `works`
- Feishu `work` `works`

## 日常维护注意事项

### 1. 不要只看 systemd active

`systemctl --user is-active openclaw-gateway` 只能说明进程活着，不代表通道真的能收发，不代表 agent 真能执行。

最少还要补两步：

- `openclaw status`
- `openclaw channels status --probe`

### 2. 定期看 security audit

当前基线是：

- `0 critical`
- `3 warn`
- `1 info`

如果以后审计重新出现 `critical`，要当成真实回退处理，不要忽略。

### 3. Feishu 不回复时不要先怀疑通道

这套系统历史上出现过“Feishu 看起来没回复”，但根因不是通道断了，而是 agent 在不支持的能力上执行失败。

排查顺序应该是：

1. `channels status --probe`
2. systemd 日志
3. agent 工具调用错误
4. 是否请求了当前未接入的 Feishu 能力

### 4. 记住当前 Feishu 能力边界

当前可以认为已接入：

- Feishu chat
- doc
- wiki
- drive
- bitable

当前不要假设已接入：

- calendar
- native reminders
- tasks

### 5. 记住当前 sandbox 现实状态

文档设计里最初希望是 `non-main`，但 live 生产机当前是：

- `sandbox=off`

原因不是设计漂移，而是这台机器没有 Docker。

### 6. 改配置后一定重跑全量检查

任何与下面内容相关的变更后，都应该重跑完整验收：

- `openclaw.json`
- systemd unit
- Node 版本
- OpenClaw 版本
- secrets 注入方式
- channel account 配置
- bindings

### 7. Cron 任务不要依赖模糊投递

在多通道环境下，提醒或通知类 cron 任务不要假设：

- `channel=last`

这类模糊目标可能导致任务运行了，但通知没有正确送达。

### 8. 模型问题要区分三层

排查时分开看：

1. auth profile 是否存在
2. provider 是否能真实调用
3. 是否被旧 session 的模型粘性误导

MiniMax 之前就是第三种问题，不是 token 坏了。

## 推荐的日常巡检命令

### 快速巡检

```bash
ssh -o BatchMode=yes 47.82.234.46 'export PATH=$HOME/.nvm/versions/node/v24.14.1/bin:$PATH; openclaw status; echo "---"; openclaw channels status --probe'
```

### 完整巡检

```bash
ssh -o BatchMode=yes 47.82.234.46 'export PATH=$HOME/.nvm/versions/node/v24.14.1/bin:$PATH; openclaw --version; echo "---"; openclaw status; echo "---"; openclaw agents list --bindings; echo "---"; openclaw channels status --probe; echo "---"; openclaw plugins doctor; echo "---"; openclaw security audit'
```

### systemd 巡检

```bash
ssh -o BatchMode=yes 47.82.234.46 'loginctl show-user admin -p Linger; echo "---"; systemctl --user is-enabled openclaw-gateway; systemctl --user is-active openclaw-gateway; echo "---"; systemctl --user show openclaw-gateway -p ExecStart -p Restart -p FragmentPath'
```

## 回滚原则

如果升级后出现以下任意情况：

- gateway 起不来
- channels probe 失败
- IM 消息完全不回复
- security audit 出现新的 critical
- systemd unit 指向了不存在的 Node / OpenClaw 路径

优先做法：

1. 停止继续改动
2. 恢复备份的 `~/.openclaw`
3. 恢复备份的 `openclaw-gateway.service`
4. `daemon-reload`
5. 重启服务
6. 重跑验收

## 最终提醒

这套系统目前已经具备：

- 可运行
- 可恢复
- 可升级
- 可审计

但它还没有到“升级可随便做”的程度。

以后每次升级最该记住的就一句话：

> 先备份，再改服务，再验收；尤其要检查 Node 路径、OpenClaw 路径、channels probe 和 security audit。
