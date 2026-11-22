// LUCKY 777 · Telegram webhook (Supabase Edge Function)
// Секреты функции: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, WEBAPP_URL.
// SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY Supabase подставляет сам.

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
const WEBAPP_URL = Deno.env.get("WEBAPP_URL") || "https://sadman12304-max.github.io/lucky777/";

const LEVEL_NAMES = [
  "Новичок", "Игрок", "Счастливчик", "Крупье", "Хайроллер",
  "Легенда", "Магнат", "Король", "Император", "Легенда 777",
];

const quota = (level: number) => 1000 * Math.max(1, Math.trunc(level) || 1);
const levelName = (level: number) => LEVEL_NAMES[Math.min(Math.max(1, level), LEVEL_NAMES.length) - 1];
const money = (n: number) => Math.max(0, Math.trunc(Number(n) || 0)).toLocaleString("ru-RU");
const esc = (s: string) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

async function sb(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  if (res.status === 204) return null;
  return res.json().catch(() => null);
}

async function tg(method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error("Telegram", res.status, await res.text());
}

async function send(chatId: number, text: string, extra: Record<string, unknown> = {}) {
  await tg("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...extra,
  });
}

async function getPlayer(id: number) {
  const rows = await sb(`players?telegram_id=eq.${id}&select=*`);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function ensurePlayer(user: any) {
  let player = await getPlayer(user.id);
  if (!player) {
    await sb("players", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        telegram_id: user.id,
        username: user.username || null,
        first_name: user.first_name || null,
      }),
    });
    player = await getPlayer(user.id);
  } else {
    await sb(`players?telegram_id=eq.${user.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ username: user.username || null, first_name: user.first_name || null }),
    }).catch(() => {});
  }
  return player;
}

async function joinChat(chatId: number, userId: number) {
  await sb("chat_players?on_conflict=chat_id,telegram_id", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({ chat_id: chatId, telegram_id: userId }),
  });
}

function playerCard(player: any) {
  const level = Math.max(1, Number(player.level) || 1);
  const xp = Math.max(0, Number(player.xp) || 0);
  const q = quota(level);
  return [
    `<b>LUCKY 777</b>`,
    `Уровень: <b>${level} · ${levelName(level)}</b>`,
    `Баланс: <b>${money(player.balance)}</b> очков`,
    `До следующего: ${money(xp)} / ${money(q)} XP`,
  ].join("\n");
}

async function topInChat(chatId: number) {
  const members = await sb(`chat_players?chat_id=eq.${chatId}&select=telegram_id`);
  const ids = (members || []).map((m: any) => m.telegram_id).filter(Boolean);
  if (!ids.length) {
    return "В этом чате пока никто не зарегистрирован. Напиши /me — и попадёшь в топ.";
  }
  const players = await sb(
    `players?telegram_id=in.(${ids.join(",")})&select=telegram_id,first_name,username,level,balance&order=level.desc,balance.desc&limit=10`
  );
  const lines = (players || []).map((p: any, i: number) => {
    const name = esc(p.first_name || p.username || `Игрок ${p.telegram_id}`);
    return `${i + 1}. ${name} — LVL ${p.level} · ${money(p.balance)}`;
  });
  return `<b>Топ чата</b>\n${lines.join("\n")}`;
}

async function topGlobal() {
  const players = await sb(
    "players?select=first_name,username,level,balance&order=level.desc,balance.desc&limit=10"
  );
  const lines = (players || []).map((p: any, i: number) => {
    const name = esc(p.first_name || p.username || "Игрок");
    return `${i + 1}. ${name} — LVL ${p.level} · ${money(p.balance)}`;
  });
  return `<b>Топ LUCKY 777</b>\n${lines.join("\n")}`;
}

async function onCommand(update: any) {
  const msg = update.message;
  if (!msg?.text) return;
  const chat = msg.chat;
  const user = msg.from;
  const chatId = chat.id;
  const isGroup = chat.type === "group" || chat.type === "supergroup";
  const command = msg.text.trim().split(/\s+/)[0].replace(/@.*$/, "").toLowerCase();

  if (command === "/start") {
    await send(chatId, "Добро пожаловать в <b>LUCKY 777</b>!\n\nСлоты, рулетка, блэкджек, краш, кости и кено — на виртуальные очки.", {
      reply_markup: {
        inline_keyboard: [[{ text: "🎰 Открыть мини-аппу", web_app: { url: WEBAPP_URL } }]],
      },
    });
    return;
  }

  if (command === "/help") {
    await send(chatId, [
      "<b>Команды</b>",
      "/me — уровень и баланс",
      "/top — топ чата",
      "",
      "Открой мини-аппу, играй и возвращайся — прогресс подтянется.",
    ].join("\n"));
    return;
  }

  if (command === "/me") {
    const player = await getPlayer(user.id);
    if (!player) {
      await send(chatId, "Сначала открой мини-аппу LUCKY 777 — прогресс создастся автоматически. Потом возвращайся и пиши /me.");
      return;
    }
    if (isGroup) await joinChat(chatId, user.id);
    await send(chatId, `${playerCard(player)}\n\n${isGroup ? "Ты в топе этого чата." : ""}`.trim());
    return;
  }

  if (command === "/top") {
    await send(chatId, isGroup ? await topInChat(chatId) : await topGlobal());
  }
}

async function onBotAdded(update: any) {
  const member = update.my_chat_member;
  if (!member) return;
  const status = member.new_chat_member?.status;
  if (!["member", "administrator"].includes(status)) return;
  const chat = member.chat;
  await sb("chat_settings?on_conflict=chat_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ chat_id: chat.id, title: chat.title || null }),
  }).catch(() => {});
  await send(chat.id, [
    "<b>LUCKY 777 на связи</b>",
    "Я показываю уровни и баланс игроков этого чата.",
    "",
    "/me — твой уровень и баланс",
    "/top — топ чата",
    "/help — справка",
    "",
    "Каждому нужно один раз написать /me, чтобы попасть в топ.",
  ].join("\n"), {
    reply_markup: {
      inline_keyboard: [[{ text: "🎰 Играть", web_app: { url: WEBAPP_URL } }]],
    },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  if (WEBHOOK_SECRET) {
    const got = req.headers.get("x-telegram-bot-api-secret-token");
    if (got !== WEBHOOK_SECRET) return new Response("forbidden", { status: 403 });
  }
  try {
    const update = await req.json();
    if (update.message) await onCommand(update);
    if (update.my_chat_member) await onBotAdded(update);
  } catch (e) {
    console.error("telegram handler", e);
  }
  return new Response("ok");
});
