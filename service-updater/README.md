# Service Updater

自托管服务部署管理工具，通过统一注册表执行更新、重启、状态查询等操作。

支持 Docker Compose / systemd / PM2 / 自定义脚本，通过 OpenClaw Skill 接入 AI 对话，支持中文别名（如"更新 cpa"）。

## 安装

### Step 1: 安装 Skill 到 OpenClaw

```bash
openclaw skills install -l /absolute/path/to/service-updater
```

> 路径必须是绝对路径，指向 `service-updater/` 目录根。

### Step 2: 注册服务

```bash
# Docker Compose 服务
python3 scripts/servicectl.py set myapp \
  --runtime docker_compose \
  --path ~/www/myapp \
  --alias myapp
```

### Step 3: 使用

在 OpenClaw 对话中直接说：

```
更新 myapp
重启 myapp
查看 myapp 状态
```

## 命令参考

所有命令通过 `python3 scripts/servicectl.py` 执行：

| 命令 | 说明 |
|------|------|
| `list` | 列出所有已注册服务 |
| `show <service>` | 查看服务配置详情 |
| `update <service>` | 更新服务（支持 `--dry-run`） |
| `restart <service>` | 重启服务（支持 `--dry-run`） |
| `status <service>` | 查看服务运行状态 |
| `health <service>` | 健康检查 |
| `set <service>` | 创建/修改服务配置 |
| `remove <service>` | 删除服务 |

### 注册服务参数

```bash
python3 scripts/servicectl.py set <service> \
  --runtime docker_compose \   # docker_compose / systemd / pm2 / custom
  --path ~/www/myapp \         # 服务工作目录
  --alias myalias \            # 别名（可多次指定）
  --update-cmd "..." \         # 自定义更新命令
  --restart-cmd "..." \        # 自定义重启命令
  --status-cmd "..." \         # 自定义状态命令
  --health-cmd "..." \         # 自定义健康检查命令
  --version-cmd "..."          # 自定义版本探测命令
```

## 项目结构

```
service-updater/
  SKILL.md                — OpenClaw Skill 定义
  scripts/
    servicectl.py         — CLI 工具（Python 3）
  data/
    services.json         — 服务注册表（自动生成）
```

## 执行规则

- 默认使用 `/bin/sh -c` 非交互式执行，不依赖 `~/.zshrc`
- 服务通过 id 或别名解析，支持模糊匹配
- update/restart 默认先 `--dry-run`，除非用户明确要求立即执行
- Docker Compose 更新采用低停机策略：`pull && up -d`，不执行 `down`
- update/restart 后自动输出 `[VERSION_REPORT]` 版本变更报告
