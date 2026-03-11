# Topic Deepen Medical

医疗热点选题深挖 Skill，用于把已经确认的热点继续展开成可直接开写的内容方案。

## 安装

### Step 1: 安装 Skill 到 OpenClaw

```bash
openclaw skills install -l /absolute/path/to/topic-deepen-medical
```

> 路径必须是绝对路径，指向 `topic-deepen-medical/` 目录根。

## 使用

安装后，可以在 OpenClaw 对话中直接说：

```text
把今天日报里“医保支付新规”这个题继续展开成公众号选题
围绕“儿科呼吸道感染升温”做一版小红书内容提纲，目标受众是年轻家长，目标是流量
基于已经确认的热点背景，给我 3 个标题备选和一版短视频口播提纲
```

## 输入要求

建议用户至少给出以下信息：

- 主题或热点标题
- 平台
- 目标受众
- 内容目标

如果没有这些信息，Skill 会先要求补充。

## 输出内容

- 3 个标题备选
- 一版文章提纲
- 开头切入方式
- 3 个传播点
- 风险提醒
- 适合时提供短视频口播版提纲

## 项目结构

```text
topic-deepen-medical/
  SKILL.md    — OpenClaw Skill 定义
  README.md   — 安装和使用说明
```
