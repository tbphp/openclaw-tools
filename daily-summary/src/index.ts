// index.ts — OpenClaw plugin entry point for daily-summary

import type { PluginConfig, DailySummaryResult } from "./types.js";
import { fetchAllWeather } from "./weather-api.js";
import { fetchFXSummary } from "./fx-api.js";

type OpenClawPluginApi = {
  pluginConfig?: Record<string, unknown>;
  registerTool: (tool: {
    name: string;
    label?: string;
    description: string;
    parameters: Record<string, unknown>;
    execute: (toolCallId: string, params: never) => unknown;
  }) => void;
};

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function register(api: any) {
  const pluginApi = api as OpenClawPluginApi;
  const cfg = (pluginApi.pluginConfig ?? {}) as PluginConfig;

  if (!cfg.weather?.locations?.length && !cfg.fx?.pairs?.length) {
    throw new Error("daily-summary: 未配置 weather.locations 或 fx.pairs");
  }

  pluginApi.registerTool({
    name: "daily_summary_generate",
    label: "Daily Summary: Generate",
    description: "Fetch today's weather forecast and FX rates. Returns structured JSON for AI to format.",
    parameters: {},
    execute: async () => {
      const errors: string[] = [];
      let weather: DailySummaryResult["weather"] = [];
      let fx: DailySummaryResult["fx"] = {
        currentDate: "",
        previousDate: "",
        pairs: [],
      };

      const tasks: Promise<void>[] = [];

      if (cfg.weather?.locations?.length) {
        tasks.push(
          fetchAllWeather(cfg.weather.locations)
            .then((w) => { weather = w; })
            .catch((e) => { errors.push(`天气: ${errorMessage(e)}`); }),
        );
      }

      if (cfg.fx?.pairs?.length) {
        tasks.push(
          fetchFXSummary(cfg.fx.pairs)
            .then((f) => { fx = f; })
            .catch((e) => { errors.push(`汇率: ${errorMessage(e)}`); }),
        );
      }

      await Promise.all(tasks);

      const result: DailySummaryResult = {
        generatedAt: new Date().toISOString(),
        weather,
        fx,
        errors,
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  });
}