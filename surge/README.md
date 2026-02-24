# OpenClaw Surge Plugin

通过 Telegram 管理 [Surge](https://nssurge.com/) 代理客户端。

- 交互面板 — `/surge` 命令打开 Telegram 内联按钮面板，管理策略组和出站模式
- 自然语言控制 — 通过 `surge-control` Skill，用自然语言让 AI 代理操控 Surge
- 诊断工具 — 测试策略组连通性、刷新 DNS、重载配置

## 快速开始

按以下顺序执行，共 3 步。

### Step 1: 构建插件

```bash
cd surge
npm install
npm run build
```

### Step 2: 安装到 OpenClaw

```bash
openclaw plugins install -l /absolute/path/to/surge
```

> 路径必须是绝对路径，指向 `surge/` 目录根。

### Step 3: 配置插件

在 OpenClaw 插件设置中配置 `Surge Manager`，配置内容如下：

```json
{
  "apiUrl": "https://127.0.0.1:6171",
  "apiKey": "your-surge-api-key",
  "coreGroups": ["Proxy", "Streaming", "OpenAI"]
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `apiUrl` | 否 | Surge HTTP API 地址，默认 `https://127.0.0.1:6171` |
| `apiKey` | 是 | Surge HTTP API 密钥（`X-Key` 请求头） |
| `coreGroups` | 否 | 主面板显示的策略组列表，留空则自动检测 |

> 需要在 Surge 中开启 HTTP API：偏好设置 > 通用 > HTTP API，并设置密码。

## 使用方式

### 交互命令

在对话中输入 `/surge` 打开交互面板：

- **模式切换** — Direct / Rule / Global Proxy
- **策略组** — 点击策略组查看可用节点并切换

### 子命令

| 命令 | 说明 |
|------|------|
| `/surge status` | 查看当前出站模式 |
| `/surge mode [direct\|rule\|proxy]` | 获取或设置出站模式 |
| `/surge select <组名> <节点名>` | 切换策略组节点 |
| `/surge groups` | 列出可见策略组 |
| `/surge test <组名>` | 测试策略组连通性 |
| `/surge flush` | 刷新 DNS 缓存 |
| `/surge reload` | 重载 Surge 配置 |

### 自然语言（Agent Skill）

插件包含 `surge-control` Skill，可以直接用自然语言控制：

- "把 Proxy 组切换到香港节点"
- "开启全局代理模式"
- "测试 OpenAI 策略组"
- "刷新 DNS"

## 项目结构

```
surge/
  src/
    index.ts            — 插件入口，注册 /surge 命令
    commands.ts         — 子命令处理逻辑
    surge-api.ts        — Surge HTTP API 客户端
    tg-api.ts           — Telegram 内联按钮交互
    formatter.ts        — 输出格式化 + 按钮构建
    matcher.ts          — 策略组 / 节点名模糊匹配
    cache.ts            — 策略组缓存
  skills/
    surge-control/
      SKILL.md          — AI 自然语言控制 Skill
  openclaw.plugin.json  — 插件清单 + 配置 Schema
  package.json
  tsconfig.json
```

## 前置要求

- OpenClaw >= 2026.1.0
- Surge for Mac（需开启 HTTP API）
- OpenClaw 到 Surge 的网络可达（默认 localhost:6171）
