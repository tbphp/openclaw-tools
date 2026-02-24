// matcher.ts — Fuzzy matching for group names and policy names

/** Common aliases for quick input */
const ALIASES: Record<string, string[]> = {
  hk: ["香港"],
  hongkong: ["香港"],
  tw: ["台湾"],
  taiwan: ["台湾"],
  jp: ["日本"],
  japan: ["日本"],
  us: ["美国"],
  usa: ["美国"],
  sg: ["新加坡"],
  singapore: ["新加坡"],
  tg: ["telegram"],
  yt: ["youtube"],
  gh: ["github"],
  nf: ["netflix"],
  all: ["all"],
};

/** Emoji map for core groups (display only) */
export const GROUP_EMOJI: Record<string, string> = {
  Proxy: "🌐",
  AI: "🤖",
  Telegram: "✈️",
  Google: "🔍",
  GitHub: "🐙",
  YouTube: "📺",
  Work: "💼",
  Netflix: "🎬",
  Final: "🏁",
  LinuxDo: "🐧",
  Whitelist: "📋",
  All: "🌍",
  Direct: "🔗",
  Disney: "🏰",
  Microsoft: "Ⓜ️",
  Apple: "🍎",
  Game: "🎮",
};

/**
 * Fuzzy match user input against a list of real names.
 * Returns the best match or null.
 */
export function fuzzyMatch(
  input: string,
  candidates: string[]
): string | null {
  const lower = input.toLowerCase().trim();
  if (!lower) return null;

  // 1. Exact match (case-insensitive)
  for (const c of candidates) {
    if (c.toLowerCase() === lower) return c;
  }

  // 2. Alias lookup
  const aliasTargets = ALIASES[lower];
  if (aliasTargets) {
    for (const alias of aliasTargets) {
      for (const c of candidates) {
        if (c.toLowerCase().includes(alias.toLowerCase())) return c;
      }
    }
  }

  // 3. Substring match (input is substring of candidate, ignoring emoji)
  for (const c of candidates) {
    const stripped = stripEmoji(c).toLowerCase();
    if (stripped.includes(lower)) return c;
  }

  // 4. Candidate name contains user input (broader)
  for (const c of candidates) {
    if (c.toLowerCase().includes(lower)) return c;
  }

  return null;
}

/** Strip leading emoji characters from a string */
function stripEmoji(s: string): string {
  // Remove common flag/emoji sequences at the start
  return s.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s\uFE0F]+/u, "").trim();
}

/** Get emoji for a group name */
export function getGroupEmoji(groupName: string): string {
  return GROUP_EMOJI[groupName] ?? "📌";
}
