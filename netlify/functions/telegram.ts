import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

type TelegramMessage = {
  message_id: number;
  text?: string;
  photo?: Array<{ file_id: string; file_size?: number; width?: number; height?: number }>;
  document?: { file_id: string; file_name?: string; mime_type?: string };
  chat: { id: number };
  from?: { id: number; username?: string; first_name?: string };
};

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

type State = {
  flow?: "new" | "close" | "edit";
  step?: string;
  draft?: Record<string, any>;
};

type Tournament = {
  name: string;
  slug: string;
  description: string;
  dateText: string;
  image: string;
  status: "open" | "closed";
  statusText: string;
  closedDate?: string;
  committees: string[];
  teams: string[];
  forms: Record<string, any>;
};

const DATA_PATH = "data/tournaments.json";
const DEFAULT_COMMITTEES = ["Genel Kurul", "Kriz Komitesi", "Basın Komitesi"];
const DEFAULT_TEAMS = ["Basın Ekibi", "Lojistik Ekibi", "Delegasyon Ekibi", "Saha Ekibi"];

function env(name: string, fallback = "") {
  return Netlify.env.get(name) || fallback;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function slugify(value: string) {
  const map: Record<string, string> = {
    ç: "c",
    ğ: "g",
    ı: "i",
    ö: "o",
    ş: "s",
    ü: "u",
    Ç: "C",
    Ğ: "G",
    İ: "I",
    Ö: "O",
    Ş: "S",
    Ü: "U",
  };
  return value
    .replace(/[çğıöşüÇĞİÖŞÜ]/g, (char) => map[char] || char)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "konferans";
}

function normalizeFormAction(value: string) {
  let url = value.trim();
  if (!url) return "";
  url = url.replace("/viewform", "/formResponse");
  if (!url.includes("/formResponse") && url.includes("/d/e/")) {
    url = `${url.replace(/\/+$/, "")}/formResponse`;
  }
  return url.split("?")[0];
}

function parseEntryMap(text: string) {
  const clean = text.trim();
  if (clean === "-") return {};

  try {
    const parsed = JSON.parse(clean);
    if (parsed.action) parsed.action = normalizeFormAction(parsed.action);
    return parsed;
  } catch {
    // Line-based format is easier to paste from Telegram.
  }

  const config: { action: string; fields: Record<string, any> } = { action: "", fields: {} };
  for (const rawLine of clean.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const [rawKey, ...rest] = line.split("=");
    const key = rawKey.trim();
    const value = rest.join("=").trim();

    if (["action", "url", "form"].includes(key)) {
      config.action = normalizeFormAction(value);
    } else if (key.startsWith("birthDate.")) {
      const part = key.split(".")[1];
      config.fields.birthDate = { ...(config.fields.birthDate || {}), [part]: value };
    } else {
      config.fields[key] = value;
    }
  }
  return config;
}

function splitValues(text: string, fallback: string[]) {
  if (text.trim() === "-") return fallback;
  const values = text
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length ? values : fallback;
}

function adminAllowed(userId?: number) {
  const admins = env("TELEGRAM_ADMIN_IDS")
    .replace(/\s/g, "")
    .split(",")
    .filter(Boolean);
  if (!admins.length) return true;
  return Boolean(userId && admins.includes(String(userId)));
}

async function telegram(method: string, payload: Record<string, any>) {
  const token = env("TELEGRAM_BOT_TOKEN");
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Telegram ${method} failed: ${response.status} ${text}`);
  }
  return response.json();
}

async function reply(chatId: number, text: string) {
  await telegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

function githubApi(path: string) {
  const repo = env("GITHUB_REPO");
  return `https://api.github.com/repos/${repo}${path}`;
}

async function githubRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(githubApi(path), {
    ...init,
    headers: {
      authorization: `Bearer ${env("GITHUB_TOKEN")}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub request failed: ${response.status} ${text}`);
  }
  return response.json();
}

async function getGithubFile(path: string) {
  const branch = env("GITHUB_BRANCH", "main");
  const response = await fetch(githubApi(`/contents/${path}?ref=${encodeURIComponent(branch)}`), {
    headers: {
      authorization: `Bearer ${env("GITHUB_TOKEN")}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
    },
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub read failed: ${response.status} ${text}`);
  }
  return response.json();
}

async function putGithubFile(path: string, content: string | ArrayBuffer | Uint8Array, message: string) {
  const existing = await getGithubFile(path);
  const bytes = typeof content === "string"
    ? new TextEncoder().encode(content)
    : content instanceof ArrayBuffer
      ? new Uint8Array(content)
      : content;
  const payload: Record<string, any> = {
    message,
    branch: env("GITHUB_BRANCH", "main"),
    content: Buffer.from(bytes).toString("base64"),
  };
  if (existing?.sha) payload.sha = existing.sha;

  await githubRequest(`/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

async function readTournamentData() {
  const file = await getGithubFile(DATA_PATH);
  if (!file?.content) return { tournaments: [] as Tournament[] };
  const decoded = Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf-8");
  return JSON.parse(decoded);
}

async function writeTournamentData(data: { tournaments: Tournament[] }, message: string) {
  await putGithubFile(DATA_PATH, `${JSON.stringify(data, null, 2)}\n`, message);
}

async function downloadTelegramFile(fileId: string) {
  const token = env("TELEGRAM_BOT_TOKEN");
  const result = await telegram("getFile", { file_id: fileId });
  const filePath = result?.result?.file_path;
  if (!filePath) throw new Error("Telegram file_path bulunamadı.");

  const response = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
  if (!response.ok) throw new Error(`Telegram dosyası indirilemedi: ${response.status}`);
  return {
    buffer: await response.arrayBuffer(),
    suffix: filePath.includes(".") ? filePath.slice(filePath.lastIndexOf(".")).toLowerCase() : ".jpg",
  };
}

async function getState(userId: number): Promise<State> {
  const store = getStore({ name: "telegram-state", consistency: "strong" });
  return ((await store.get(`user-${userId}`, { type: "json" })) as State | null) || {};
}

async function setState(userId: number, state: State) {
  const store = getStore({ name: "telegram-state", consistency: "strong" });
  await store.setJSON(`user-${userId}`, state);
}

async function clearState(userId: number) {
  const store = getStore({ name: "telegram-state", consistency: "strong" });
  await store.delete(`user-${userId}`);
}

function helpText() {
  return [
    "RETORİK turnuva botu hazır.",
    "",
    "/yeni - yeni konferans aç",
    "/liste - turnuvaları göster",
    "/kapat - başvuruyu kapat",
    "/duzenle - ad/açıklama/tarih/durum düzenle",
    "/iptal - aktif işlemi iptal et",
  ].join("\n");
}

async function listTournaments(chatId: number) {
  const data = await readTournamentData();
  if (!data.tournaments?.length) {
    await reply(chatId, "Henüz botla eklenmiş turnuva yok.");
    return;
  }

  const lines = data.tournaments.map((item: Tournament) => {
    const status = item.status === "closed" ? `kapalı (${item.closedDate || "-"})` : "açık";
    return `- ${item.slug}: ${item.name} | ${status}`;
  });
  await reply(chatId, lines.join("\n"));
}

async function handleCommand(message: TelegramMessage, text: string) {
  const chatId = message.chat.id;
  const userId = message.from?.id;
  if (!adminAllowed(userId)) {
    await reply(chatId, "Bu botu kullanma yetkin yok.");
    return;
  }

  if (text === "/start") {
    await clearState(userId!);
    await reply(chatId, helpText());
    return;
  }

  if (text === "/iptal") {
    await clearState(userId!);
    await reply(chatId, "İşlem iptal edildi.");
    return;
  }

  if (text === "/liste") {
    await listTournaments(chatId);
    return;
  }

  if (text === "/yeni") {
    await setState(userId!, { flow: "new", step: "name", draft: {} });
    await reply(chatId, "Konferans adını yaz.");
    return;
  }

  if (text === "/kapat") {
    await listTournaments(chatId);
    await setState(userId!, { flow: "close", step: "slug", draft: {} });
    await reply(chatId, "Kapatılacak turnuvanın slug değerini yaz.");
    return;
  }

  if (text === "/duzenle") {
    await listTournaments(chatId);
    await setState(userId!, { flow: "edit", step: "slug", draft: {} });
    await reply(chatId, "Düzenlenecek turnuvanın slug değerini yaz.");
    return;
  }

  await reply(chatId, "Komutu anlayamadım. /start yazıp menüyü görebilirsin.");
}

async function handleNewFlow(message: TelegramMessage, state: State) {
  const chatId = message.chat.id;
  const userId = message.from!.id;
  const text = message.text?.trim() || "";
  const draft = state.draft || {};

  if (state.step === "name") {
    draft.name = text;
    draft.slug = slugify(text);
    await setState(userId, { flow: "new", step: "description", draft });
    await reply(chatId, "Adın altında duracak kısa açıklamayı yaz.");
    return;
  }

  if (state.step === "description") {
    draft.description = text;
    await setState(userId, { flow: "new", step: "date", draft });
    await reply(chatId, "Kartta görünecek tarih/durum metnini yaz. Örnek: 14 Haziran 2026");
    return;
  }

  if (state.step === "date") {
    draft.dateText = text;
    await setState(userId, { flow: "new", step: "image", draft });
    await reply(chatId, "Konferans görselini fotoğraf veya dosya olarak gönder.");
    return;
  }

  if (state.step === "image") {
    const photoId = message.photo?.[message.photo.length - 1]?.file_id;
    const documentId = message.document?.file_id;
    if (!photoId && !documentId) {
      await reply(chatId, "Görsel alamadım. Lütfen fotoğraf ya da dosya olarak gönder.");
      return;
    }

    const file = await downloadTelegramFile(photoId || documentId!);
    const suffix = message.document?.file_name?.includes(".")
      ? message.document.file_name.slice(message.document.file_name.lastIndexOf(".")).toLowerCase()
      : file.suffix;
    draft.imagePath = `assets/conference-images/${draft.slug}${suffix}`;
    draft.imageBase64 = Buffer.from(file.buffer).toString("base64");
    await setState(userId, { flow: "new", step: "delegateForm", draft });
    await reply(
      chatId,
      [
        "Delege Google Form bilgilerini gönder.",
        "",
        "En kolay yöntem:",
        "1. form-entry-araci sitesine Google Form linkini yapıştır.",
        "2. Çıkan JSON'u buraya gönder.",
        "",
        "Eski kısa format da çalışır:",
        "action=https://docs.google.com/forms/d/e/.../viewform",
        "fullName=entry.123",
        "birthDate.year=entry.456_year",
        "birthDate.month=entry.456_month",
        "birthDate.day=entry.456_day",
        "phone=entry...",
        "email=entry...",
        "school=entry...",
        "experiences=entry...",
        "committee=entry...",
        "committee2=entry...",
        "reference=entry...",
        "notes=entry...",
        "rules=entry...",
        "",
        "Boş bırakmak için - yaz.",
      ].join("\n"),
    );
    return;
  }

  if (state.step === "delegateForm") {
    draft.forms = { ...(draft.forms || {}), delegate: parseEntryMap(text) };
    await setState(userId, { flow: "new", step: "orgForm", draft });
    await reply(chatId, "Organizasyon Google Form bilgilerini gönder. Form Entry Aracı'nın verdiği JSON'u direkt atabilirsin. Boş bırakmak için - yaz.");
    return;
  }

  if (state.step === "orgForm") {
    draft.forms = { ...(draft.forms || {}), organization: parseEntryMap(text) };
    await setState(userId, { flow: "new", step: "committees", draft });
    await reply(chatId, "Komite seçeneklerini virgülle veya satır satır yaz. Varsayılan için - yaz.");
    return;
  }

  if (state.step === "committees") {
    draft.committees = splitValues(text, DEFAULT_COMMITTEES);
    await setState(userId, { flow: "new", step: "teams", draft });
    await reply(chatId, "Organizasyon birimlerini virgülle veya satır satır yaz. Varsayılan için - yaz.");
    return;
  }

  if (state.step === "teams") {
    const tournament: Tournament = {
      name: draft.name,
      slug: draft.slug,
      description: draft.description,
      dateText: draft.dateText,
      image: draft.imagePath,
      status: "open",
      statusText: "Başvurular Açık",
      committees: draft.committees || DEFAULT_COMMITTEES,
      teams: splitValues(text, DEFAULT_TEAMS),
      forms: draft.forms || {},
    };

    const data = await readTournamentData();
    data.tournaments = (data.tournaments || []).filter((item: Tournament) => item.slug !== tournament.slug);
    data.tournaments.push(tournament);

    await putGithubFile(tournament.image, Buffer.from(draft.imageBase64, "base64"), `Konferans görseli: ${tournament.name}`);
    await writeTournamentData(data, `Yeni konferans: ${tournament.name}`);
    await clearState(userId);
    await reply(chatId, `Konferans açıldı: ${tournament.name}\nSayfa: /konferanslar/${tournament.slug}/\nNetlify birazdan otomatik deploy eder.`);
  }
}

async function handleCloseFlow(message: TelegramMessage, state: State) {
  const chatId = message.chat.id;
  const userId = message.from!.id;
  const text = message.text?.trim() || "";
  const draft = state.draft || {};

  if (state.step === "slug") {
    draft.slug = text;
    await setState(userId, { flow: "close", step: "date", draft });
    await reply(chatId, "Kapanış tarihini yaz. Örnek: 17 Haziran 2026");
    return;
  }

  const data = await readTournamentData();
  const target = (data.tournaments || []).find((item: Tournament) => item.slug === draft.slug);
  if (!target) {
    await clearState(userId);
    await reply(chatId, "Bu slug ile turnuva bulamadım.");
    return;
  }

  target.status = "closed";
  target.statusText = "Tamamlandı";
  target.closedDate = text;
  await writeTournamentData(data, `Başvuru kapandı: ${target.name}`);
  await clearState(userId);
  await reply(chatId, `${target.name} kapatıldı. Kapanış tarihi: ${text}`);
}

async function handleEditFlow(message: TelegramMessage, state: State) {
  const chatId = message.chat.id;
  const userId = message.from!.id;
  const text = message.text?.trim() || "";
  const draft = state.draft || {};

  if (state.step === "slug") {
    draft.slug = text;
    await setState(userId, { flow: "edit", step: "field", draft });
    await reply(chatId, "Düzenlenecek alanı yaz: name, description, dateText, statusText, committees, teams");
    return;
  }

  if (state.step === "field") {
    if (!["name", "description", "dateText", "statusText", "committees", "teams"].includes(text)) {
      await clearState(userId);
      await reply(chatId, "Bu alan desteklenmiyor.");
      return;
    }
    draft.field = text;
    await setState(userId, { flow: "edit", step: "value", draft });
    await reply(chatId, "Yeni değeri yaz.");
    return;
  }

  const data = await readTournamentData();
  const target = (data.tournaments || []).find((item: Tournament) => item.slug === draft.slug);
  if (!target) {
    await clearState(userId);
    await reply(chatId, "Bu slug ile turnuva bulamadım.");
    return;
  }

  target[draft.field as keyof Tournament] = ["committees", "teams"].includes(draft.field) ? splitValues(text, []) as any : text as any;
  await writeTournamentData(data, `Konferans düzenlendi: ${target.name}`);
  await clearState(userId);
  await reply(chatId, "Düzenleme kaydedildi.");
}

async function handleMessage(message: TelegramMessage) {
  const chatId = message.chat.id;
  const userId = message.from?.id;
  if (!userId || !adminAllowed(userId)) {
    await reply(chatId, "Bu botu kullanma yetkin yok.");
    return;
  }

  const text = message.text?.trim() || "";
  if (text.startsWith("/")) {
    await handleCommand(message, text.split(/\s+/)[0]);
    return;
  }

  const state = await getState(userId);
  if (!state.flow) {
    await reply(chatId, "Aktif işlem yok. /start yazıp menüyü açabilirsin.");
    return;
  }

  if (state.flow === "new") await handleNewFlow(message, state);
  if (state.flow === "close") await handleCloseFlow(message, state);
  if (state.flow === "edit") await handleEditFlow(message, state);
}

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const expectedSecret = env("TELEGRAM_WEBHOOK_SECRET");
  if (expectedSecret) {
    const actualSecret = req.headers.get("x-telegram-bot-api-secret-token");
    if (actualSecret !== expectedSecret) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const update = (await req.json()) as TelegramUpdate;
  if (update.message) {
    try {
      await handleMessage(update.message);
    } catch (error) {
      console.error(error);
      await reply(update.message.chat.id, `Bir hata oluştu: ${(error as Error).message}`);
    }
  }

  return jsonResponse({ ok: true, requestId: context.requestId });
};

export const config: Config = {
  path: "/api/telegram",
  method: ["POST"],
};
