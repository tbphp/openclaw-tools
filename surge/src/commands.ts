import type { SurgeConfig } from "./surge-api.js";
import * as api from "./surge-api.js";
import { fuzzyMatch } from "./matcher.js";
import {
  panelTitle,
  formatGroupSelectorHeader,
  formatModeHeader,
  buildMainPanel,
  buildNodeSelector,
  buildModeSelector,
} from "./formatter.js";

type Reply = {
  text: string;
  buttons?: { text: string; callback_data: string }[][];
  parseMode?: string;
};

const CB_PREFIX = "cb:";

export async function handleSurgeCommand(
  args: string,
  surgeConfig: SurgeConfig,
): Promise<Reply> {
  const trimmed = args.trim();
  try {
    if (!trimmed) return handlePanel(surgeConfig, false);
    if (trimmed.startsWith(CB_PREFIX)) {
      return handleCallback(trimmed.slice(CB_PREFIX.length), surgeConfig);
    }

    const parts = trimmed.split(/\s+/);
    const sub = parts[0]!.toLowerCase();
    switch (sub) {
      case "status":
        return handleStatus(surgeConfig);
      case "mode":
        return handleMode(surgeConfig, parts.slice(1).join(" "));
      case "select":
      case "sel":
        return handleSelect(
          surgeConfig,
          parts.slice(1, 2).join(""),
          parts.slice(2).join(" "),
        );
      case "groups":
        return handleGroups(surgeConfig, false);
      case "groups-all":
        return handleGroups(surgeConfig, true);
      case "nodes":
        return handleNodes(surgeConfig, parts.slice(1).join(" "));
      case "reload":
        await api.reloadProfile(surgeConfig);
        return { text: "✅ 配置已重载" };
      case "flush":
        await api.flushDns(surgeConfig);
        return { text: "✅ DNS 缓存已清空" };
      case "test":
        return handleTest(surgeConfig, parts.slice(1).join(" "));
      default:
        return {
          text: "❌ 未知子命令。可用: status/mode/select/groups/nodes/reload/flush/test",
        };
    }
  } catch (err) {
    return { text: `❌ ${errorMessage(err)}` };
  }
}

async function handleCallback(
  data: string,
  config: SurgeConfig,
): Promise<Reply> {
  if (data === "back") return handlePanel(config, false);
  if (data === "allgroups") return handlePanel(config, true);
  if (data === "defaultgroups") return handlePanel(config, false);

  if (data === "mode") {
    const mode = await api.getOutboundMode(config);
    return {
      text: formatModeHeader(mode),
      buttons: buildModeSelector(mode),
      parseMode: "HTML",
    };
  }

  if (data.startsWith("sm:")) {
    await api.setOutboundMode(config, data.slice(3));
    return handlePanel(config, false);
  }

  if (data.startsWith("g:")) {
    return handleGroupSelector(config, data.slice(2));
  }

  if (data.startsWith("s:")) {
    const rest = data.slice(2);
    const idx = rest.lastIndexOf(":");
    if (idx < 0) return { text: "❌ 无效回调" };
    const group = rest.slice(0, idx);
    const nodeIndex = Number.parseInt(rest.slice(idx + 1), 10);
    const groups = await api.getPolicyGroups(config);
    const members = groups[group] ?? [];
    if (
      !Number.isInteger(nodeIndex) ||
      nodeIndex < 0 ||
      nodeIndex >= members.length
    ) {
      return { text: "❌ 无效节点索引" };
    }
    await api.setGroupSelection(config, group, members[nodeIndex]!.name);
    return handleGroupSelector(config, group);
  }

  return { text: "❌ 未知操作" };
}

async function handlePanel(
  config: SurgeConfig,
  showAll: boolean,
): Promise<Reply> {
  const [groups, order, visibility, mode] = await Promise.all([
    api.getPolicyGroups(config),
    api.getPolicyGroupOrder(config),
    api.getGroupVisibility(config),
    api.getOutboundMode(config),
  ]);

  const groupSet = new Set(Object.keys(groups));
  const visibleSet = new Set(visibility.visible);

  // Sort by /v1/policies order, append any missing ones at end
  const orderedAll = [
    ...order.filter((g) => groupSet.has(g)),
    ...Object.keys(groups).filter((g) => !order.includes(g)),
  ];
  const groupsToShow = showAll
    ? orderedAll
    : orderedAll.filter((g) => visibleSet.has(g));

  const selections = await api.getSelectionsForGroups(config, groupsToShow);

  return {
    text: panelTitle(mode),
    buttons: buildMainPanel(mode, selections, groupsToShow, showAll),
  };
}

