// formatter.ts — Format output text and build Telegram inline buttons

type Button = { text: string; callback_data: string };
type ButtonRow = Button[];

const CB = "/surge cb:";

export function panelTitle(mode: string): string {
  return `⚡ Surge 面板                   当前模式: ${modeLabel(mode)}`;
}

export function formatGroupSelectorHeader(
  groupName: string,
  currentSelection: string | null,
): string {
  return `${groupName} | 当前: ${currentSelection ?? "无"}`;
}

export function formatModeHeader(currentMode: string): string {
  return `⚙️ 选择模式（当前: ${modeLabel(currentMode)}）`;
}

export function buildMainPanel(
  mode: string,
  selections: Map<string, string>,
  groupsToShow: string[],
  showAll: boolean,
): ButtonRow[] {
  const rows: ButtonRow[] = [];

  // Group buttons first, 2 per row
  let row: ButtonRow = [];
  for (const group of groupsToShow) {
    const selected = selections.get(group);
    if (selected === undefined) continue;
    row.push({
      text: `${group}: ${shortNode(selected)}`,
      callback_data: `${CB}g:${group}`,
    });
    if (row.length === 2) {
      rows.push(row);
      row = [];
    }
  }
  if (row.length > 0) rows.push(row);

  // Operation buttons at bottom
  const toggleLabel = showAll ? "📋 常用分组" : "📋 全部分组";
  const toggleAction = showAll ? `${CB}defaultgroups` : `${CB}allgroups`;
  rows.push([
    { text: toggleLabel, callback_data: toggleAction },
    { text: "⚙️ 模式", callback_data: `${CB}mode` },
  ]);

  return rows;
}

export function buildNodeSelector(
  groupName: string,
  members: string[],
  currentSelection: string | null,
): ButtonRow[] {
  const rows: ButtonRow[] = [];
  let row: ButtonRow = [];

  for (let i = 0; i < members.length; i += 1) {
    const member = members[i]!;
    const isSelected = member === currentSelection;
    row.push({
      text: isSelected ? `${truncate(member, 14)} ✅` : truncate(member, 16),
      callback_data: `${CB}s:${groupName}:${i}`,
    });
    if (row.length === 2) {
      rows.push(row);
      row = [];
    }
  }
  if (row.length > 0) rows.push(row);

  rows.push([{ text: "⬅️ 返回面板", callback_data: `${CB}back` }]);
  return rows;
}

export function buildModeSelector(currentMode: string): ButtonRow[] {
  return [
    [
      {
        text: `Direct${currentMode === "direct" ? " ✅" : ""}`,
        callback_data: `${CB}sm:direct`,
      },
      {
        text: `Rule${currentMode === "rule" ? " ✅" : ""}`,
        callback_data: `${CB}sm:rule`,
      },
      {
        text: `Proxy${currentMode === "proxy" ? " ✅" : ""}`,
        callback_data: `${CB}sm:proxy`,
      },
    ],
    [{ text: "⬅️ 返回面板", callback_data: `${CB}back` }],
  ];
}


function modeLabel(mode: string): string {
  switch (mode.toLowerCase()) {
    case "direct":
      return "Direct";
    case "rule":
      return "Rule";
    case "proxy":
      return "Proxy";
    default:
      return mode;
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function shortNode(node: string): string {
  // Keep concise while preserving meaning
  if (node.length <= 8) return node;
  // Preserve flag + first 2 chars of region/name
  const m = node.match(
    /^(\p{Emoji_Presentation}|\p{Extended_Pictographic})+\s*(.+)$/u,
  );
  if (m) {
    const emoji = m[1] ?? "";
    const name = (m[2] ?? "").trim();
    return `${emoji} ${truncate(name, 5)}`;
  }
  return truncate(node, 8);
}
