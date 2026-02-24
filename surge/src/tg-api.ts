// tg-api.ts — Direct Telegram Bot API calls for in-place panel editing

type InlineButton = { text: string; callback_data: string };
type InlineRow = InlineButton[];

async function tgRequest(
  token: string,
  method: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await resp.json()) as Record<string, unknown>;
  if (!data.ok) {
    const desc = (data.description as string) ?? "unknown error";
    throw new Error(`Telegram API ${method}: ${desc}`);
  }
  return data;
}

export async function sendPanel(
  token: string,
  chatId: string,
  text: string,
  buttons: InlineRow[],
  threadId?: number
): Promise<number> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    reply_markup: { inline_keyboard: buttons },
  };
  if (threadId) body.message_thread_id = threadId;
  const data = await tgRequest(token, "sendMessage", body);
  const result = data.result as Record<string, unknown>;
  return result.message_id as number;
}

export async function editPanel(
  token: string,
  chatId: string,
  messageId: number,
  text: string,
  buttons: InlineRow[]
): Promise<void> {
  try {
    await tgRequest(token, "editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      reply_markup: { inline_keyboard: buttons },
    });
  } catch (err) {
    // "message is not modified" is benign
    if (String(err).includes("message is not modified")) return;
    throw err;
  }
}