async function handleStatus(config: SurgeConfig): Promise<Reply> {
  const mode = await api.getOutboundMode(config);
  return { text: `当前模式: ${mode}` };
}

async function handleMode(
  config: SurgeConfig,
  modeInput: string,
): Promise<Reply> {
  if (!modeInput) {
    const mode = await api.getOutboundMode(config);
    return {
      text: formatModeHeader(mode),
      buttons: buildModeSelector(mode),
      parseMode: "HTML",
    };
  }
  const matched = fuzzyMatch(modeInput, ["direct", "rule", "proxy"]);
  if (!matched) return { text: "❌ 模式仅支持: direct/rule/proxy" };
  await api.setOutboundMode(config, matched);
  return { text: `✅ 模式已切换: ${matched}` };
}

async function handleSelect(
  config: SurgeConfig,
  groupInput: string,
  nodeInput: string,
): Promise<Reply> {
  if (!groupInput) return { text: "❌ 用法: /surge select <组> <节点>" };
  const groups = await api.getPolicyGroups(config);
  const matchedGroup = fuzzyMatch(groupInput, Object.keys(groups));
  if (!matchedGroup) return { text: `❌ 未找到策略组: ${groupInput}` };

  if (!nodeInput) return handleGroupSelector(config, matchedGroup);

  const members = groups[matchedGroup]!.map((m) => m.name);
  const matchedNode = fuzzyMatch(nodeInput, members);
  if (!matchedNode)
    return { text: `❌ ${matchedGroup} 中未找到: ${nodeInput}` };

  await api.setGroupSelection(config, matchedGroup, matchedNode);
  return { text: `✅ ${matchedGroup} → ${matchedNode}` };
}

async function handleGroupSelector(
  config: SurgeConfig,
  groupInput: string,
): Promise<Reply> {
  const groups = await api.getPolicyGroups(config);
  const matchedGroup = fuzzyMatch(groupInput, Object.keys(groups));
  if (!matchedGroup) return { text: `❌ 未找到策略组: ${groupInput}` };

  const members = groups[matchedGroup]!.map((m) => m.name);
  const current = await api.getGroupSelection(config, matchedGroup);
  return {
    text: formatGroupSelectorHeader(matchedGroup, current),
    buttons: buildNodeSelector(matchedGroup, members, current),
    parseMode: "HTML",
  };
}

async function handleGroups(
  config: SurgeConfig,
  showAll: boolean,
): Promise<Reply> {
  const groups = await api.getPolicyGroups(config);
  const visibility = await api.getGroupVisibility(config);
  const visibleSet = new Set(visibility.visible);
  const names = Object.keys(groups).filter((g) => showAll || visibleSet.has(g));
  const selections = await api.getSelectionsForGroups(config, names);
  return {
    text: names.map((n) => `${n} → ${selections.get(n) ?? "-"}`).join("\n"),
  };
}

async function handleNodes(
  config: SurgeConfig,
  groupInput: string,
): Promise<Reply> {
  if (!groupInput) return { text: "❌ 用法: /surge nodes <组>" };
  const groups = await api.getPolicyGroups(config);
  const matched = fuzzyMatch(groupInput, Object.keys(groups));
  if (!matched) return { text: `❌ 未找到策略组: ${groupInput}` };
  return { text: groups[matched]!.map((m) => m.name).join("\n") };
}

async function handleTest(
  config: SurgeConfig,
  groupInput: string,
): Promise<Reply> {
  if (!groupInput) return { text: "❌ 用法: /surge test <组>" };
  const groups = await api.getPolicyGroups(config);
  const matched = fuzzyMatch(groupInput, Object.keys(groups));
  if (!matched) return { text: `❌ 未找到策略组: ${groupInput}` };
  const available = await api.testGroup(config, matched);
  return {
    text: available.length ? `可用:\n${available.join("\n")}` : "⚠️ 无可用节点",
  };
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
