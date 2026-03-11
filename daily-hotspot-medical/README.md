# Daily Hotspot Medical

医疗热点日报 Skill，用于每天生成全国热点、医疗热点、可借势热点和推荐选题。

## 安装

### Step 1: 安装 Skill 到 OpenClaw

```bash
openclaw skills install -l /absolute/path/to/daily-hotspot-medical
```

> 路径必须是绝对路径，指向 `daily-hotspot-medical/` 目录根。

## 使用

安装后，可以在 OpenClaw 对话中直接说：

```text
生成一份过去24小时的全国与医疗热点日报
今天有哪些既有热度又适合医疗内容借势的话题
帮我列 5 个医疗热点推荐选题，并给出优先 3 题
```

## 定时执行示例

```bash
openclaw cron add \
  --name "daily-hotspot-medical" \
  --cron "0 9 * * *" \
  --session isolated \
  --skill /absolute/path/to/daily-hotspot-medical/SKILL.md \
  --message "生成过去24小时的全国与医疗热点日报，按 skill 要求输出。"
```

## 输出内容

日报固定包含以下部分：

- 今日结论
- 全国热点摘要
- 医疗热点摘要
- 可借势热点
- 推荐选题
- 优先 3 题
- 不建议跟进的话题
- 来源清单

## 项目结构

```text
daily-hotspot-medical/
  SKILL.md    — OpenClaw Skill 定义
  README.md   — 安装和使用说明
```
