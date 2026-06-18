import type { Config } from "@netlify/functions";

type ParsedQuestion = {
  name: string;
  label: string;
  entry: string | Record<string, string>;
  kind: string;
  required: boolean;
  options: string[];
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function normalizeAction(url: string) {
  return url.replace("/viewform", "/formResponse").split("?")[0];
}

function sanitizeName(entry: string | number) {
  return `q_${String(entry).replace(/\D+/g, "_").replace(/^_+|_+$/g, "")}`;
}

function extractPublicData(html: string) {
  const marker = "FB_PUBLIC_LOAD_DATA_";
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error("Google Form verisi bulunamadı. Form herkese açık olmayabilir.");
  }

  const start = html.indexOf("[", markerIndex);
  if (start === -1) throw new Error("Form veri başlangıcı okunamadı.");

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let index = start; index < html.length; index += 1) {
    const char = html[index];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      escapeNext = inString;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "[") depth += 1;
    if (char === "]") depth -= 1;

    if (depth === 0) {
      return JSON.parse(html.slice(start, index + 1));
    }
  }

  throw new Error("Form verisi tamamlanmadan bitti.");
}

function fieldKind(type: number, title: string) {
  const lower = title.toLocaleLowerCase("tr-TR");
  if (type === 1) return "textarea";
  if (type === 2 || type === 3) return "select";
  if (type === 4) return "checkboxes";
  if (type === 9) return "date";
  if (type === 10) return "time";
  if (lower.includes("mail") || lower.includes("e-posta") || lower.includes("email")) return "email";
  if (lower.includes("telefon") || lower.includes("whatsapp")) return "tel";
  return "text";
}

function optionsFromEntry(entry: any) {
  const rawOptions = entry?.[4];
  if (!Array.isArray(rawOptions)) return [];
  return rawOptions
    .map((item) => item?.[0])
    .filter((item) => typeof item === "string" && item.trim())
    .filter((item) => item !== "__other_option__");
}

function parseQuestions(data: any) {
  const items = data?.[1]?.[1];
  if (!Array.isArray(items)) {
    throw new Error("Form soru listesi okunamadı.");
  }

  const questions: ParsedQuestion[] = [];

  for (const item of items) {
    const title = item?.[1];
    const entries = item?.[4];
    if (!title || !Array.isArray(entries)) continue;

    const entry = entries[0];
    const entryId = entry?.[0];
    if (!entryId) continue;

    const type = Number(entry?.[3] ?? 0);
    const required = Boolean(entry?.[2]);
    const kind = fieldKind(type, title);
    const options = optionsFromEntry(entry);
    const googleEntry = kind === "date"
      ? {
          year: `entry.${entryId}_year`,
          month: `entry.${entryId}_month`,
          day: `entry.${entryId}_day`,
        }
      : `entry.${entryId}`;

    questions.push({
      name: sanitizeName(entryId),
      label: title,
      entry: googleEntry,
      kind,
      required,
      options,
    });
  }

  return questions;
}

export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return json({ error: "Google Form linki gerekli." }, 400);
    }

    const normalizedUrl = url.replace("/formResponse", "/viewform");
    const response = await fetch(normalizedUrl, {
      headers: {
        "user-agent": "Mozilla/5.0 RETORIK Form Entry Tool",
      },
    });

    if (!response.ok) {
      return json({ error: `Google Form okunamadı: ${response.status}` }, 400);
    }

    const html = await response.text();
    const data = extractPublicData(html);
    const questions = parseQuestions(data);

    return json({
      action: normalizeAction(normalizedUrl),
      title: data?.[1]?.[8] || "",
      questions,
    });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
};

export const config: Config = {
  path: "/api/parse-form",
  method: ["POST"],
};
