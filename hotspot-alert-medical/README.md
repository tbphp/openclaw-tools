# Hotspot Alert Medical

医疗热点快扫预警 Skill，用于在短窗口内判断某个突发热点是否值得立即跟进。

## 安装

### Step 1: 安装 Skill 到 OpenClaw

```bash
openclaw skills install -l /absolute/path/to/hotspot-alert-medical
```

> 路径必须是绝对路径，指向 `hotspot-alert-medical/` 目录根。

## 使用

安装后，可以在 OpenClaw 对话中直接说：

```text
帮我快扫过去4小时内值得马上跟进的医疗热点
这个医保政策突发要不要立刻跟
快速判断这条全国热点有没有合适的医疗切口
```

## 适用时间点

- 中午固定快扫一次
- 下午固定快扫一次
- 人工临时触发

## 输出格式

固定输出以下字段：

- 结论
- 事件
- 原因
- 推荐切口
- 20分钟快提纲
- 风险
- 来源

## 项目结构

```text
hotspot-alert-medical/
  SKILL.md    — OpenClaw Skill 定义
  README.md   — 安装和使用说明
```
