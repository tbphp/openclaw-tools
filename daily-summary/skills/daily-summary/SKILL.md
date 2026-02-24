---
name: daily-summary
description: Format daily weather forecasts and FX rate summaries into Chinese notifications for Telegram push. Use when the daily_summary_generate tool returns structured JSON data containing weather and exchange rate information.
---

# Daily Summary Skill

当 `daily_summary_generate` 工具返回结果后，按以下规则格式化输出。


## 天气部分

对每个 `weather[]` 条目，输出今日天气（`forecast` 字段）：

```
🌤 {name} 今日天气
{weatherDesc} | {tempMin}°C ~ {tempMax}°C
降水概率: {precipProbability}%
空气质量: AQI {aqi} | PM2.5 {pm25} | PM10 {pm10}
```
如果 `airQuality` 字段缺失，省略空气质量行。多个地点之间空一行。

## 汇率部分

标题行：

```
💱 汇率行情（{currentDate}）
```

对每个 `fx.pairs[]` 条目：

```
{base}/{quote}: {current}（涨跌标记 {changePercent}%）
```

涨跌标记规则：
- `change > 0` 时显示 📈 并在百分比前加 `+`
- `change < 0` 时显示 📉
- `change = 0` 时显示 ➡️

在汇率列表后追加对比日期说明：

```
对比交易日: {previousDate}
```

## 错误处理

如果 `errors[]` 非空，在末尾追加：

```
⚠️ 部分数据获取失败:
{逐条列出错误信息}
```

## 无数据时

如果 weather 和 fx.pairs 都为空数组，回复：

```
HEARTBEAT_OK
```

## 格式要求

- 所有输出使用中文
- 数字保留合理精度（温度整数，汇率 4 位小数，百分比 2 位小数）
- 不要添加额外的寒暄或解释，只输出格式化后的摘要
