// fx-api.ts — Frankfurter exchange rate client with trading day comparison

import type { FXPairRate, FXSummary } from "./types.js";

const DEFAULT_FX_API_URL = "https://api.frankfurter.app";
const REQUEST_TIMEOUT = 5000;
const LOOKBACK_DAYS = 7;

type TimeSeriesResponse = {
  base: string;
  start_date: string;
  end_date: string;
  rates: Record<string, Record<string, number>>;
};

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type ParsedPair = { base: string; quote: string };

function parsePair(pair: string): ParsedPair {
  const parts = pair.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`无效的货币对格式: ${pair}`);
  }
  return { base: parts[0], quote: parts[1] };
}
async function fetchTimeSeries(base: string, quotes: string[], baseUrl: string): Promise<TimeSeriesResponse> {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - LOOKBACK_DAYS);
  const url = `${baseUrl}/${formatDate(start)}..${formatDate(end)}?base=${base}&symbols=${quotes.join(",")}`;
  return fetchJson<TimeSeriesResponse>(url);
}
function extractLastTwoTradingDays(
  rates: Record<string, Record<string, number>>,
): { currentDate: string; previousDate: string; currentRates: Record<string, number>; previousRates: Record<string, number> } {
  const tradingDays = Object.keys(rates).sort();
  if (tradingDays.length < 2) {
    throw new Error("可用交易日不足，无法计算日环比");
  }
  const currentDate = tradingDays[tradingDays.length - 1]!;
  const previousDate = tradingDays[tradingDays.length - 2]!;
  return {
    currentDate,
    previousDate,
    currentRates: rates[currentDate]!,
    previousRates: rates[previousDate]!,
  };
}
export async function fetchFXSummary(pairs: string[], fxApiUrl?: string): Promise<FXSummary> {
  const baseUrl = fxApiUrl || DEFAULT_FX_API_URL;
  const parsed = pairs.map(parsePair);
  const grouped = new Map<string, string[]>();
  for (const { base, quote } of parsed) {
    const existing = grouped.get(base);
    if (existing) {
      existing.push(quote);
    } else {
      grouped.set(base, [quote]);
    }
  }
  const allPairRates: FXPairRate[] = [];
  let latestCurrentDate = "";
  let latestPreviousDate = "";
  const requests = Array.from(grouped.entries()).map(async ([base, quotes]) => {
    const data = await fetchTimeSeries(base, quotes, baseUrl);
    const { currentDate, previousDate, currentRates, previousRates } = extractLastTwoTradingDays(data.rates);
    if (currentDate > latestCurrentDate) latestCurrentDate = currentDate;
    if (previousDate > latestPreviousDate) latestPreviousDate = previousDate;
    for (const quote of quotes) {
      const current = currentRates[quote];
      const previous = previousRates[quote];
      if (current == null || previous == null) {
        throw new Error(`缺少 ${base}/${quote} 的汇率数据`);
      }
      const change = current - previous;
      const changePercent = previous !== 0 ? (change / previous) * 100 : 0;
      allPairRates.push({
        base,
        quote,
        current,
        previous,
        change: Math.round(change * 10000) / 10000,
        changePercent: Math.round(changePercent * 100) / 100,
      });
    }
  });
  await Promise.all(requests);
  return {
    currentDate: latestCurrentDate,
    previousDate: latestPreviousDate,
    pairs: allPairRates,
  };
}