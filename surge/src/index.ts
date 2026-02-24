// index.ts — OpenClaw plugin entry point

import type { SurgeConfig } from "./surge-api.js";
import { handleSurgeCommand } from "./commands.js";
import { sendPanel, editPanel } from "./tg-api.js";

const PLUGIN_ID = "openclaw-surge";

type PluginConfig = {
  apiUrl?: string;
  apiKey?: string;
  coreGroups?: string[];
};

type PluginCommandContext = {
  args?: string;
  channel?: string;
  to?: string;
  config?: Record<string, unknown>;
  messageThreadId?: number;
};

type InlineButton = { text: string; callback_data: string };
type InlineRow = InlineButton[];

const CB_PREFIX = "cb:";
const MSG_ID_RE = /^cb:M(\d+):(.+)$/;

function embedMessageId(buttons: InlineRow[], messageId: number): InlineRow[] {
  return buttons.map((row) =>
    row.map((btn) => ({
      ...btn,
      callback_data: btn.callback_data.replace(
        "/surge cb:",
        `/surge cb:M${messageId}:`,
      ),
    })),
  );
}

function parseCallbackArgs(args: string): {
  messageId: number | null;
  cleanArgs: string;
} {
  const m = args.match(MSG_ID_RE);
  if (m) {
    return { messageId: Number.parseInt(m[1]!, 10), cleanArgs: `cb:${m[2]}` };
  }
  return { messageId: null, cleanArgs: args };
}

function getSurgeConfig(pluginConfig?: Record<string, unknown>): SurgeConfig {
  const cfg = (pluginConfig ?? {}) as PluginConfig;
  return {
    apiUrl: cfg.apiUrl || "https://127.0.0.1:6171",
    apiKey: cfg.apiKey || "123456",
  };
}

function extractBotToken(config?: Record<string, unknown>): string | null {
  try {
    const channels = config?.channels as Record<string, unknown> | undefined;
    const tg = channels?.telegram as Record<string, unknown> | undefined;
    return (tg?.botToken as string) ?? null;
  } catch {
    return null;
  }
}

function extractChatId(to?: string): string | null {
  if (!to) return null;
  const m = to.match(/^telegram:(-?\d+)$/);
  return m ? m[1]! : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function register(api: any) {
  const surgeConfig = getSurgeConfig(api.pluginConfig);

  api.logger.info(
    `[${PLUGIN_ID}] Registering Surge manager (API: ${surgeConfig.apiUrl})`,
  );

  api.registerCommand({
    name: "surge",
    description: "Surge proxy manager",
    acceptsArgs: true,
    requireAuth: true,
    handler: async (ctx: PluginCommandContext) => {
      const rawArgs = ctx.args?.trim() ?? "";
      const isNewPanel = !rawArgs;

      const botToken = extractBotToken(ctx.config);
      const chatId = extractChatId(ctx.to);

      // For callbacks, strip embedded messageId before dispatching
      const { messageId: panelMsgId, cleanArgs } = isNewPanel
        ? { messageId: null, cleanArgs: rawArgs }
        : parseCallbackArgs(rawArgs);

      const isCallback = cleanArgs.startsWith(CB_PREFIX);
      const result = await handleSurgeCommand(cleanArgs, surgeConfig);

      // Panel interactions on Telegram via direct API
      if (botToken && chatId && result.buttons && result.buttons.length > 0) {
        try {
          if (isNewPanel) {
            // Send new panel, then edit to embed messageId in buttons
            const msgId = await sendPanel(
              botToken,
              chatId,
              result.text,
              result.buttons,
              ctx.messageThreadId,
            );
            const updatedButtons = embedMessageId(result.buttons, msgId);
            await editPanel(
              botToken,
              chatId,
              msgId,
              result.text,
              updatedButtons,
            );
            // audioAsVoice without media/text triggers silent skip in deliverReplies
            return { audioAsVoice: true };
          }

          if (isCallback && panelMsgId) {
            // Edit the specific panel identified by embedded messageId
            const updatedButtons = embedMessageId(result.buttons, panelMsgId);
            try {
              await editPanel(
                botToken,
                chatId,
                panelMsgId,
                result.text,
                updatedButtons,
              );
            } catch {
              // Edit failed (message deleted?), send new panel
              const msgId = await sendPanel(
                botToken,
                chatId,
                result.text,
                result.buttons,
                ctx.messageThreadId,
              );
              const freshButtons = embedMessageId(result.buttons, msgId);
              await editPanel(
                botToken,
                chatId,
                msgId,
                result.text,
                freshButtons,
              );
            }
            return { text: "NO_REPLY" };
          }
        } catch (err) {
          api.logger.warn(
            `[${PLUGIN_ID}] Direct TG API failed, falling back: ${err}`,
          );
        }
      }

      return buildReply(result, ctx.channel);
    },
  });

  api.logger.info(
    `[${PLUGIN_ID}] Registered /surge command (hidden, auth required)`,
  );
}

function buildReply(
  result: { text: string; buttons?: { text: string; callback_data: string }[][]; parseMode?: string },
  channel?: string
) {
  const reply: Record<string, unknown> = { text: result.text };

  if (result.buttons && result.buttons.length > 0) {
    if (!channel || channel === "telegram") {
      reply.channelData = {
        telegram: {
          buttons: result.buttons,
          parse_mode: result.parseMode ?? "HTML",
        },
      };
    }
  }

  return reply;
}
