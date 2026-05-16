import { Telegraf } from "telegraf";
import type { SignalBus } from "../bus/signal-bus.js";
import type { AlertEnvelope } from "../schema/events.js";
import type { BirdeyeSignalEngine } from "../birdeye/worker.js";
import { createTelegramPreferenceStore } from "../storage/telegram-preference-store.js";
import { applyPreferenceAction, preferencesKeyboard } from "./keyboard.js";
import { recordSent, shouldSend } from "./preferences.js";
import { statusText, welcomeText } from "./messages.js";

export interface TelegramBotHandle {
  stop(): void;
}

export function startTelegramBot(options: {
  bus: SignalBus;
  signal: AbortSignal;
  birdeyeEngine: BirdeyeSignalEngine | null;
}): TelegramBotHandle | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    console.error("[telegram] disabled: TELEGRAM_BOT_TOKEN is not set");
    return null;
  }

  const store = createTelegramPreferenceStore();
  const bot = new Telegraf(token);

  bot.start(async (ctx) => {
    const chatId = ctx.chat.id;
    const prefs = await store.subscribe(chatId);
    await ctx.reply(welcomeText());
    await ctx.reply(statusText(prefs));
  });

  bot.command("pause", async (ctx) => {
    const prefs = { ...(await store.subscribe(ctx.chat.id)), paused: true };
    await store.save(prefs);
    await ctx.reply("Lyra signals paused. Use /resume to turn them back on.");
  });

  bot.command("resume", async (ctx) => {
    const prefs = { ...(await store.subscribe(ctx.chat.id)), paused: false };
    await store.save(prefs);
    await ctx.reply("Lyra signals resumed.");
  });

  bot.command("status", async (ctx) => {
    await ctx.reply(statusText(await store.subscribe(ctx.chat.id)));
  });

  bot.command("preferences", async (ctx) => {
    const prefs = await store.subscribe(ctx.chat.id);
    await ctx.reply("Tune Lyra Signal filters:", preferencesKeyboard(prefs));
  });

  bot.command("signal", async (ctx) => {
    if (!ctx.message.text.toLowerCase().includes("now")) {
      await ctx.reply("Use /signal now to trigger a fresh Birdeye scan.");
      return;
    }
    if (!options.birdeyeEngine) {
      await ctx.reply("Birdeye scanning is not configured yet.");
      return;
    }
    await ctx.reply("Scanning Birdeye now…");
    const prefs = await store.subscribe(ctx.chat.id);
    const alerts = await options.birdeyeEngine.scanNow({ publish: false });
    const top = alerts.find((alert) => shouldSend(alert, prefs)) ?? alerts[0];
    await ctx.reply(top ? top.sentence : "No matching signal found on this scan.", {
      link_preview_options: { is_disabled: true },
    });
  });

  bot.on("callback_query", async (ctx) => {
    const data = "data" in ctx.callbackQuery ? ctx.callbackQuery.data : undefined;
    if (!data || data === "noop") {
      await ctx.answerCbQuery();
      return;
    }
    const current = await store.subscribe(ctx.chat!.id);
    const next = applyPreferenceAction(current, data);
    await store.save(next);
    await ctx.answerCbQuery("Updated");
    await ctx.editMessageReplyMarkup(preferencesKeyboard(next).reply_markup);
  });

  bot.catch((error) => console.error("[telegram] bot error", error));
  void bot.launch().then(() => console.error("[telegram] bot polling started"));

  const unsubscribe = options.bus.subscribe((alert) => {
    void broadcastAlert(bot, store, alert);
  });

  const stop = () => {
    unsubscribe();
    bot.stop("shutdown");
  };
  options.signal.addEventListener("abort", stop, { once: true });
  return { stop };
}

async function broadcastAlert(
  bot: Telegraf,
  store: ReturnType<typeof createTelegramPreferenceStore>,
  alert: AlertEnvelope,
) {
  const subscribers = await store.listSubscribers();
  for (const prefs of subscribers) {
    if (!shouldSend(alert, prefs)) continue;
    try {
      await bot.telegram.sendMessage(prefs.chatId, alert.sentence, {
        link_preview_options: { is_disabled: true },
      });
      await store.save(recordSent(prefs));
    } catch (error) {
      console.error(`[telegram] failed to send to chat ${prefs.chatId}`, error);
    }
  }
}
