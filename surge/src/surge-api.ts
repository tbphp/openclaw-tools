// surge-api.ts — Surge HTTP API client

export type SurgeConfig = {
  apiUrl: string;
  apiKey: string;
};

export type PolicyMember = {
  isGroup: boolean;
  name: string;
  typeDescription: string;
  lineHash: string;
  enabled: boolean;
};

export type PolicyGroups = Record<string, PolicyMember[]>;

async function surgeRequest(
  config: SurgeConfig,
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> {
  const url = `${config.apiUrl}${path}`;
  const headers: Record<string, string> = {
    "X-Key": config.apiKey,
  };

  const opts: RequestInit = {
    method,
    headers,
    ...(url.startsWith("https://") ? { dispatcher: getInsecureDispatcher() } as Record<string, unknown> : {}),
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  opts.signal = controller.signal;

  try {
    const resp = await fetch(url, opts);
    const text = await resp.text();
    if (!resp.ok) {
      throw new Error(`Surge API ${resp.status}: ${text}`);
    }
    return text ? JSON.parse(text) : {};
  } finally {
    clearTimeout(timeout);
  }
}

// Undici dispatcher for self-signed TLS
let _dispatcher: unknown;
function getInsecureDispatcher(): unknown {
  if (_dispatcher) return _dispatcher;
  try {
    // Node.js 18+ with undici
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Agent } = require("undici");
    _dispatcher = new Agent({
      connect: { rejectUnauthorized: false },
    });
  } catch {
    // Node 20+ always has undici; warn instead of disabling TLS globally
    console.warn(
      "[openclaw-surge] undici unavailable — Surge HTTPS may fail with self-signed certs"
    );
  }
  return _dispatcher;
}

// ─── Public API ───

export async function getOutboundMode(config: SurgeConfig): Promise<string> {
  const data = (await surgeRequest(config, "GET", "/v1/outbound")) as {
    mode: string;
  };
  return data.mode;
}

export async function setOutboundMode(
  config: SurgeConfig,
  mode: string
): Promise<void> {
  await surgeRequest(config, "POST", "/v1/outbound", { mode });
}

export async function getPolicyGroups(
  config: SurgeConfig
): Promise<PolicyGroups> {
  return (await surgeRequest(
    config,
    "GET",
    "/v1/policy_groups"
  )) as PolicyGroups;
}

export async function getGroupSelection(
  config: SurgeConfig,
  groupName: string
): Promise<string | null> {
  const data = (await surgeRequest(
    config,
    "GET",
    `/v1/policy_groups/select?group_name=${encodeURIComponent(groupName)}`
  )) as { policy: string | null };
  return data.policy;
}

export async function setGroupSelection(
  config: SurgeConfig,
  groupName: string,
  policy: string
): Promise<void> {
  await surgeRequest(config, "POST", "/v1/policy_groups/select", {
    group_name: groupName,
    policy,
  });
}

export async function testGroup(
  config: SurgeConfig,
  groupName: string
): Promise<string[]> {
  const data = (await surgeRequest(
    config,
    "POST",
    "/v1/policy_groups/test",
    { group_name: groupName }
  )) as { available?: string[] };
  return data.available ?? [];
}

/**
 * Get ordered policy group names from /v1/policies.
 */
export async function getPolicyGroupOrder(config: SurgeConfig): Promise<string[]> {
  const data = (await surgeRequest(config, "GET", "/v1/policies")) as {
    "policy-groups"?: string[];
  };
  return data["policy-groups"] ?? [];
}

export async function reloadProfile(config: SurgeConfig): Promise<void> {
  await surgeRequest(config, "POST", "/v1/profiles/reload");
}

export async function flushDns(config: SurgeConfig): Promise<void> {
  await surgeRequest(config, "POST", "/v1/dns/flush");
}

export async function getCurrentProfileText(config: SurgeConfig): Promise<string> {
  const data = (await surgeRequest(config, "GET", "/v1/profiles/current")) as {
    profile?: string;
  };
  return data.profile ?? "";
}

/**
 * Parse [Proxy Group] section and infer hidden/non-hidden groups dynamically.
 */
export async function getGroupVisibility(config: SurgeConfig): Promise<{
  visible: string[];
  hidden: string[];
}> {
  const profile = await getCurrentProfileText(config);
  const sectionMatch = profile.match(/\[Proxy Group\]([\s\S]*?)(\n\[|$)/);
  if (!sectionMatch) return { visible: [], hidden: [] };

  const lines = sectionMatch[1]
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="));

  const visible: string[] = [];
  const hidden: string[] = [];

  for (const line of lines) {
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const name = line.slice(0, eq).trim();
    const rhs = line.slice(eq + 1);
    const isHidden = /(?:^|,)\s*hidden\s*=\s*1(?:\s*,|\s*$)/i.test(rhs);
    if (isHidden) hidden.push(name);
    else visible.push(name);
  }

  return { visible, hidden };
}

export async function getSelectionsForGroups(
  config: SurgeConfig,
  groupNames: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const promises = groupNames.map(async (name) => {
    const selected = await getGroupSelection(config, name);
    if (selected) result.set(name, selected);
  });
  await Promise.all(promises);
  return result;
}

/** Backward-compatible helper */
export async function getAllGroupSelections(
  config: SurgeConfig
): Promise<Map<string, string>> {
  const groups = await getPolicyGroups(config);
  return getSelectionsForGroups(config, Object.keys(groups));
}
