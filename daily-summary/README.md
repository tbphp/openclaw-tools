# OpenClaw Daily Summary Plugin

每日自动推送天气预报和汇率行情到 Telegram。

- 天气预报 — 多地点，未来 3 天（Open-Meteo，免费无需 API Key）
- 汇率行情 — 多货币对，日环比涨跌分析（Frankfurter，免费无需 API Key）
- 汇率对比基于实际交易日，自动跳过周末和节假日

## 快速开始

按以下顺序执行，共 4 步。

### Step 1: 构建插件

```bash
cd daily-summary
npm install
npm run build
```

### Step 2: 安装到 OpenClaw

```bash
openclaw plugins install -l /absolute/path/to/daily-summary
```

> 路径必须是绝对路径，指向 `daily-summary/` 目录根。

### Step 3: 配置插件

在 OpenClaw 插件设置中配置 `Daily Summary`，配置内容如下：

```json
{
  "weather": {
    "locations": [
      { "city": "Beijing" },
      { "city": "Tokyo" },
      { "lat": 31.23, "lon": 121.47, "name": "上海" }
    ]
  },
  "fx": {
    "pairs": ["USD/CNY", "JPY/CNY", "EUR/CNY"]
  }
}
```

**weather.locations** — 天气地点数组，每个元素二选一：

| 方式 | 字段 | 说明 |
|------|------|------|
| 城市名 | `city` | 英文城市名，自动解析坐标 |
| 经纬度 | `lat` + `lon` + `name` | WGS84 坐标，`name` 为显示名称 |

**fx.pairs** — 汇率货币对数组，格式 `BASE/QUOTE`，支持 ECB 公布的 30+ 种货币。

### Step 4: 部署定时任务

```bash
openclaw cron add \
  --name "daily-summary" \
  --cron "0 8 * * *" \
  --session isolated \
  --skill ./skills/daily-summary.md \
  --message "调用 daily_summary_generate 获取今日天气和汇率数据，按 skill 要求格式化输出。" \
  --announce \
  --channel telegram \
  --to "telegram:<chat_id>"
```

| 参数 | 值 | 说明 |
|------|------|------|
| `--cron` | `"0 8 * * *"` | 每天早上 8 点执行（服务器时区） |
| `--session` | `isolated` | 每次执行使用独立会话 |
| `--skill` | `./skills/daily-summary.md` | AI 格式化指令 |
| `--announce` | - | 将结果发送到通知渠道 |
| `--to` | `"telegram:<chat_id>"` | 替换为你的 Telegram Chat ID |

> `--skill` 路径相对于插件安装目录。

## 测试

### 手动测试（对话中调用）

插件安装并配置完成后，在 OpenClaw 对话中发送：

```
请调用 daily_summary_generate 工具获取今日天气和汇率数据
```

### 端到端测试（模拟 cron）

```bash
openclaw run \
  --skill ./skills/daily-summary.md \
  --message "调用 daily_summary_generate 获取今日天气和汇率数据，按 skill 要求格式化输出。"
```

这会模拟完整的 cron 流程：调用工具 → AI 格式化 → 输出结果。

## 管理定时任务

```bash
# 查看所有定时任务
openclaw cron list

# 删除定时任务
openclaw cron remove --name "daily-summary"
```

## 项目结构

```
daily-summary/
  src/
    index.ts            — 插件入口，注册 daily_summary_generate 工具
    types.ts            — 类型定义
    weather-api.ts      — Open-Meteo 客户端（geocoding + 3 天预报）
    fx-api.ts           — Frankfurter 客户端（时间序列 + 交易日对比）
  skills/
    daily-summary.md    — AI 格式化 Skill（cron 触发时使用）
  openclaw.plugin.json  — 插件清单 + 配置 Schema
  package.json
  tsconfig.json
```

## 数据源

| 数据 | API | 说明 |
|------|-----|------|
| 天气预报 | [Open-Meteo](https://open-meteo.com/) | 免费，无需 API Key，600 次/分钟 |
| 城市解析 | [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api) | 城市名 → 经纬度 |
| 汇率行情 | [Frankfurter](https://www.frankfurter.app/) | 免费，无需 API Key，ECB 数据源 |