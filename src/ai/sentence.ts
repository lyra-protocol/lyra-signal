import type { AlertEnvelope, Severity } from "../schema/events.js";

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

  const system = [
    "You are Lyra, a sharp trader friend on a desk.",
    "Your job: write ONE short sentence a trader would send to a group chat about the on-chain event below.",
    "Tone: concise, confident, no hype, no emoji, no financial advice.",
    "Max 140 characters. Plain sentence. No lists. No markdown. No preamble.",
    "Never say 'A wallet' — name the actor: 'Dev', 'Early buyer #3', 'Whale', or 'Trader' depending on context.",
    "Skip USD amounts under $500 (they're noise). Always mention the token name/symbol when known.",
    'Frame "why it matters" in the sentence — creation, whale footprint, cluster rotation, or volume surge.',
    'If action is "create", describe it as a launch with any relevant pump metadata (name, MCap if present).',
    "Do NOT restate the rule name, score, or severity. Write as if the reader already knows the rail.",
  ].join(" ");

  const body = {
    model,
    messages: [
      { role: "system" as const, content: system },
      {
        role: "user" as const,
        content: JSON.stringify({
          rule: alert.primaryRule,
          severity: alert.severity,
          score: alert.score ?? null,
          event: {
            action: alert.event.action,
            sizeUsd: Math.round(alert.event.sizeUsd),
            token: alert.event.token,
            wallet: alert.event.wallet,
            symbol: alert.event.metadata?.pump?.symbol ?? null,
            name: alert.event.metadata?.pump?.name ?? null,
            marketCapSol: alert.event.metadata?.pump?.marketCapSol ?? null,
            bondingCurveSol:
              alert.event.metadata?.pump?.vSolInBondingCurve ?? null,
            initialBuyTokens:
              alert.event.metadata?.pump?.initialBuyTokens ?? null,
            pool: alert.event.metadata?.pump?.pool ?? null,
          },
          walletContext: wallet ?? {},
        }),
      },
    ],
    max_tokens: 80,
    temperature: 0.4,
  };

  try {
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
      console.error(
        `[sentence] OpenAI ${res.status}: ${err.slice(0, 200)} — using fallback`,
      );
      return fallbackSentence(alert, wallet);
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = json.choices?.[0]?.message?.content?.trim();
    const cleaned = sanitizeSentence(raw);
    return cleaned || fallbackSentence(alert, wallet);
  } catch (error) {
    console.error("[sentence] request failed", error);
    return fallbackSentence(alert, wallet);
  }
}

function sanitizeSentence(value?: string | null): string {
  if (!value) return "";
  // Strip any accidental markdown / prefixes the model likes to add.
  let v = value
    .replace(/^["'“”]|["'“”]$/g, "")
    .replace(/^(One sentence|A single sentence|Here is|Note:)\s*[:\-]\s*/i, "")
    .trim();
  // Hard cap at 160 chars so a chatty model can't spam the UI.
  if (v.length > 160) v = v.slice(0, 157).trimEnd() + "…";
  return v;
}

function severityHint(severity: Severity): string {
  switch (severity) {
    case "critical":
      return "Whale print";
    case "alert":
      return "Size move";
    case "notable":
      return "Early footprint";
    default:
      return "Heads-up";
  }
}

function fallbackSentence(
  alert: AlertEnvelope,
  wallet: WalletContext | null,
): string {
  const { event } = alert;
  const symbol =
    event.metadata?.pump?.symbol?.toUpperCase() ?? event.token.slice(0, 6);
  const actor = wallet?.label ?? (event.action === "create" ? "Dev" : "Trader");
  const verb =
    event.action === "create"
      ? "launched"
      : event.action === "buy"
        ? "bought"
        : event.action === "sell"
          ? "sold"
          : event.action === "migrate"
            ? "migrated"
            : "moved";
  const usd = event.sizeUsd >= 500 ? ` ~$${Math.round(event.sizeUsd)}` : "";
  return `${severityHint(alert.severity)} · ${actor} ${verb}${usd} ${symbol}.`;
}
