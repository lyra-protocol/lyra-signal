import type { AlertEnvelope } from "../schema/events.js";

export interface WalletContext {
  /** Summarized from RPC / indexer — keep small for latency. */
  recentTradeCount?: number;
  label?: string;
}

/**
 * Single LLM call per alert — hot path should reach this only after filter passes.
 * Uses env: AZURE_OPENAI_* (same as lyra-ui).
 */
export async function generateSentence(
  alert: AlertEnvelope,
  wallet: WalletContext | null,
): Promise<string> {
  const baseUrl = process.env.AZURE_OPENAI_BASE_URL?.replace(/\/$/, "");
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const model =
    process.env.AZURE_OPENAI_MODEL ??
    process.env.AZURE_OPENAI_DEPLOYMENT ??
    "";

  if (!baseUrl || !apiKey || !model) {
    return fallbackSentence(alert, wallet);
  }

  const body = {
    model,
    messages: [
      {
        role: "system" as const,
        content:
          "You write one concise, neutral sentence for traders about an on-chain signal. No financial advice. No exclamation hype. Max 220 characters.",
      },
      {
        role: "user" as const,
        content: JSON.stringify({
          alert,
          walletContext: wallet ?? {},
        }),
      },
    ],
    max_tokens: 120,
    temperature: 0.35,
  };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI compatible error ${res.status}: ${err.slice(0, 500)}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = json.choices?.[0]?.message?.content?.trim();
  return text && text.length > 0 ? text : fallbackSentence(alert, wallet);
}

function fallbackSentence(alert: AlertEnvelope, wallet: WalletContext | null): string {
  const w = wallet?.label ? ` (${wallet.label})` : "";
  return `${alert.event.action.toUpperCase()} ~$${Math.round(alert.event.sizeUsd)} on ${alert.event.token.slice(0, 8)}…${w}`;
}
